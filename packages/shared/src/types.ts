import type { GameId, RoomSettings } from './schemas.js';

export type PresenceStatus = 'online' | 'reconnecting' | 'left';

export interface PublicPlayer {
  id: string;
  nickname: string;
  avatar: string;
  isHost: boolean;
  status: PresenceStatus;
  isGuest: boolean;
  score: number;
}

export interface ChatMessage {
  id: string;
  playerId: string | null; // null = sistema
  nickname: string;
  text: string;
  at: number;
  kind: 'chat' | 'system' | 'guess-correct' | 'guess-close';
}

export type RoomPhase = 'lobby' | 'playing' | 'results';

export interface PublicRoom {
  code: string;
  settings: RoomSettings;
  gameSettings: Record<string, unknown>;
  phase: RoomPhase;
  hostId: string;
  players: PublicPlayer[];
  createdAt: number;
}

export interface MatchResult {
  ranking: { playerId: string; nickname: string; avatar: string; score: number; place: number }[];
  gameId: GameId;
  endedAt: number;
}

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  available: boolean;
  color: string;
}

export const GAME_CATALOG: GameMeta[] = [
  {
    id: 'stop',
    name: 'Adedonha',
    tagline: 'Letra sorteada, categorias, corrida contra o relógio.',
    minPlayers: 2,
    maxPlayers: 16,
    available: true,
    color: 'lime',
  },
  {
    id: 'draw',
    name: 'Rabisco',
    tagline: 'Desenhe a palavra secreta enquanto os outros chutam.',
    minPlayers: 2,
    maxPlayers: 12,
    available: false,
    color: 'pink',
  },
  {
    id: 'charades',
    name: 'Mímica',
    tagline: 'Só gestos valem: a turma chuta no chat.',
    minPlayers: 3,
    maxPlayers: 16,
    available: false,
    color: 'amber',
  },
  {
    id: 'quiz',
    name: 'Quiz Relâmpago',
    tagline: 'Múltipla escolha, quem responde rápido leva mais.',
    minPlayers: 2,
    maxPlayers: 16,
    available: false,
    color: 'sky',
  },
  {
    id: 'secretword',
    name: 'Palavra Secreta',
    tagline: 'Dicas medidas a conta-gotas até alguém acertar.',
    minPlayers: 3,
    maxPlayers: 12,
    available: false,
    color: 'violet',
  },
  {
    id: 'impostor',
    name: 'Impostor',
    tagline: 'Todos sabem o local. Menos um. Descubram quem.',
    minPlayers: 4,
    maxPlayers: 12,
    available: false,
    color: 'rose',
  },
];

export interface ServerError {
  code:
    | 'VALIDATION'
    | 'NOT_FOUND'
    | 'ROOM_FULL'
    | 'FORBIDDEN'
    | 'RATE_LIMITED'
    | 'INVALID_STATE'
    | 'UNAUTHORIZED'
    | 'INTERNAL';
  message: string;
}

export type Ack<T = unknown> = { ok: true; data: T } | { ok: false; error: ServerError };

export type StopAnswerStatus = 'unique' | 'repeated' | 'empty' | 'invalid' | 'rejected';

/** Visão do STOP enviada a cada jogador (nunca contém respostas alheias antes da revisão). */
export interface StopView {
  phase: 'answering' | 'stopping' | 'review' | 'round-results' | 'finished';
  round: number;
  totalRounds: number;
  letter: string;
  categories: string[];
  deadline: number | null;
  stoppedBy: string | null;
  myAnswers: Record<string, string>;
  /** só preenchido em review/round-results */
  review: {
    playerId: string;
    answers: Record<string, string>;
    /** votos de rejeição por categoria (contagem) */
    rejections: Record<string, number>;
    /** categorias que EU marquei como inválidas para este jogador */
    myRejections: string[];
    /** preenchido em round-results */
    statuses: Record<string, StopAnswerStatus> | null;
  }[];
  participants: string[];
  roundScores: Record<string, Record<string, number>> | null;
  totals: Record<string, number>;
  readyPlayers: string[];
}

export const EVENTS = {
  // cliente -> servidor
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_KICK: 'room:kick',
  ROOM_TRANSFER_HOST: 'room:transferHost',
  ROOM_UPDATE_SETTINGS: 'room:updateSettings',
  ROOM_START: 'room:start',
  ROOM_END: 'room:end',
  ROOM_BACK_TO_LOBBY: 'room:backToLobby',
  CHAT_SEND: 'chat:send',
  GAME_ACTION: 'game:action',
  // servidor -> cliente
  ROOM_STATE: 'room:state',
  ROOM_KICKED: 'room:kicked',
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',
  GAME_STATE: 'game:state',
  GAME_RESULT: 'game:result',
  NOTICE: 'notice',
} as const;
