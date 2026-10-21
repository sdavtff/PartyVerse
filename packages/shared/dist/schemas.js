import { z } from 'zod';
export const GAME_IDS = [
    'stop',
    'draw',
    'charades',
    'quiz',
    'secretword',
    'impostor',
    'mostlikely',
    'truthdare',
    'twotruths',
];
export const nicknameSchema = z
    .string()
    .trim()
    .min(2, 'Apelido muito curto')
    .max(20, 'Apelido muito longo')
    .regex(/^[\p{L}\p{N} _.-]+$/u, 'Use apenas letras, números, espaço, _ . -');
export const roomCodeSchema = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NP-Z2-9]{6}$/, 'Código inválido');
export const stopSettingsSchema = z.object({
    categories: z.array(z.string().trim().min(2).max(24)).min(2).max(10),
    rounds: z.number().int().min(1).max(10),
    roundSeconds: z.number().int().min(30).max(300),
    reviewSeconds: z.number().int().min(15).max(180),
    stopCountdownSeconds: z.number().int().min(0).max(15),
    points: z.object({
        unique: z.number().int().min(0).max(50),
        repeated: z.number().int().min(0).max(50),
        empty: z.number().int().min(0).max(50),
        rejected: z.number().int().min(0).max(50),
    }),
    /** a IA marca respostas suspeitas na revisão (vale como um voto) */
    aiJudge: z.boolean().default(false),
});
export const MAX_ROOM_PLAYERS = 50;
export const roomSettingsSchema = z.object({
    name: z.string().trim().min(2).max(40),
    gameId: z.enum(GAME_IDS),
    isPublic: z.boolean(),
    maxPlayers: z.number().int().min(2).max(MAX_ROOM_PLAYERS),
    /** narrador com IA comenta o fim da partida */
    narrator: z.boolean().default(true),
    /** esconde palavrões no chat */
    chatFilter: z.boolean().default(true),
});
/** Avatar: formato antigo "forma-n" ou montado no criador "c-xxxxxx" (6 partes em base 36). */
export const avatarSchema = z.string().regex(/^([a-z]+-[0-9]{1,2}|c-[0-9a-z]{6})$/);
export const roomPasswordSchema = z.string().trim().max(20);
/** Figurinhas do chat (desenhos originais do PartyVerse). */
export const STICKERS = [
    'risada',
    'amei',
    'bravo',
    'chorando',
    'uau',
    'estiloso',
    'festa',
    'pensando',
    'dormindo',
    'joinha',
    'lingua',
    'medo',
];
export const createRoomSchema = z.object({
    settings: roomSettingsSchema,
    password: roomPasswordSchema.optional(),
});
export const joinRoomSchema = z.object({
    code: roomCodeSchema,
    password: roomPasswordSchema.optional(),
});
export const chatSchema = z.union([
    z.object({ text: z.string().trim().min(1).max(300) }),
    z.object({ sticker: z.enum(STICKERS) }),
]);
export const REACTIONS = ['😂', '👏', '🔥', '😮', '😡', '❤️'];
export const reactionSchema = z.object({ emoji: z.enum(REACTIONS) });
export const spectateSchema = z.object({ on: z.boolean() });
export const kickSchema = z.object({ playerId: z.string().min(1).max(64) });
export const transferHostSchema = kickSchema;
export const updateSettingsSchema = z.object({
    room: roomSettingsSchema.partial().optional(),
    /** "" remove a senha */
    password: roomPasswordSchema.optional(),
    game: z.record(z.unknown()).optional(),
});
export const stopActionSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('answers'),
        answers: z.record(z.string().max(40)),
    }),
    z.object({ type: z.literal('stop') }),
    z.object({
        type: z.literal('vote'),
        targetId: z.string().min(1).max(64),
        category: z.string().max(24),
        valid: z.boolean(),
    }),
    z.object({ type: z.literal('ready') }),
]);
// ---------- Impostor ----------
export const impostorSettingsSchema = z.object({
    rounds: z.number().int().min(1).max(10),
    discussionSeconds: z.number().int().min(60).max(600),
    voteSeconds: z.number().int().min(15).max(120),
    /** locais criados pelo anfitrião ou pela IA (tema personalizado) */
    customLocations: z
        .array(z.object({
        name: z.string().trim().min(2).max(30),
        roles: z.array(z.string().trim().min(2).max(30)).min(3).max(8),
    }))
        .max(30)
        .default([]),
});
export const impostorActionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('ready') }),
    z.object({ type: z.literal('callVote') }),
    z.object({ type: z.literal('vote'), targetId: z.string().min(1).max(64) }),
    z.object({ type: z.literal('guess'), location: z.string().min(1).max(40) }),
]);
// ---------- Quiz ----------
export const QUIZ_CATEGORIES = [
    'misto',
    'geral',
    'ciencia',
    'geografia',
    'historia',
    'esportes',
    'entretenimento',
    'anime',
    'games',
    'musica',
    'futebol',
    'personalizado',
];
export const customQuestionSchema = z.object({
    q: z.string().trim().min(3).max(160),
    a: z.string().trim().min(1).max(60),
    w: z.tuple([
        z.string().trim().min(1).max(60),
        z.string().trim().min(1).max(60),
        z.string().trim().min(1).max(60),
    ]),
});
/** Lista de textos personalizados (palavras, frases), sem repetidos. */
export const customListSchema = (max, len) => z
    .array(z.string().trim().min(2).max(len))
    .max(max)
    .default([])
    .transform((xs) => [...new Set(xs)]);
export const quizSettingsSchema = z.object({
    questions: z.number().int().min(5).max(20),
    secondsPerQuestion: z.number().int().min(8).max(30),
    category: z.enum(QUIZ_CATEGORIES),
    /** perguntas criadas pelo anfitrião (tema personalizado) */
    customQuestions: z.array(customQuestionSchema).max(60).default([]),
});
export const quizActionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('answer'), option: z.number().int().min(0).max(3) }),
]);
// ---------- jogos de adivinhar (Rabisco, Mímica, Palavra Secreta) ----------
export const WORD_CATEGORIES = [
    'misto',
    'animais',
    'comidas',
    'objetos',
    'lugares',
    'profissoes',
    'acoes',
    'anime',
    'games',
    'musica',
    'futebol',
    'personalizado',
];
export const guessSettingsSchema = z.object({
    rounds: z.number().int().min(1).max(5),
    turnSeconds: z.number().int().min(30).max(240),
    category: z.enum(WORD_CATEGORIES),
    /** revela letras da palavra ao longo do tempo */
    letterHints: z.boolean(),
    /** só Palavra Secreta: máximo de dicas por vez */
    maxClues: z.number().int().min(1).max(10),
    /** palavras do anfitrião (tema personalizado) */
    customWords: customListSchema(200, 30),
});
/** Coordenadas do desenho: canvas lógico de 800×600, inteiros. */
const coord = z.number().int().min(-50).max(850);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const points = z.array(coord).max(600);
export const drawOpSchema = z.discriminatedUnion('t', [
    /** começa um traço (lápis ou borracha) */
    z.object({
        t: z.literal('s'),
        id: z.string().min(1).max(16),
        c: color,
        w: z.number().int().min(1).max(60),
        e: z.boolean().optional(),
        p: points,
    }),
    /** continua um traço */
    z.object({ t: z.literal('a'), id: z.string().min(1).max(16), p: points }),
    /** forma pronta */
    z.object({
        t: z.literal('sh'),
        id: z.string().min(1).max(16),
        k: z.enum(['line', 'rect', 'ellipse']),
        c: color,
        w: z.number().int().min(1).max(60),
        f: z.boolean(),
        p: z.tuple([coord, coord, coord, coord]),
    }),
    /** balde de tinta */
    z.object({ t: z.literal('f'), id: z.string().min(1).max(16), c: color, x: coord, y: coord }),
    z.object({ t: z.literal('u') }),
    z.object({ t: z.literal('clear') }),
]);
export const guessActionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('choose'), index: z.number().int().min(0).max(2) }),
    z.object({ type: z.literal('draw'), ops: z.array(drawOpSchema).min(1).max(40) }),
    z.object({ type: z.literal('clue'), text: z.string().trim().min(1).max(30) }),
    z.object({ type: z.literal('giveUp') }),
]);
export const gameActionSchema = z.object({
    action: z.unknown(),
    /** id opcional gerado pelo cliente para deduplicar ações repetidas */
    actionId: z.string().max(64).optional(),
});
export const registerSchema = z.object({
    email: z.string().trim().email('E-mail inválido').max(120, 'E-mail muito longo'),
    password: z
        .string()
        .min(8, 'A senha precisa ter pelo menos 8 caracteres')
        .max(100, 'Senha muito longa'),
    nickname: nicknameSchema,
    avatar: z
        .string()
        .regex(/^([a-z]+-[0-9]{1,2}|c-[0-9a-z]{6})$/)
        .optional(),
});
export const loginSchema = z.object({
    email: z.string().trim().email('E-mail inválido').max(120),
    password: z.string().min(1, 'Digite sua senha').max(100),
});
export const guestSchema = z.object({ nickname: nicknameSchema, avatar: avatarSchema.optional() });
export const profileUpdateSchema = z.object({
    nickname: nicknameSchema.optional(),
    avatar: avatarSchema.optional(),
    preferences: z
        .object({ sound: z.boolean(), reducedMotion: z.boolean(), theme: z.enum(['dark', 'light']) })
        .partial()
        .optional(),
});
// ---------- Quem é mais provável ----------
export const mostLikelySettingsSchema = z.object({
    rounds: z.number().int().min(3).max(20),
    voteSeconds: z.number().int().min(10).max(60),
    customPrompts: customListSchema(100, 100),
    onlyCustom: z.boolean().default(false),
});
export const mostLikelyActionSchema = z.object({
    type: z.literal('vote'),
    targetId: z.string().min(1).max(64),
});
// ---------- Verdade ou Desafio ----------
export const truthDareSettingsSchema = z.object({
    turnsPerPlayer: z.number().int().min(1).max(3),
    performSeconds: z.number().int().min(30).max(180),
    customTruths: customListSchema(100, 140),
    customDares: customListSchema(100, 140),
    onlyCustom: z.boolean().default(false),
});
export const truthDareActionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('choose'), pick: z.enum(['truth', 'dare']) }),
    z.object({ type: z.literal('done') }),
    z.object({ type: z.literal('skip') }),
    z.object({ type: z.literal('judge'), ok: z.boolean() }),
]);
// ---------- Duas verdades e uma mentira ----------
export const twoTruthsSettingsSchema = z.object({
    rounds: z.number().int().min(1).max(3),
    writeSeconds: z.number().int().min(60).max(300),
    guessSeconds: z.number().int().min(10).max(60),
});
const statement = z.string().trim().min(3).max(90);
export const twoTruthsActionSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('submit'),
        statements: z.tuple([statement, statement, statement]),
        lie: z.number().int().min(0).max(2),
    }),
    z.object({ type: z.literal('guess'), index: z.number().int().min(0).max(2) }),
]);
// ---------- IA nas salas ----------
export const AI_KINDS = ['quiz', 'words', 'locations', 'mostlikely', 'truths', 'dares'];
export const aiGenerateSchema = z.object({
    kind: z.enum(AI_KINDS),
    theme: z.string().trim().min(2, 'Escreva um tema').max(60, 'Tema muito longo'),
});
// ---------- denúncias ----------
export const REPORT_REASONS = [
    'ofensa',
    'palavrao',
    'spam',
    'trapaca',
    'nome_improprio',
    'outro',
];
export const REPORT_REASON_LABELS = {
    ofensa: 'Ofensa ou assédio',
    palavrao: 'Palavrões',
    spam: 'Spam / flood',
    trapaca: 'Trapaça',
    nome_improprio: 'Nome ou avatar impróprio',
    outro: 'Outro motivo',
};
export const reportSchema = z.object({
    targetId: z.string().min(1).max(64),
    roomCode: z.string().max(8).optional(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(300).default(''),
});
