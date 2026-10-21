import { EVENTS, chatSchema, createRoomSchema, gameActionSchema, joinRoomSchema, kickSchema, reactionSchema, spectateSchema, transferHostSchema, updateSettingsSchema, voiceMuteSchema, voiceSignalSchema, } from '@partyverse/shared';
import { AppError, toServerError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { RateLimiter } from '../lib/rateLimiter.js';
import { readCookie, TOKEN_COOKIE, } from '../modules/auth/token.js';
export const roomChannel = (code) => `room:${code}`;
export function createTransport(io) {
    return {
        toPlayer: (socketId, event, payload) => io.to(socketId).emit(event, payload),
        toRoom: (code, event, payload) => io.to(roomChannel(code)).emit(event, payload),
        disconnectFromRoom: (socketId, code) => {
            const s = io.sockets.sockets.get(socketId);
            if (!s)
                return;
            s.leave(roomChannel(code));
            if (s.data.roomCode === code)
                s.data.roomCode = null;
        },
    };
}
/** Limites de frequência por socket (capacidade, recarga por segundo). */
const limits = {
    chat: new RateLimiter(5, 1),
    // generoso para o desenho (traços chegam em lotes de ~60 ms)
    game: new RateLimiter(60, 30),
    // sinalização WebRTC: rajadas de candidatos ICE ao conectar
    voice: new RateLimiter(80, 20),
    room: new RateLimiter(10, 1),
};
export function attachGateway(io, rooms, tokens, presence, bans) {
    presence?.bind((sid, event, payload) => io.to(sid).emit(event, payload));
    io.use((socket, next) => {
        const token = (typeof socket.handshake.auth?.token === 'string'
            ? socket.handshake.auth.token
            : undefined) ?? readCookie(socket.handshake.headers.cookie, TOKEN_COOKIE);
        const identity = token ? tokens.verify(token) : null;
        if (!identity)
            return next(new Error('UNAUTHORIZED'));
        if (bans?.has(identity.id))
            return next(new Error('BANNED'));
        socket.data.identity = identity;
        socket.data.roomCode = null;
        next();
    });
    io.on('connection', (raw) => {
        const socket = raw;
        const me = () => socket.data.identity;
        if (!me().isGuest)
            presence?.add(me().id, socket.id);
        /** Envolve um handler: rate limit + validação Zod + ack padronizado + erros tratados. */
        function on(event, bucket, schema, fn) {
            socket.on(event, ((payload, ack) => {
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
                }
                catch (err) {
                    if (!(err instanceof AppError) && err?.constructor?.name !== 'ZodError') {
                        logger.error({ err: String(err), event }, 'erro no handler');
                    }
                    reply({ ok: false, error: toServerError(err) });
                }
            }));
        }
        const currentRoom = () => {
            const code = socket.data.roomCode;
            const room = code ? rooms.find(code) : undefined;
            if (!room || !room.players.has(me().id))
                throw new AppError('FORBIDDEN', 'Você não está em uma sala', 403);
            return room;
        };
        const enter = (room, password) => {
            if (socket.data.roomCode && socket.data.roomCode !== room.code) {
                rooms.find(socket.data.roomCode)?.leave(me().id);
            }
            socket.join(roomChannel(room.code));
            socket.data.roomCode = room.code;
            let replacedSocket;
            try {
                ({ replacedSocket } = room.join(me(), socket.id, password));
            }
            catch (err) {
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
        on(EVENTS.ROOM_CREATE, 'room', createRoomSchema, ({ settings, password }) => enter(rooms.create(me(), settings, password), password));
        on(EVENTS.ROOM_JOIN, 'room', joinRoomSchema, ({ code, password }) => enter(rooms.get(code), password));
        on(EVENTS.ROOM_LEAVE, 'room', joinRoomSchema.partial(), () => {
            const room = currentRoom();
            room.leave(me().id);
            socket.leave(roomChannel(room.code));
            socket.data.roomCode = null;
        });
        on(EVENTS.ROOM_KICK, 'room', kickSchema, ({ playerId }) => currentRoom().kick(me().id, playerId));
        on(EVENTS.ROOM_TRANSFER_HOST, 'room', transferHostSchema, ({ playerId }) => currentRoom().transferHost(me().id, playerId));
        on(EVENTS.ROOM_UPDATE_SETTINGS, 'room', updateSettingsSchema, ({ room, game, password }) => currentRoom().updateSettings(me().id, room, game, password));
        on(EVENTS.ROOM_START, 'room', joinRoomSchema.partial(), () => currentRoom().start(me().id));
        on(EVENTS.ROOM_END, 'room', joinRoomSchema.partial(), () => currentRoom().endByHost(me().id));
        on(EVENTS.ROOM_BACK_TO_LOBBY, 'room', joinRoomSchema.partial(), () => currentRoom().backToLobby(me().id));
        on(EVENTS.CHAT_SEND, 'chat', chatSchema, (msg) => 'sticker' in msg
            ? currentRoom().sticker(me().id, msg.sticker)
            : currentRoom().chat(me().id, msg.text));
        on(EVENTS.GAME_ACTION, 'game', gameActionSchema, ({ action, actionId }) => currentRoom().gameAction(me().id, action, actionId));
        on(EVENTS.REACTION, 'chat', reactionSchema, ({ emoji }) => currentRoom().react(me().id, emoji));
        on(EVENTS.ROOM_SPECTATE, 'room', spectateSchema, ({ on: value }) => currentRoom().setSpectator(me().id, value));
        on(EVENTS.ROOM_ADD_BOT, 'room', joinRoomSchema.partial(), () => currentRoom().addBot(me().id));
        on(EVENTS.VOICE_JOIN, 'voice', joinRoomSchema.partial(), () => currentRoom().voiceJoin(me().id));
        on(EVENTS.VOICE_LEAVE, 'voice', joinRoomSchema.partial(), () => currentRoom().voiceLeave(me().id));
        on(EVENTS.VOICE_MUTE, 'voice', voiceMuteSchema, ({ muted }) => currentRoom().voiceMute(me().id, muted));
        on(EVENTS.VOICE_SIGNAL, 'voice', voiceSignalSchema, ({ to, data }) => currentRoom().voiceSignal(me().id, to, data));
        socket.on('disconnect', () => {
            if (!me().isGuest)
                presence?.remove(me().id, socket.id);
            const code = socket.data.roomCode;
            if (code)
                rooms.find(code)?.disconnect(me().id, socket.id);
            for (const l of Object.values(limits))
                l.forget(socket.id);
        });
    });
}
