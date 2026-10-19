import {
  EVENTS,
  chatSchema,
  createRoomSchema,
  gameActionSchema,
  joinRoomSchema,
  kickSchema,
  reactionSchema,
  spectateSchema,
  transferHostSchema,
  updateSettingsSchema,
  type Ack,
} from '@partyverse/shared';
import type { Server, Socket } from 'socket.io';
import type { ZodType } from 'zod';
import { AppError, toServerError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { RateLimiter } from '../lib/rateLimiter.js';
import {
  readCookie,
  TOKEN_COOKIE,
  type Identity,
  type TokenService,
} from '../modules/auth/token.js';
import type { Presence } from '../modules/social/presence.js';
import type { Room, RoomTransport } from '../rooms/Room.js';
import type { RoomManager } from '../rooms/RoomManager.js';

interface SocketData {
  identity: Identity;
  roomCode: string | null;
}
type PvSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

export const roomChannel = (code: string) => `room:${code}`;

export function createTransport(io: Server): RoomTransport {
  return {
    toPlayer: (socketId, event, payload) => io.to(socketId).emit(event, payload),
    toRoom: (code, event, payload) => io.to(roomChannel(code)).emit(event, payload),
    disconnectFromRoom: (socketId, code) => {
      const s = io.sockets.sockets.get(socketId) as PvSocket | undefined;
      if (!s) return;
      s.leave(roomChannel(code));
      if (s.data.roomCode === code) s.data.roomCode = null;
    },
  };
}

/** Limites de frequência por socket (capacidade, recarga por segundo). */
const limits = {
  chat: new RateLimiter(5, 1),
  // generoso para o desenho (traços chegam em lotes de ~60 ms)
  game: new RateLimiter(60, 30),
  room: new RateLimiter(10, 1),
};

export function attachGateway(
  io: Server,
  rooms: RoomManager,
  tokens: TokenService,
  presence?: Presence,
) {
  presence?.bind((sid, event, payload) => io.to(sid).emit(event, payload));
  io.use((socket, next) => {
    const token =
      (typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : undefined) ?? readCookie(socket.handshake.headers.cookie, TOKEN_COOKIE);
    const identity = token ? tokens.verify(token) : null;
    if (!identity) return next(new Error('UNAUTHORIZED'));
    (socket as PvSocket).data.identity = identity;
    (socket as PvSocket).data.roomCode = null;
    next();
  });

  io.on('connection', (raw) => {
    const socket = raw as PvSocket;
    const me = () => socket.data.identity;
    if (!me().isGuest) presence?.add(me().id, socket.id);

    /** Envolve um handler: rate limit + validação Zod + ack padronizado + erros tratados. */
    function on<T>(
      event: string,
      bucket: keyof typeof limits,
      schema: ZodType<T>,
      fn: (data: T) => unknown,
    ) {
      socket.on(
        event as never,
        ((payload: unknown, ack?: (r: Ack) => void) => {
          const reply = typeof ack === 'function' ? ack : () => undefined;
          if (!limits[bucket].take(`${socket.id}:${bucket}`)) {
            return reply({
              ok: false,
              error: { code: 'RATE_LIMITED', message: 'Calma! Muitas ações em pouco tempo.' },
            });
          }
          try {
            const data = schema.parse(payload ?? {});
            reply({ ok: true, data: fn(data) ?? null });
          } catch (err) {
            if (!(err instanceof AppError) && err?.constructor?.name !== 'ZodError') {
              logger.error({ err: String(err), event }, 'erro no handler');
            }
            reply({ ok: false, error: toServerError(err) });
          }
        }) as never,
      );
    }

    const currentRoom = (): Room => {
      const code = socket.data.roomCode;
      const room = code ? rooms.find(code) : undefined;
      if (!room || !room.players.has(me().id))
        throw new AppError('FORBIDDEN', 'Você não está em uma sala', 403);
      return room;
    };

    const enter = (room: Room, password?: string) => {
      if (socket.data.roomCode && socket.data.roomCode !== room.code) {
        rooms.find(socket.data.roomCode)?.leave(me().id);
      }
      socket.join(roomChannel(room.code));
      socket.data.roomCode = room.code;
      let replacedSocket: string | null;
      try {
        ({ replacedSocket } = room.join(me(), socket.id, password));
      } catch (err) {
        socket.leave(roomChannel(room.code));
        socket.data.roomCode = null;
        throw err;
      }
      if (replacedSocket) {
        io.to(replacedSocket).emit(EVENTS.NOTICE, {
          message: 'Você abriu esta sala em outra aba ou dispositivo.',
        });
        createTransport(io).disconnectFromRoom(replacedSocket, room.code);
      }
      return room.toPublic();
    };

    on(EVENTS.ROOM_CREATE, 'room', createRoomSchema, ({ settings, password }) =>
      enter(rooms.create(me(), settings, password), password),
    );
    on(EVENTS.ROOM_JOIN, 'room', joinRoomSchema, ({ code, password }) =>
      enter(rooms.get(code), password),
    );
    on(EVENTS.ROOM_LEAVE, 'room', joinRoomSchema.partial(), () => {
      const room = currentRoom();
      room.leave(me().id);
      socket.leave(roomChannel(room.code));
      socket.data.roomCode = null;
    });
    on(EVENTS.ROOM_KICK, 'room', kickSchema, ({ playerId }) =>
      currentRoom().kick(me().id, playerId),
    );
    on(EVENTS.ROOM_TRANSFER_HOST, 'room', transferHostSchema, ({ playerId }) =>
      currentRoom().transferHost(me().id, playerId),
    );
    on(EVENTS.ROOM_UPDATE_SETTINGS, 'room', updateSettingsSchema, ({ room, game, password }) =>
      currentRoom().updateSettings(me().id, room, game, password),
    );
    on(EVENTS.ROOM_START, 'room', joinRoomSchema.partial(), () => currentRoom().start(me().id));
    on(EVENTS.ROOM_END, 'room', joinRoomSchema.partial(), () => currentRoom().endByHost(me().id));
    on(EVENTS.ROOM_BACK_TO_LOBBY, 'room', joinRoomSchema.partial(), () =>
      currentRoom().backToLobby(me().id),
    );
    on(EVENTS.CHAT_SEND, 'chat', chatSchema, (msg) =>
      'sticker' in msg
        ? currentRoom().sticker(me().id, msg.sticker)
        : currentRoom().chat(me().id, msg.text),
    );
    on(EVENTS.GAME_ACTION, 'game', gameActionSchema, ({ action, actionId }) =>
      currentRoom().gameAction(me().id, action, actionId),
    );

    on(EVENTS.REACTION, 'chat', reactionSchema, ({ emoji }) => currentRoom().react(me().id, emoji));
    on(EVENTS.ROOM_SPECTATE, 'room', spectateSchema, ({ on: value }) =>
      currentRoom().setSpectator(me().id, value),
    );

    socket.on('disconnect', () => {
      if (!me().isGuest) presence?.remove(me().id, socket.id);
      const code = socket.data.roomCode;
      if (code) rooms.find(code)?.disconnect(me().id, socket.id);
      for (const l of Object.values(limits)) l.forget(socket.id);
    });
  });
}
