import { z } from 'zod';

export const GAME_IDS = ['stop', 'draw', 'charades', 'quiz', 'secretword', 'impostor'] as const;
export type GameId = (typeof GAME_IDS)[number];

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
});
export type StopSettings = z.infer<typeof stopSettingsSchema>;

export const roomSettingsSchema = z.object({
  name: z.string().trim().min(2).max(40),
  gameId: z.enum(GAME_IDS),
  isPublic: z.boolean(),
  maxPlayers: z.number().int().min(2).max(16),
});
export type RoomSettings = z.infer<typeof roomSettingsSchema>;

export const createRoomSchema = z.object({
  settings: roomSettingsSchema,
});
export const joinRoomSchema = z.object({ code: roomCodeSchema });
export const chatSchema = z.object({ text: z.string().trim().min(1).max(300) });
export const kickSchema = z.object({ playerId: z.string().min(1).max(64) });
export const transferHostSchema = kickSchema;
export const updateSettingsSchema = z.object({
  room: roomSettingsSchema.partial().optional(),
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
export type StopAction = z.infer<typeof stopActionSchema>;

export const gameActionSchema = z.object({
  action: z.unknown(),
  /** id opcional gerado pelo cliente para deduplicar ações repetidas */
  actionId: z.string().max(64).optional(),
});

export const registerSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(100),
  nickname: nicknameSchema,
});
export const loginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(100),
});
export const guestSchema = z.object({ nickname: nicknameSchema });
export const profileUpdateSchema = z.object({
  nickname: nicknameSchema.optional(),
  avatar: z
    .string()
    .regex(/^[a-z]+-[0-9]{1,2}$/)
    .optional(),
  preferences: z
    .object({ sound: z.boolean(), reducedMotion: z.boolean(), theme: z.enum(['dark', 'light']) })
    .partial()
    .optional(),
});
