import { randomInt } from 'crypto';
import { Session, Player, PlayerInfo } from './types';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_ID_LENGTH = 6;
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_SESSIONS = 10000; // cap memory growth
const MAX_PLAYER_NAME_LENGTH = 24;
const MAX_SEQUENCE_LENGTH = 20;
const VALID_SYMBOL_IDS = new Set([0, 1, 2, 3, 4]);

export class SessionManager {
  private sessions = new Map<string, Session>();
  private playerSessionMap = new Map<string, string>(); // socketId -> sessionId
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  private generateId(): string {
    let id: string;
    let attempts = 0;
    do {
      if (attempts++ > 100) throw new Error('Failed to generate unique session ID');
      id = '';
      for (let i = 0; i < SESSION_ID_LENGTH; i++) {
        id += CHARSET[randomInt(CHARSET.length)];
      }
    } while (this.sessions.has(id));
    return id;
  }

  static sanitizePlayerName(name: unknown): string {
    if (typeof name !== 'string') return 'Player';
    // Strip control chars and HTML-dangerous characters, trim, enforce length
    const cleaned = name.replace(/[\x00-\x1F<>&"'`\\]/g, '').trim().slice(0, MAX_PLAYER_NAME_LENGTH);
    return cleaned || 'Player';
  }

  static validateSessionId(id: unknown): string | null {
    if (typeof id !== 'string') return null;
    const upper = id.toUpperCase();
    if (upper.length !== SESSION_ID_LENGTH) return null;
    for (const c of upper) if (!CHARSET.includes(c)) return null;
    return upper;
  }

  static validateSequence(seq: unknown): number[] | null {
    if (!Array.isArray(seq)) return null;
    if (seq.length > MAX_SEQUENCE_LENGTH) return null;
    for (const s of seq) {
      if (typeof s !== 'number' || !VALID_SYMBOL_IDS.has(s)) return null;
    }
    return seq as number[];
  }

  createSession(socketId: string, playerName: string, isLeader: boolean): Session | null {
    if (this.sessions.size >= MAX_SESSIONS) return null;

    this.removePlayerFromCurrentSession(socketId);

    const cleanName = SessionManager.sanitizePlayerName(playerName);
    const leaderIds = new Set<string>();
    if (isLeader) leaderIds.add(socketId);

    const session: Session = {
      id: this.generateId(),
      leaderIds,
      players: new Map([[socketId, { socketId, name: cleanName, isLeader, joinedAt: Date.now() }]]),
      sequence: [],
      createdAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.playerSessionMap.set(socketId, session.id);
    return session;
  }

  joinSession(sessionId: string, socketId: string, playerName: string, isLeader: boolean): Session | null {
    const session = this.sessions.get(sessionId.toUpperCase());
    if (!session) return null;
    if (session.players.size >= 100) return null; // cap players per session

    this.removePlayerFromCurrentSession(socketId);

    const cleanName = SessionManager.sanitizePlayerName(playerName);
    const player: Player = { socketId, name: cleanName, isLeader, joinedAt: Date.now() };
    session.players.set(socketId, player);
    if (isLeader) {
      session.leaderIds.add(socketId);
    }
    this.playerSessionMap.set(socketId, session.id);
    return session;
  }

  removePlayerFromCurrentSession(socketId: string): { session: Session } | null {
    const sessionId = this.playerSessionMap.get(socketId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) {
      this.playerSessionMap.delete(socketId);
      return null;
    }

    session.players.delete(socketId);
    session.leaderIds.delete(socketId);
    this.playerSessionMap.delete(socketId);

    if (session.players.size === 0) {
      this.sessions.delete(sessionId);
    }

    return { session };
  }

  getSessionForPlayer(socketId: string): Session | null {
    const sessionId = this.playerSessionMap.get(socketId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) ?? null;
  }

  isLeader(socketId: string): boolean {
    const session = this.getSessionForPlayer(socketId);
    return session?.leaderIds.has(socketId) ?? false;
  }

  updateSequence(socketId: string, sequence: number[]): Session | null {
    const session = this.getSessionForPlayer(socketId);
    if (!session || !session.leaderIds.has(socketId)) return null;
    session.sequence = sequence;
    return session;
  }

  clearSequence(socketId: string): Session | null {
    const session = this.getSessionForPlayer(socketId);
    if (!session || !session.leaderIds.has(socketId)) return null;
    session.sequence = [];
    return session;
  }

  getPlayerList(session: Session): PlayerInfo[] {
    return Array.from(session.players.values()).map((p) => ({
      name: p.name,
      isLeader: p.isLeader,
    }));
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        for (const socketId of session.players.keys()) {
          this.playerSessionMap.delete(socketId);
        }
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
