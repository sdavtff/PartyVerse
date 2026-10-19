import { z } from 'zod';
export declare const GAME_IDS: readonly ["stop", "draw", "charades", "quiz", "secretword", "impostor"];
export type GameId = (typeof GAME_IDS)[number];
export declare const nicknameSchema: z.ZodString;
export declare const roomCodeSchema: z.ZodString;
export declare const stopSettingsSchema: z.ZodObject<{
    categories: z.ZodArray<z.ZodString, "many">;
    rounds: z.ZodNumber;
    roundSeconds: z.ZodNumber;
    reviewSeconds: z.ZodNumber;
    stopCountdownSeconds: z.ZodNumber;
    points: z.ZodObject<{
        unique: z.ZodNumber;
        repeated: z.ZodNumber;
        empty: z.ZodNumber;
        rejected: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        unique: number;
        repeated: number;
        empty: number;
        rejected: number;
    }, {
        unique: number;
        repeated: number;
        empty: number;
        rejected: number;
    }>;
}, "strip", z.ZodTypeAny, {
    categories: string[];
    rounds: number;
    roundSeconds: number;
    reviewSeconds: number;
    stopCountdownSeconds: number;
    points: {
        unique: number;
        repeated: number;
        empty: number;
        rejected: number;
    };
}, {
    categories: string[];
    rounds: number;
    roundSeconds: number;
    reviewSeconds: number;
    stopCountdownSeconds: number;
    points: {
        unique: number;
        repeated: number;
        empty: number;
        rejected: number;
    };
}>;
export type StopSettings = z.infer<typeof stopSettingsSchema>;
export declare const MAX_ROOM_PLAYERS = 50;
export declare const roomSettingsSchema: z.ZodObject<{
    name: z.ZodString;
    gameId: z.ZodEnum<["stop", "draw", "charades", "quiz", "secretword", "impostor"]>;
    isPublic: z.ZodBoolean;
    maxPlayers: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor";
    isPublic: boolean;
    maxPlayers: number;
}, {
    name: string;
    gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor";
    isPublic: boolean;
    maxPlayers: number;
}>;
/** Avatar: formato antigo "forma-n" ou montado no criador "c-xxxxxx" (6 partes em base 36). */
export declare const avatarSchema: z.ZodString;
export declare const roomPasswordSchema: z.ZodString;
/** Figurinhas do chat (desenhos originais do PartyVerse). */
export declare const STICKERS: readonly ["risada", "amei", "bravo", "chorando", "uau", "estiloso", "festa", "pensando", "dormindo", "joinha", "lingua", "medo"];
export type StickerId = (typeof STICKERS)[number];
export type RoomSettings = z.infer<typeof roomSettingsSchema>;
export declare const createRoomSchema: z.ZodObject<{
    settings: z.ZodObject<{
        name: z.ZodString;
        gameId: z.ZodEnum<["stop", "draw", "charades", "quiz", "secretword", "impostor"]>;
        isPublic: z.ZodBoolean;
        maxPlayers: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor";
        isPublic: boolean;
        maxPlayers: number;
    }, {
        name: string;
        gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor";
        isPublic: boolean;
        maxPlayers: number;
    }>;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    settings: {
        name: string;
        gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor";
        isPublic: boolean;
        maxPlayers: number;
    };
    password?: string | undefined;
}, {
    settings: {
        name: string;
        gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor";
        isPublic: boolean;
        maxPlayers: number;
    };
    password?: string | undefined;
}>;
export declare const joinRoomSchema: z.ZodObject<{
    code: z.ZodString;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    password?: string | undefined;
}, {
    code: string;
    password?: string | undefined;
}>;
export declare const chatSchema: z.ZodUnion<[z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>, z.ZodObject<{
    sticker: z.ZodEnum<["risada", "amei", "bravo", "chorando", "uau", "estiloso", "festa", "pensando", "dormindo", "joinha", "lingua", "medo"]>;
}, "strip", z.ZodTypeAny, {
    sticker: "risada" | "amei" | "bravo" | "chorando" | "uau" | "estiloso" | "festa" | "pensando" | "dormindo" | "joinha" | "lingua" | "medo";
}, {
    sticker: "risada" | "amei" | "bravo" | "chorando" | "uau" | "estiloso" | "festa" | "pensando" | "dormindo" | "joinha" | "lingua" | "medo";
}>]>;
export declare const kickSchema: z.ZodObject<{
    playerId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    playerId: string;
}, {
    playerId: string;
}>;
export declare const transferHostSchema: z.ZodObject<{
    playerId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    playerId: string;
}, {
    playerId: string;
}>;
export declare const updateSettingsSchema: z.ZodObject<{
    room: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        gameId: z.ZodOptional<z.ZodEnum<["stop", "draw", "charades", "quiz", "secretword", "impostor"]>>;
        isPublic: z.ZodOptional<z.ZodBoolean>;
        maxPlayers: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        gameId?: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | undefined;
        isPublic?: boolean | undefined;
        maxPlayers?: number | undefined;
    }, {
        name?: string | undefined;
        gameId?: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | undefined;
        isPublic?: boolean | undefined;
        maxPlayers?: number | undefined;
    }>>;
    /** "" remove a senha */
    password: z.ZodOptional<z.ZodString>;
    game: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    password?: string | undefined;
    room?: {
        name?: string | undefined;
        gameId?: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | undefined;
        isPublic?: boolean | undefined;
        maxPlayers?: number | undefined;
    } | undefined;
    game?: Record<string, unknown> | undefined;
}, {
    password?: string | undefined;
    room?: {
        name?: string | undefined;
        gameId?: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | undefined;
        isPublic?: boolean | undefined;
        maxPlayers?: number | undefined;
    } | undefined;
    game?: Record<string, unknown> | undefined;
}>;
export declare const stopActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"answers">;
    answers: z.ZodRecord<z.ZodString, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "answers";
    answers: Record<string, string>;
}, {
    type: "answers";
    answers: Record<string, string>;
}>, z.ZodObject<{
    type: z.ZodLiteral<"stop">;
}, "strip", z.ZodTypeAny, {
    type: "stop";
}, {
    type: "stop";
}>, z.ZodObject<{
    type: z.ZodLiteral<"vote">;
    targetId: z.ZodString;
    category: z.ZodString;
    valid: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    valid: boolean;
    type: "vote";
    targetId: string;
    category: string;
}, {
    valid: boolean;
    type: "vote";
    targetId: string;
    category: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"ready">;
}, "strip", z.ZodTypeAny, {
    type: "ready";
}, {
    type: "ready";
}>]>;
export type StopAction = z.infer<typeof stopActionSchema>;
export declare const impostorSettingsSchema: z.ZodObject<{
    rounds: z.ZodNumber;
    discussionSeconds: z.ZodNumber;
    voteSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    rounds: number;
    discussionSeconds: number;
    voteSeconds: number;
}, {
    rounds: number;
    discussionSeconds: number;
    voteSeconds: number;
}>;
export type ImpostorSettings = z.infer<typeof impostorSettingsSchema>;
export declare const impostorActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"ready">;
}, "strip", z.ZodTypeAny, {
    type: "ready";
}, {
    type: "ready";
}>, z.ZodObject<{
    type: z.ZodLiteral<"callVote">;
}, "strip", z.ZodTypeAny, {
    type: "callVote";
}, {
    type: "callVote";
}>, z.ZodObject<{
    type: z.ZodLiteral<"vote">;
    targetId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "vote";
    targetId: string;
}, {
    type: "vote";
    targetId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"guess">;
    location: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "guess";
    location: string;
}, {
    type: "guess";
    location: string;
}>]>;
export type ImpostorAction = z.infer<typeof impostorActionSchema>;
export declare const QUIZ_CATEGORIES: readonly ["misto", "geral", "ciencia", "geografia", "historia", "esportes", "entretenimento"];
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];
export declare const quizSettingsSchema: z.ZodObject<{
    questions: z.ZodNumber;
    secondsPerQuestion: z.ZodNumber;
    category: z.ZodEnum<["misto", "geral", "ciencia", "geografia", "historia", "esportes", "entretenimento"]>;
}, "strip", z.ZodTypeAny, {
    category: "misto" | "geral" | "ciencia" | "geografia" | "historia" | "esportes" | "entretenimento";
    questions: number;
    secondsPerQuestion: number;
}, {
    category: "misto" | "geral" | "ciencia" | "geografia" | "historia" | "esportes" | "entretenimento";
    questions: number;
    secondsPerQuestion: number;
}>;
export type QuizSettings = z.infer<typeof quizSettingsSchema>;
export declare const quizActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"answer">;
    option: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "answer";
    option: number;
}, {
    type: "answer";
    option: number;
}>]>;
export type QuizAction = z.infer<typeof quizActionSchema>;
export declare const WORD_CATEGORIES: readonly ["misto", "animais", "comidas", "objetos", "lugares", "profissoes", "acoes"];
export type WordCategory = (typeof WORD_CATEGORIES)[number];
export declare const guessSettingsSchema: z.ZodObject<{
    rounds: z.ZodNumber;
    turnSeconds: z.ZodNumber;
    category: z.ZodEnum<["misto", "animais", "comidas", "objetos", "lugares", "profissoes", "acoes"]>;
    /** revela letras da palavra ao longo do tempo */
    letterHints: z.ZodBoolean;
    /** só Palavra Secreta: máximo de dicas por vez */
    maxClues: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    rounds: number;
    category: "misto" | "animais" | "comidas" | "objetos" | "lugares" | "profissoes" | "acoes";
    turnSeconds: number;
    letterHints: boolean;
    maxClues: number;
}, {
    rounds: number;
    category: "misto" | "animais" | "comidas" | "objetos" | "lugares" | "profissoes" | "acoes";
    turnSeconds: number;
    letterHints: boolean;
    maxClues: number;
}>;
export type GuessSettings = z.infer<typeof guessSettingsSchema>;
export declare const drawOpSchema: z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
    t: z.ZodLiteral<"s">;
    id: z.ZodString;
    c: z.ZodString;
    w: z.ZodNumber;
    e: z.ZodOptional<z.ZodBoolean>;
    p: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    t: "s";
    id: string;
    c: string;
    w: number;
    p: number[];
    e?: boolean | undefined;
}, {
    t: "s";
    id: string;
    c: string;
    w: number;
    p: number[];
    e?: boolean | undefined;
}>, z.ZodObject<{
    t: z.ZodLiteral<"a">;
    id: z.ZodString;
    p: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    t: "a";
    id: string;
    p: number[];
}, {
    t: "a";
    id: string;
    p: number[];
}>, z.ZodObject<{
    t: z.ZodLiteral<"sh">;
    id: z.ZodString;
    k: z.ZodEnum<["line", "rect", "ellipse"]>;
    c: z.ZodString;
    w: z.ZodNumber;
    f: z.ZodBoolean;
    p: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
}, "strip", z.ZodTypeAny, {
    t: "sh";
    id: string;
    c: string;
    w: number;
    p: [number, number, number, number];
    k: "line" | "rect" | "ellipse";
    f: boolean;
}, {
    t: "sh";
    id: string;
    c: string;
    w: number;
    p: [number, number, number, number];
    k: "line" | "rect" | "ellipse";
    f: boolean;
}>, z.ZodObject<{
    t: z.ZodLiteral<"f">;
    id: z.ZodString;
    c: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    t: "f";
    id: string;
    c: string;
    x: number;
    y: number;
}, {
    t: "f";
    id: string;
    c: string;
    x: number;
    y: number;
}>, z.ZodObject<{
    t: z.ZodLiteral<"u">;
}, "strip", z.ZodTypeAny, {
    t: "u";
}, {
    t: "u";
}>, z.ZodObject<{
    t: z.ZodLiteral<"clear">;
}, "strip", z.ZodTypeAny, {
    t: "clear";
}, {
    t: "clear";
}>]>;
export type DrawOp = z.infer<typeof drawOpSchema>;
export declare const guessActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"choose">;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "choose";
    index: number;
}, {
    type: "choose";
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"draw">;
    ops: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
        t: z.ZodLiteral<"s">;
        id: z.ZodString;
        c: z.ZodString;
        w: z.ZodNumber;
        e: z.ZodOptional<z.ZodBoolean>;
        p: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        t: "s";
        id: string;
        c: string;
        w: number;
        p: number[];
        e?: boolean | undefined;
    }, {
        t: "s";
        id: string;
        c: string;
        w: number;
        p: number[];
        e?: boolean | undefined;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"a">;
        id: z.ZodString;
        p: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        t: "a";
        id: string;
        p: number[];
    }, {
        t: "a";
        id: string;
        p: number[];
    }>, z.ZodObject<{
        t: z.ZodLiteral<"sh">;
        id: z.ZodString;
        k: z.ZodEnum<["line", "rect", "ellipse"]>;
        c: z.ZodString;
        w: z.ZodNumber;
        f: z.ZodBoolean;
        p: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    }, "strip", z.ZodTypeAny, {
        t: "sh";
        id: string;
        c: string;
        w: number;
        p: [number, number, number, number];
        k: "line" | "rect" | "ellipse";
        f: boolean;
    }, {
        t: "sh";
        id: string;
        c: string;
        w: number;
        p: [number, number, number, number];
        k: "line" | "rect" | "ellipse";
        f: boolean;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"f">;
        id: z.ZodString;
        c: z.ZodString;
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        t: "f";
        id: string;
        c: string;
        x: number;
        y: number;
    }, {
        t: "f";
        id: string;
        c: string;
        x: number;
        y: number;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"u">;
    }, "strip", z.ZodTypeAny, {
        t: "u";
    }, {
        t: "u";
    }>, z.ZodObject<{
        t: z.ZodLiteral<"clear">;
    }, "strip", z.ZodTypeAny, {
        t: "clear";
    }, {
        t: "clear";
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "draw";
    ops: ({
        t: "s";
        id: string;
        c: string;
        w: number;
        p: number[];
        e?: boolean | undefined;
    } | {
        t: "a";
        id: string;
        p: number[];
    } | {
        t: "sh";
        id: string;
        c: string;
        w: number;
        p: [number, number, number, number];
        k: "line" | "rect" | "ellipse";
        f: boolean;
    } | {
        t: "f";
        id: string;
        c: string;
        x: number;
        y: number;
    } | {
        t: "u";
    } | {
        t: "clear";
    })[];
}, {
    type: "draw";
    ops: ({
        t: "s";
        id: string;
        c: string;
        w: number;
        p: number[];
        e?: boolean | undefined;
    } | {
        t: "a";
        id: string;
        p: number[];
    } | {
        t: "sh";
        id: string;
        c: string;
        w: number;
        p: [number, number, number, number];
        k: "line" | "rect" | "ellipse";
        f: boolean;
    } | {
        t: "f";
        id: string;
        c: string;
        x: number;
        y: number;
    } | {
        t: "u";
    } | {
        t: "clear";
    })[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"clue">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "clue";
    text: string;
}, {
    type: "clue";
    text: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"giveUp">;
}, "strip", z.ZodTypeAny, {
    type: "giveUp";
}, {
    type: "giveUp";
}>]>;
export type GuessAction = z.infer<typeof guessActionSchema>;
export declare const gameActionSchema: z.ZodObject<{
    action: z.ZodUnknown;
    /** id opcional gerado pelo cliente para deduplicar ações repetidas */
    actionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action?: unknown;
    actionId?: string | undefined;
}, {
    action?: unknown;
    actionId?: string | undefined;
}>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    nickname: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    nickname: string;
}, {
    password: string;
    email: string;
    nickname: string;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
}, {
    password: string;
    email: string;
}>;
export declare const guestSchema: z.ZodObject<{
    nickname: z.ZodString;
    avatar: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    nickname: string;
    avatar?: string | undefined;
}, {
    nickname: string;
    avatar?: string | undefined;
}>;
export declare const profileUpdateSchema: z.ZodObject<{
    nickname: z.ZodOptional<z.ZodString>;
    avatar: z.ZodOptional<z.ZodString>;
    preferences: z.ZodOptional<z.ZodObject<{
        sound: z.ZodOptional<z.ZodBoolean>;
        reducedMotion: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["dark", "light"]>>;
    }, "strip", z.ZodTypeAny, {
        sound?: boolean | undefined;
        reducedMotion?: boolean | undefined;
        theme?: "dark" | "light" | undefined;
    }, {
        sound?: boolean | undefined;
        reducedMotion?: boolean | undefined;
        theme?: "dark" | "light" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    nickname?: string | undefined;
    avatar?: string | undefined;
    preferences?: {
        sound?: boolean | undefined;
        reducedMotion?: boolean | undefined;
        theme?: "dark" | "light" | undefined;
    } | undefined;
}, {
    nickname?: string | undefined;
    avatar?: string | undefined;
    preferences?: {
        sound?: boolean | undefined;
        reducedMotion?: boolean | undefined;
        theme?: "dark" | "light" | undefined;
    } | undefined;
}>;
