import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { Server } from 'socket.io';
import { SessionManager } from './session-manager';
import { ServerToClientEvents, ClientToServerEvents } from './types';

const PORT = parseInt(process.env.PORT || '3000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 8 * 1024, // 8KB max per message (we never need more)
  pingTimeout: 30000,
});

const sessionManager = new SessionManager();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// --- Rate limiting ---
interface RateLimit {
  count: number;
  resetAt: number;
}
const rateLimits = new Map<string, Map<string, RateLimit>>();

function checkRateLimit(socketId: string, event: string, maxPerWindow: number, windowMs: number): boolean {
  let socketLimits = rateLimits.get(socketId);
  if (!socketLimits) {
    socketLimits = new Map();
    rateLimits.set(socketId, socketLimits);
  }
  const now = Date.now();
  const limit = socketLimits.get(event);
  if (!limit || now > limit.resetAt) {
    socketLimits.set(event, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (limit.count >= maxPerWindow) return false;
  limit.count++;
  return true;
}

function broadcastPlayers(sessionId: string) {
  const session = sessionManager['sessions'].get(sessionId);
  if (!session || session.players.size === 0) return;
  const players = sessionManager.getPlayerList(session);
  io.to(sessionId).emit('players-updated', { count: session.players.size, players });
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('create-session', (data) => {
    if (!checkRateLimit(socket.id, 'create-session', 3, 60_000)) return;
    if (!data || typeof data !== 'object') return;

    const name = SessionManager.sanitizePlayerName(data.playerName);
    const isLeader = data.isLeader === true;

    const session = sessionManager.createSession(socket.id, name, isLeader);
    if (!session) {
      socket.emit('session-error', { message: 'Server is at capacity' });
      return;
    }
    socket.join(session.id);
    socket.emit('session-created', { sessionId: session.id });
    socket.emit('session-joined', {
      sessionId: session.id,
      playerCount: session.players.size,
      players: sessionManager.getPlayerList(session),
      sequence: session.sequence,
      isLeader,
    });
    console.log(`[session-created] ${session.id} (leader: ${isLeader})`);
  });

  socket.on('join-session', (data) => {
    if (!checkRateLimit(socket.id, 'join-session', 10, 60_000)) return;
    if (!data || typeof data !== 'object') return;

    const sessionId = SessionManager.validateSessionId(data.sessionId);
    if (!sessionId) {
      socket.emit('session-error', { message: 'Invalid session ID' });
      return;
    }
    const name = SessionManager.sanitizePlayerName(data.playerName);
    const isLeader = data.isLeader === true;

    const session = sessionManager.joinSession(sessionId, socket.id, name, isLeader);
    if (!session) {
      socket.emit('session-error', { message: `Session "${sessionId}" not found or full` });
      return;
    }

    socket.join(session.id);
    socket.emit('session-joined', {
      sessionId: session.id,
      playerCount: session.players.size,
      players: sessionManager.getPlayerList(session),
      sequence: session.sequence,
      isLeader,
    });
    broadcastPlayers(session.id);
    console.log(`[session-joined] -> ${session.id} (${session.players.size} players)`);
  });

  socket.on('leave-session', () => {
    const result = sessionManager.removePlayerFromCurrentSession(socket.id);
    if (!result) return;

    const { session } = result;
    socket.leave(session.id);

    if (session.players.size > 0) {
      broadcastPlayers(session.id);
    }
  });

  socket.on('update-sequence', (data) => {
    if (!checkRateLimit(socket.id, 'update-sequence', 30, 1000)) return;
    if (!data || typeof data !== 'object') return;

    const sequence = SessionManager.validateSequence(data.sequence);
    if (!sequence) return;

    const session = sessionManager.updateSequence(socket.id, sequence);
    if (!session) return;
    socket.to(session.id).emit('sequence-updated', { sequence });
  });

  socket.on('clear-sequence', () => {
    if (!checkRateLimit(socket.id, 'clear-sequence', 30, 1000)) return;
    const session = sessionManager.clearSequence(socket.id);
    if (!session) return;
    io.to(session.id).emit('sequence-cleared');
  });

  socket.on('disconnect', () => {
    rateLimits.delete(socket.id);
    const result = sessionManager.removePlayerFromCurrentSession(socket.id);
    if (result && result.session.players.size > 0) {
      broadcastPlayers(result.session.id);
    }
    console.log(`[disconnect] ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Lura server running on port ${PORT}`);
});
