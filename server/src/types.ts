export interface Player {
  socketId: string;
  name: string;
  isLeader: boolean;
  joinedAt: number;
}

export interface PlayerInfo {
  name: string;
  isLeader: boolean;
}

export interface Session {
  id: string;
  leaderIds: Set<string>;
  players: Map<string, Player>;
  sequence: number[];
  createdAt: number;
}

export interface ServerToClientEvents {
  'session-created': (data: { sessionId: string }) => void;
  'session-joined': (data: { sessionId: string; playerCount: number; players: PlayerInfo[]; sequence: number[]; isLeader: boolean }) => void;
  'session-error': (data: { message: string }) => void;
  'sequence-updated': (data: { sequence: number[] }) => void;
  'sequence-cleared': () => void;
  'players-updated': (data: { count: number; players: PlayerInfo[] }) => void;
  'leader-changed': (data: { isLeader: boolean }) => void;
}

export interface ClientToServerEvents {
  'create-session': (data: { playerName: string; isLeader: boolean }) => void;
  'join-session': (data: { sessionId: string; playerName: string; isLeader: boolean }) => void;
  'leave-session': () => void;
  'update-sequence': (data: { sequence: number[] }) => void;
  'clear-sequence': () => void;
}
