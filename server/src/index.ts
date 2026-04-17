import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { Server } from 'socket.io';
import { SessionManager } from './session-manager';
import { ServerToClientEvents, ClientToServerEvents } from './types';

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const sessionManager = new SessionManager();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

function broadcastPlayers(sessionId: string) {
  const session = sessionManager['sessions'].get(sessionId);
  if (!session || session.players.size === 0) return;
  const players = sessionManager.getPlayerList(session);
  io.to(sessionId).emit('players-updated', { count: session.players.size, players });
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('create-session', ({ playerName, isLeader }) => {
    const session = sessionManager.createSession(socket.id, playerName, isLeader);
    socket.join(session.id);
    socket.emit('session-created', { sessionId: session.id });
    socket.emit('session-joined', {
      sessionId: session.id,
      playerCount: session.players.size,
      players: sessionManager.getPlayerList(session),
      sequence: session.sequence,
      isLeader,
    });
    console.log(`[session-created] ${session.id} by ${playerName} (leader: ${isLeader})`);
  });

  socket.on('join-session', ({ sessionId, playerName, isLeader }) => {
    const session = sessionManager.joinSession(sessionId, socket.id, playerName, isLeader);
    if (!session) {
      socket.emit('session-error', { message: `Relace "${sessionId}" nebyla nalezena` });
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
    console.log(`[session-joined] ${playerName} -> ${session.id} (leader: ${isLeader}, ${session.players.size} players)`);
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

  socket.on('update-sequence', ({ sequence }) => {
    const session = sessionManager.updateSequence(socket.id, sequence);
    if (!session) return;
    socket.to(session.id).emit('sequence-updated', { sequence });
  });

  socket.on('clear-sequence', () => {
    const session = sessionManager.clearSequence(socket.id);
    if (!session) return;
    io.to(session.id).emit('sequence-cleared');
  });

  socket.on('disconnect', () => {
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
