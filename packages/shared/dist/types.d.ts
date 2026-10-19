import type { DrawOp, GameId, RoomSettings } from './schemas.js';
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
    playerId: string | null;
    nickname: string;
    text: string;
    at: number;
    kind: 'chat' | 'system' | 'guess-correct' | 'guess-close' | 'sticker' | 'whisper';
    /** só em kind = 'sticker' */
    sticker?: string;
}
export type RoomPhase = 'lobby' | 'playing' | 'results';
export interface PublicRoom {
    code: string;
    settings: RoomSettings;
    /** senha da sala (só quem já está dentro recebe este estado); null = sem senha */
    password: string | null;
    gameSettings: Record<string, unknown>;
    phase: RoomPhase;
    hostId: string;
    players: PublicPlayer[];
    createdAt: number;
}
export interface MatchResult {
    ranking: {
        playerId: string;
        nickname: string;
        avatar: string;
        score: number;
        place: number;
    }[];
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
export declare const GAME_CATALOG: GameMeta[];
export interface ServerError {
    code: 'VALIDATION' | 'NOT_FOUND' | 'ROOM_FULL' | 'FORBIDDEN' | 'RATE_LIMITED' | 'INVALID_STATE' | 'UNAUTHORIZED' | 'PASSWORD_REQUIRED' | 'INTERNAL';
    message: string;
}
export type Ack<T = unknown> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: ServerError;
};
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
/** Visão do Impostor. O local só aparece para quem não é impostor; o impostor só é revelado no fim. */
export interface ImpostorView {
    phase: 'reveal' | 'discussion' | 'voting' | 'round-results' | 'finished';
    round: number;
    totalRounds: number;
    deadline: number | null;
    participants: string[];
    /** lista de locais possíveis (todos veem; o impostor usa para chutar) */
    locations: string[];
    /** meu papel: null para espectador */
    me: {
        isImpostor: true;
    } | {
        isImpostor: false;
        location: string;
        role: string;
    } | null;
    firstAsker: string | null;
    readyPlayers: string[];
    callVotePlayers: string[];
    /** quem já votou (sem revelar em quem) */
    votedPlayers: string[];
    myVote: string | null;
    totals: Record<string, number>;
    /** preenchido em round-results/finished */
    outcome: {
        impostorId: string;
        location: string;
        votes: Record<string, string>;
        accused: string | null;
        reason: 'caught' | 'escaped' | 'guessed' | 'wrong-guess';
        guess: string | null;
        roundScores: Record<string, number>;
        roles: Record<string, string>;
    } | null;
}
export interface QuizView {
    phase: 'countdown' | 'question' | 'reveal' | 'finished';
    index: number;
    total: number;
    deadline: number | null;
    participants: string[];
    question: {
        text: string;
        options: string[];
        category: string;
    } | null;
    myAnswer: number | null;
    answeredPlayers: string[];
    totals: Record<string, number>;
    streaks: Record<string, number>;
    /** preenchido em reveal */
    reveal: {
        correct: number;
        answers: Record<string, number>;
        gained: Record<string, number>;
        fact: string | null;
    } | null;
}
/** Visão dos jogos de adivinhar. A palavra só vai para quem a vê (desenhista/ator/dicas) até o fim do turno. */
export interface GuessView {
    variant: 'draw' | 'charades' | 'secretword';
    phase: 'choosing' | 'playing' | 'turn-end' | 'finished';
    round: number;
    totalRounds: number;
    turn: number;
    totalTurns: number;
    deadline: number | null;
    participants: string[];
    currentId: string | null;
    /** opções de palavra: só para quem vai desenhar/encenar/dar dicas, na escolha */
    choices: string[] | null;
    /** palavra completa: para o jogador da vez, ou para todos no fim do turno */
    word: string | null;
    /** máscara com letras reveladas ("_" = escondida), ex.: ["c","_","_"," ","_"] */
    mask: string[];
    category: string | null;
    guessed: {
        id: string;
        points: number;
    }[];
    turnScores: Record<string, number> | null;
    totals: Record<string, number>;
    /** só Rabisco */
    ops: DrawOp[];
    /** só Palavra Secreta */
    clues: string[];
    maxClues: number;
}
export declare const EVENTS: {
    readonly ROOM_CREATE: "room:create";
    readonly ROOM_JOIN: "room:join";
    readonly ROOM_LEAVE: "room:leave";
    readonly ROOM_KICK: "room:kick";
    readonly ROOM_TRANSFER_HOST: "room:transferHost";
    readonly ROOM_UPDATE_SETTINGS: "room:updateSettings";
    readonly ROOM_START: "room:start";
    readonly ROOM_END: "room:end";
    readonly ROOM_BACK_TO_LOBBY: "room:backToLobby";
    readonly CHAT_SEND: "chat:send";
    readonly GAME_ACTION: "game:action";
    readonly ROOM_STATE: "room:state";
    readonly ROOM_KICKED: "room:kicked";
    readonly CHAT_MESSAGE: "chat:message";
    readonly CHAT_HISTORY: "chat:history";
    readonly GAME_STATE: "game:state";
    readonly GAME_EVENT: "game:event";
    readonly REWARD: "player:reward";
    readonly INVITE: "player:invite";
    readonly REACTION: "room:reaction";
    readonly PRESENCE: "friends:presence";
    readonly GAME_RESULT: "game:result";
    readonly NOTICE: "notice";
};
