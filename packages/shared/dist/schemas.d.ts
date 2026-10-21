import { z } from 'zod';
export declare const GAME_IDS: readonly ["stop", "draw", "charades", "quiz", "secretword", "impostor", "mostlikely", "truthdare", "twotruths", "hangman", "tictactoe", "checkers", "telephone", "spies"];
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
    /** a IA marca respostas suspeitas na revisão (vale como um voto) */
    aiJudge: z.ZodDefault<z.ZodBoolean>;
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
    aiJudge: boolean;
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
    aiJudge?: boolean | undefined;
}>;
export type StopSettings = z.infer<typeof stopSettingsSchema>;
export declare const MAX_ROOM_PLAYERS = 50;
export declare const roomSettingsSchema: z.ZodObject<{
    name: z.ZodString;
    gameId: z.ZodEnum<["stop", "draw", "charades", "quiz", "secretword", "impostor", "mostlikely", "truthdare", "twotruths", "hangman", "tictactoe", "checkers", "telephone", "spies"]>;
    isPublic: z.ZodBoolean;
    maxPlayers: z.ZodNumber;
    /** narrador com IA comenta o fim da partida */
    narrator: z.ZodDefault<z.ZodBoolean>;
    /** esconde palavrões no chat */
    chatFilter: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies";
    isPublic: boolean;
    maxPlayers: number;
    narrator: boolean;
    chatFilter: boolean;
}, {
    name: string;
    gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies";
    isPublic: boolean;
    maxPlayers: number;
    narrator?: boolean | undefined;
    chatFilter?: boolean | undefined;
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
        gameId: z.ZodEnum<["stop", "draw", "charades", "quiz", "secretword", "impostor", "mostlikely", "truthdare", "twotruths", "hangman", "tictactoe", "checkers", "telephone", "spies"]>;
        isPublic: z.ZodBoolean;
        maxPlayers: z.ZodNumber;
        /** narrador com IA comenta o fim da partida */
        narrator: z.ZodDefault<z.ZodBoolean>;
        /** esconde palavrões no chat */
        chatFilter: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies";
        isPublic: boolean;
        maxPlayers: number;
        narrator: boolean;
        chatFilter: boolean;
    }, {
        name: string;
        gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies";
        isPublic: boolean;
        maxPlayers: number;
        narrator?: boolean | undefined;
        chatFilter?: boolean | undefined;
    }>;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    settings: {
        name: string;
        gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies";
        isPublic: boolean;
        maxPlayers: number;
        narrator: boolean;
        chatFilter: boolean;
    };
    password?: string | undefined;
}, {
    settings: {
        name: string;
        gameId: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies";
        isPublic: boolean;
        maxPlayers: number;
        narrator?: boolean | undefined;
        chatFilter?: boolean | undefined;
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
export declare const REACTIONS: readonly ["😂", "👏", "🔥", "😮", "😡", "❤️"];
export declare const reactionSchema: z.ZodObject<{
    emoji: z.ZodEnum<["😂", "👏", "🔥", "😮", "😡", "❤️"]>;
}, "strip", z.ZodTypeAny, {
    emoji: "😂" | "👏" | "🔥" | "😮" | "😡" | "❤️";
}, {
    emoji: "😂" | "👏" | "🔥" | "😮" | "😡" | "❤️";
}>;
export declare const spectateSchema: z.ZodObject<{
    on: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    on: boolean;
}, {
    on: boolean;
}>;
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
        gameId: z.ZodOptional<z.ZodEnum<["stop", "draw", "charades", "quiz", "secretword", "impostor", "mostlikely", "truthdare", "twotruths", "hangman", "tictactoe", "checkers", "telephone", "spies"]>>;
        isPublic: z.ZodOptional<z.ZodBoolean>;
        maxPlayers: z.ZodOptional<z.ZodNumber>;
        narrator: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        chatFilter: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        gameId?: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies" | undefined;
        isPublic?: boolean | undefined;
        maxPlayers?: number | undefined;
        narrator?: boolean | undefined;
        chatFilter?: boolean | undefined;
    }, {
        name?: string | undefined;
        gameId?: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies" | undefined;
        isPublic?: boolean | undefined;
        maxPlayers?: number | undefined;
        narrator?: boolean | undefined;
        chatFilter?: boolean | undefined;
    }>>;
    /** "" remove a senha */
    password: z.ZodOptional<z.ZodString>;
    game: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    password?: string | undefined;
    room?: {
        name?: string | undefined;
        gameId?: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies" | undefined;
        isPublic?: boolean | undefined;
        maxPlayers?: number | undefined;
        narrator?: boolean | undefined;
        chatFilter?: boolean | undefined;
    } | undefined;
    game?: Record<string, unknown> | undefined;
}, {
    password?: string | undefined;
    room?: {
        name?: string | undefined;
        gameId?: "stop" | "draw" | "charades" | "quiz" | "secretword" | "impostor" | "mostlikely" | "truthdare" | "twotruths" | "hangman" | "tictactoe" | "checkers" | "telephone" | "spies" | undefined;
        isPublic?: boolean | undefined;
        maxPlayers?: number | undefined;
        narrator?: boolean | undefined;
        chatFilter?: boolean | undefined;
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
    /** locais criados pelo anfitrião ou pela IA (tema personalizado) */
    customLocations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        roles: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        roles: string[];
    }, {
        name: string;
        roles: string[];
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    rounds: number;
    discussionSeconds: number;
    voteSeconds: number;
    customLocations: {
        name: string;
        roles: string[];
    }[];
}, {
    rounds: number;
    discussionSeconds: number;
    voteSeconds: number;
    customLocations?: {
        name: string;
        roles: string[];
    }[] | undefined;
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
export declare const QUIZ_CATEGORIES: readonly ["misto", "geral", "ciencia", "geografia", "historia", "esportes", "entretenimento", "anime", "games", "musica", "futebol", "personalizado"];
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];
export declare const customQuestionSchema: z.ZodObject<{
    q: z.ZodString;
    a: z.ZodString;
    w: z.ZodTuple<[z.ZodString, z.ZodString, z.ZodString], null>;
}, "strip", z.ZodTypeAny, {
    q: string;
    a: string;
    w: [string, string, string];
}, {
    q: string;
    a: string;
    w: [string, string, string];
}>;
export type CustomQuestion = z.infer<typeof customQuestionSchema>;
/** Lista de textos personalizados (palavras, frases), sem repetidos. */
export declare const customListSchema: (max: number, len: number) => z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodString, "many">>, string[], string[] | undefined>;
export declare const quizSettingsSchema: z.ZodObject<{
    questions: z.ZodNumber;
    secondsPerQuestion: z.ZodNumber;
    category: z.ZodEnum<["misto", "geral", "ciencia", "geografia", "historia", "esportes", "entretenimento", "anime", "games", "musica", "futebol", "personalizado"]>;
    /** perguntas criadas pelo anfitrião (tema personalizado) */
    customQuestions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        q: z.ZodString;
        a: z.ZodString;
        w: z.ZodTuple<[z.ZodString, z.ZodString, z.ZodString], null>;
    }, "strip", z.ZodTypeAny, {
        q: string;
        a: string;
        w: [string, string, string];
    }, {
        q: string;
        a: string;
        w: [string, string, string];
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    category: "misto" | "geral" | "ciencia" | "geografia" | "historia" | "esportes" | "entretenimento" | "anime" | "games" | "musica" | "futebol" | "personalizado";
    questions: number;
    secondsPerQuestion: number;
    customQuestions: {
        q: string;
        a: string;
        w: [string, string, string];
    }[];
}, {
    category: "misto" | "geral" | "ciencia" | "geografia" | "historia" | "esportes" | "entretenimento" | "anime" | "games" | "musica" | "futebol" | "personalizado";
    questions: number;
    secondsPerQuestion: number;
    customQuestions?: {
        q: string;
        a: string;
        w: [string, string, string];
    }[] | undefined;
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
export declare const WORD_CATEGORIES: readonly ["misto", "animais", "comidas", "objetos", "lugares", "profissoes", "acoes", "anime", "games", "musica", "futebol", "personalizado"];
export type WordCategory = (typeof WORD_CATEGORIES)[number];
export declare const guessSettingsSchema: z.ZodObject<{
    rounds: z.ZodNumber;
    turnSeconds: z.ZodNumber;
    category: z.ZodEnum<["misto", "animais", "comidas", "objetos", "lugares", "profissoes", "acoes", "anime", "games", "musica", "futebol", "personalizado"]>;
    /** revela letras da palavra ao longo do tempo */
    letterHints: z.ZodBoolean;
    /** só Palavra Secreta: máximo de dicas por vez */
    maxClues: z.ZodNumber;
    /** palavras do anfitrião (tema personalizado) */
    customWords: z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodString, "many">>, string[], string[] | undefined>;
}, "strip", z.ZodTypeAny, {
    rounds: number;
    category: "misto" | "anime" | "games" | "musica" | "futebol" | "personalizado" | "animais" | "comidas" | "objetos" | "lugares" | "profissoes" | "acoes";
    turnSeconds: number;
    letterHints: boolean;
    maxClues: number;
    customWords: string[];
}, {
    rounds: number;
    category: "misto" | "anime" | "games" | "musica" | "futebol" | "personalizado" | "animais" | "comidas" | "objetos" | "lugares" | "profissoes" | "acoes";
    turnSeconds: number;
    letterHints: boolean;
    maxClues: number;
    customWords?: string[] | undefined;
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
    w: number;
    t: "s";
    id: string;
    c: string;
    p: number[];
    e?: boolean | undefined;
}, {
    w: number;
    t: "s";
    id: string;
    c: string;
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
    w: number;
    t: "sh";
    id: string;
    c: string;
    p: [number, number, number, number];
    k: "line" | "rect" | "ellipse";
    f: boolean;
}, {
    w: number;
    t: "sh";
    id: string;
    c: string;
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
        w: number;
        t: "s";
        id: string;
        c: string;
        p: number[];
        e?: boolean | undefined;
    }, {
        w: number;
        t: "s";
        id: string;
        c: string;
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
        w: number;
        t: "sh";
        id: string;
        c: string;
        p: [number, number, number, number];
        k: "line" | "rect" | "ellipse";
        f: boolean;
    }, {
        w: number;
        t: "sh";
        id: string;
        c: string;
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
        w: number;
        t: "s";
        id: string;
        c: string;
        p: number[];
        e?: boolean | undefined;
    } | {
        t: "a";
        id: string;
        p: number[];
    } | {
        w: number;
        t: "sh";
        id: string;
        c: string;
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
        w: number;
        t: "s";
        id: string;
        c: string;
        p: number[];
        e?: boolean | undefined;
    } | {
        t: "a";
        id: string;
        p: number[];
    } | {
        w: number;
        t: "sh";
        id: string;
        c: string;
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
    avatar: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    nickname: string;
    avatar?: string | undefined;
}, {
    password: string;
    email: string;
    nickname: string;
    avatar?: string | undefined;
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
export declare const mostLikelySettingsSchema: z.ZodObject<{
    rounds: z.ZodNumber;
    voteSeconds: z.ZodNumber;
    customPrompts: z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodString, "many">>, string[], string[] | undefined>;
    onlyCustom: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    rounds: number;
    voteSeconds: number;
    customPrompts: string[];
    onlyCustom: boolean;
}, {
    rounds: number;
    voteSeconds: number;
    customPrompts?: string[] | undefined;
    onlyCustom?: boolean | undefined;
}>;
export type MostLikelySettings = z.infer<typeof mostLikelySettingsSchema>;
export declare const mostLikelyActionSchema: z.ZodObject<{
    type: z.ZodLiteral<"vote">;
    targetId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "vote";
    targetId: string;
}, {
    type: "vote";
    targetId: string;
}>;
export type MostLikelyAction = z.infer<typeof mostLikelyActionSchema>;
export declare const truthDareSettingsSchema: z.ZodObject<{
    turnsPerPlayer: z.ZodNumber;
    performSeconds: z.ZodNumber;
    customTruths: z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodString, "many">>, string[], string[] | undefined>;
    customDares: z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodString, "many">>, string[], string[] | undefined>;
    onlyCustom: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    onlyCustom: boolean;
    turnsPerPlayer: number;
    performSeconds: number;
    customTruths: string[];
    customDares: string[];
}, {
    turnsPerPlayer: number;
    performSeconds: number;
    onlyCustom?: boolean | undefined;
    customTruths?: string[] | undefined;
    customDares?: string[] | undefined;
}>;
export type TruthDareSettings = z.infer<typeof truthDareSettingsSchema>;
export declare const truthDareActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"choose">;
    pick: z.ZodEnum<["truth", "dare"]>;
}, "strip", z.ZodTypeAny, {
    type: "choose";
    pick: "truth" | "dare";
}, {
    type: "choose";
    pick: "truth" | "dare";
}>, z.ZodObject<{
    type: z.ZodLiteral<"done">;
}, "strip", z.ZodTypeAny, {
    type: "done";
}, {
    type: "done";
}>, z.ZodObject<{
    type: z.ZodLiteral<"skip">;
}, "strip", z.ZodTypeAny, {
    type: "skip";
}, {
    type: "skip";
}>, z.ZodObject<{
    type: z.ZodLiteral<"judge">;
    ok: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    type: "judge";
    ok: boolean;
}, {
    type: "judge";
    ok: boolean;
}>]>;
export type TruthDareAction = z.infer<typeof truthDareActionSchema>;
export declare const twoTruthsSettingsSchema: z.ZodObject<{
    rounds: z.ZodNumber;
    writeSeconds: z.ZodNumber;
    guessSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    rounds: number;
    writeSeconds: number;
    guessSeconds: number;
}, {
    rounds: number;
    writeSeconds: number;
    guessSeconds: number;
}>;
export type TwoTruthsSettings = z.infer<typeof twoTruthsSettingsSchema>;
export declare const twoTruthsActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"submit">;
    statements: z.ZodTuple<[z.ZodString, z.ZodString, z.ZodString], null>;
    lie: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "submit";
    statements: [string, string, string];
    lie: number;
}, {
    type: "submit";
    statements: [string, string, string];
    lie: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"guess">;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "guess";
    index: number;
}, {
    type: "guess";
    index: number;
}>]>;
export type TwoTruthsAction = z.infer<typeof twoTruthsActionSchema>;
export declare const AI_KINDS: readonly ["quiz", "words", "locations", "mostlikely", "truths", "dares"];
export type AiKind = (typeof AI_KINDS)[number];
export declare const aiGenerateSchema: z.ZodObject<{
    kind: z.ZodEnum<["quiz", "words", "locations", "mostlikely", "truths", "dares"]>;
    theme: z.ZodString;
}, "strip", z.ZodTypeAny, {
    theme: string;
    kind: "quiz" | "mostlikely" | "words" | "locations" | "truths" | "dares";
}, {
    theme: string;
    kind: "quiz" | "mostlikely" | "words" | "locations" | "truths" | "dares";
}>;
export declare const REPORT_REASONS: readonly ["ofensa", "palavrao", "spam", "trapaca", "nome_improprio", "outro"];
export declare const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string>;
export declare const reportSchema: z.ZodObject<{
    targetId: z.ZodString;
    roomCode: z.ZodOptional<z.ZodString>;
    reason: z.ZodEnum<["ofensa", "palavrao", "spam", "trapaca", "nome_improprio", "outro"]>;
    details: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    targetId: string;
    reason: "ofensa" | "palavrao" | "spam" | "trapaca" | "nome_improprio" | "outro";
    details: string;
    roomCode?: string | undefined;
}, {
    targetId: string;
    reason: "ofensa" | "palavrao" | "spam" | "trapaca" | "nome_improprio" | "outro";
    roomCode?: string | undefined;
    details?: string | undefined;
}>;
export declare const hangmanSettingsSchema: z.ZodObject<{
    rounds: z.ZodNumber;
    turnSeconds: z.ZodNumber;
    lives: z.ZodNumber;
    category: z.ZodEnum<["misto", "animais", "comidas", "objetos", "lugares", "profissoes", "acoes", "anime", "games", "musica", "futebol", "personalizado"]>;
    customWords: z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodString, "many">>, string[], string[] | undefined>;
}, "strip", z.ZodTypeAny, {
    rounds: number;
    category: "misto" | "anime" | "games" | "musica" | "futebol" | "personalizado" | "animais" | "comidas" | "objetos" | "lugares" | "profissoes" | "acoes";
    turnSeconds: number;
    customWords: string[];
    lives: number;
}, {
    rounds: number;
    category: "misto" | "anime" | "games" | "musica" | "futebol" | "personalizado" | "animais" | "comidas" | "objetos" | "lugares" | "profissoes" | "acoes";
    turnSeconds: number;
    lives: number;
    customWords?: string[] | undefined;
}>;
export type HangmanSettings = z.infer<typeof hangmanSettingsSchema>;
export declare const hangmanActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"letter">;
    letter: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "letter";
    letter: string;
}, {
    type: "letter";
    letter: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"word">;
    word: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "word";
    word: string;
}, {
    type: "word";
    word: string;
}>]>;
export type HangmanAction = z.infer<typeof hangmanActionSchema>;
export declare const ticTacToeSettingsSchema: z.ZodObject<{
    games: z.ZodNumber;
    turnSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    games: number;
    turnSeconds: number;
}, {
    games: number;
    turnSeconds: number;
}>;
export type TicTacToeSettings = z.infer<typeof ticTacToeSettingsSchema>;
export declare const ticTacToeActionSchema: z.ZodObject<{
    type: z.ZodLiteral<"mark">;
    cell: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mark";
    cell: number;
}, {
    type: "mark";
    cell: number;
}>;
export type TicTacToeAction = z.infer<typeof ticTacToeActionSchema>;
export declare const checkersSettingsSchema: z.ZodObject<{
    games: z.ZodNumber;
    turnSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    games: number;
    turnSeconds: number;
}, {
    games: number;
    turnSeconds: number;
}>;
export type CheckersSettings = z.infer<typeof checkersSettingsSchema>;
/** Caminho da jogada: casa de origem e as casas por onde passa (índices 0–63). */
export declare const checkersActionSchema: z.ZodObject<{
    type: z.ZodLiteral<"move">;
    path: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    path: number[];
    type: "move";
}, {
    path: number[];
    type: "move";
}>;
export type CheckersAction = z.infer<typeof checkersActionSchema>;
export declare const telephoneSettingsSchema: z.ZodObject<{
    writeSeconds: z.ZodNumber;
    drawSeconds: z.ZodNumber;
    /** passos por caderno (0 = um por jogador) */
    steps: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    writeSeconds: number;
    drawSeconds: number;
    steps: number;
}, {
    writeSeconds: number;
    drawSeconds: number;
    steps: number;
}>;
export type TelephoneSettings = z.infer<typeof telephoneSettingsSchema>;
export declare const telephoneActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "text";
    text: string;
}, {
    type: "text";
    text: string;
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
        w: number;
        t: "s";
        id: string;
        c: string;
        p: number[];
        e?: boolean | undefined;
    }, {
        w: number;
        t: "s";
        id: string;
        c: string;
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
        w: number;
        t: "sh";
        id: string;
        c: string;
        p: [number, number, number, number];
        k: "line" | "rect" | "ellipse";
        f: boolean;
    }, {
        w: number;
        t: "sh";
        id: string;
        c: string;
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
        w: number;
        t: "s";
        id: string;
        c: string;
        p: number[];
        e?: boolean | undefined;
    } | {
        t: "a";
        id: string;
        p: number[];
    } | {
        w: number;
        t: "sh";
        id: string;
        c: string;
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
        w: number;
        t: "s";
        id: string;
        c: string;
        p: number[];
        e?: boolean | undefined;
    } | {
        t: "a";
        id: string;
        p: number[];
    } | {
        w: number;
        t: "sh";
        id: string;
        c: string;
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
    type: z.ZodLiteral<"done">;
}, "strip", z.ZodTypeAny, {
    type: "done";
}, {
    type: "done";
}>, z.ZodObject<{
    type: z.ZodLiteral<"like">;
    book: z.ZodNumber;
    entry: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "like";
    book: number;
    entry: number;
}, {
    type: "like";
    book: number;
    entry: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"next">;
}, "strip", z.ZodTypeAny, {
    type: "next";
}, {
    type: "next";
}>]>;
export type TelephoneAction = z.infer<typeof telephoneActionSchema>;
export declare const spiesSettingsSchema: z.ZodObject<{
    games: z.ZodNumber;
    clueSeconds: z.ZodNumber;
    guessSeconds: z.ZodNumber;
    category: z.ZodEnum<["misto", "animais", "comidas", "objetos", "lugares", "profissoes", "acoes", "anime", "games", "musica", "futebol", "personalizado"]>;
    customWords: z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodString, "many">>, string[], string[] | undefined>;
}, "strip", z.ZodTypeAny, {
    category: "misto" | "anime" | "games" | "musica" | "futebol" | "personalizado" | "animais" | "comidas" | "objetos" | "lugares" | "profissoes" | "acoes";
    games: number;
    customWords: string[];
    guessSeconds: number;
    clueSeconds: number;
}, {
    category: "misto" | "anime" | "games" | "musica" | "futebol" | "personalizado" | "animais" | "comidas" | "objetos" | "lugares" | "profissoes" | "acoes";
    games: number;
    guessSeconds: number;
    clueSeconds: number;
    customWords?: string[] | undefined;
}>;
export type SpiesSettings = z.infer<typeof spiesSettingsSchema>;
export declare const spiesActionSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"clue">;
    word: z.ZodString;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "clue";
    word: string;
    count: number;
}, {
    type: "clue";
    word: string;
    count: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"reveal">;
    card: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "reveal";
    card: number;
}, {
    type: "reveal";
    card: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"pass">;
}, "strip", z.ZodTypeAny, {
    type: "pass";
}, {
    type: "pass";
}>]>;
export type SpiesAction = z.infer<typeof spiesActionSchema>;
