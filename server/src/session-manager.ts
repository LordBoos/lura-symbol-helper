import { Session, Player, PlayerInfo } from './types';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_ID_LENGTH = 6;
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export class SessionManager {
  private sessions = new Map<string, Session>();
  private playerSessionMap = new Map<string, string>(); // socketId -> sessionId
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  private generateId(): string {
    let id: string;
    do {
      id = '';
      for (let i = 0; i < SESSION_ID_LENGTH; i++) {
        id += CHARSET[Math.floor(Math.random() * CHARSET.length)];
      }
    } while (this.sessions.has(id));
    return id;
  }

  createSession(socketId: string, playerName: string, isLeader: boolean): Session {
    this.removePlayerFromCurrentSession(socketId);

    const leaderIds = new Set<string>();
    if (isLeader) leaderIds.add(socketId);

    const session: Session = {
      id: this.generateId(),
      leaderIds,
      players: new Map([[socketId, { socketId, name: playerName, isLeader, joinedAt: Date.now() }]]),
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

    this.removePlayerFromCurrentSession(socketId);

    const player: Player = { socketId, name: playerName, isLeader, joinedAt: Date.now() };
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
