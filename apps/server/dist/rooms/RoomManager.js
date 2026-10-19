import { achievementByCode, EVENTS, } from '@partyverse/shared';
import { AppError, notFound } from '../lib/errors.js';
import { roomCode } from '../lib/ids.js';
import { logger } from '../lib/logger.js';
import { isGameAvailable } from '../games/registry.js';
import { Room } from './Room.js';
/**
 * Gerencia salas em memória. Para várias instâncias, substitua por uma implementação
 * apoiada em Redis (estado + adaptador Socket.IO) mantendo esta interface.
 */
export class RoomManager {
    transport;
    matches;
    opts;
    progress;
    rooms = new Map();
    sweeper;
    constructor(transport, matches, opts, progress) {
        this.transport = transport;
        this.matches = matches;
        this.opts = opts;
        this.progress = progress;
        this.sweeper = setInterval(() => this.sweepIdle(), Math.min(60_000, opts.idleTtlMs));
        this.sweeper.unref?.();
    }
    create(host, settings, password = '') {
        if (!isGameAvailable(settings.gameId))
            throw new AppError('VALIDATION', 'Este jogo ainda não está disponível');
        if (this.rooms.size >= (this.opts.maxRooms ?? 5000))
            throw new AppError('INTERNAL', 'Servidor lotado, tente mais tarde', 503);
        let code = roomCode();
        for (let i = 0; this.rooms.has(code); i++) {
            if (i > 50)
                throw new AppError('INTERNAL', 'Não foi possível gerar um código', 500);
            code = roomCode();
        }
        const room = new Room(code, settings, host, this.transport, {
            onEmpty: (r) => this.rooms.delete(r.code),
            onMatchEnd: (r, result, startedAt, rounds, highlights) => void this.persist(r, result, startedAt, rounds, highlights),
        }, { reconnectGraceMs: this.opts.reconnectGraceMs });
        room.password = password.trim();
        this.rooms.set(code, room);
        return room;
    }
    get(code) {
        const r = this.rooms.get(code.toUpperCase());
        if (!r)
            throw notFound('Sala não encontrada. Confira o código.');
        return r;
    }
    find(code) {
        return this.rooms.get(code.toUpperCase());
    }
    listPublic() {
        return [...this.rooms.values()]
            .filter((r) => r.settings.isPublic && r.activeCount > 0 && r.activeCount < r.settings.maxPlayers)
            .sort((a, b) => b.lastActivity - a.lastActivity)
            .slice(0, 30)
            .map((r) => ({
            code: r.code,
            name: r.settings.name,
            gameId: r.settings.gameId,
            players: r.activeCount,
            maxPlayers: r.settings.maxPlayers,
            phase: r.phase,
            hasPassword: Boolean(r.password),
        }));
    }
    get size() {
        return this.rooms.size;
    }
    get onlineCount() {
        let n = 0;
        for (const r of this.rooms.values())
            n += r.onlinePlayers.length;
        return n;
    }
    /** Política: remove salas sem ninguém online e sem atividade há mais de idleTtlMs. */
    sweepIdle(now = Date.now()) {
        for (const r of this.rooms.values()) {
            const idle = now - r.lastActivity > this.opts.idleTtlMs;
            if (idle && r.onlinePlayers.length === 0) {
                r.destroy();
                this.rooms.delete(r.code);
                logger.info({ code: r.code }, 'sala inativa removida');
            }
        }
    }
    async persist(room, result, startedAt, rounds, highlights) {
        const saved = await this.matches
            .save({
            gameId: result.gameId,
            roomCode: room.code,
            rounds,
            startedAt: new Date(startedAt),
            endedAt: new Date(result.endedAt),
            participants: result.ranking.map((r) => {
                const guest = room.isGuestPlayer(r.playerId);
                return {
                    userId: guest ? null : r.playerId,
                    nickname: r.nickname,
                    score: r.score,
                    place: r.place,
                    isGuest: guest,
                };
            }),
        })
            .then(() => true)
            .catch((err) => {
            logger.error({ err: String(err) }, 'falha ao salvar partida');
            return false;
        });
        if (!saved || !this.progress)
            return;
        const registered = result.ranking.filter((r) => !room.isGuestPlayer(r.playerId));
        if (!registered.length)
            return;
        const rewards = await this.progress.award({
            gameId: result.gameId,
            players: result.ranking.length,
            participants: registered.map((r) => ({ userId: r.playerId, place: r.place })),
            highlights,
        });
        for (const [userId, reward] of rewards) {
            room.sendToPlayer(userId, EVENTS.REWARD, reward);
            for (const code of reward.achievements) {
                const a = achievementByCode(code);
                if (a)
                    room.systemMessage(`🏆 ${room.nicknameOf(userId)} desbloqueou "${a.name}"`);
            }
            if (reward.leveledUp)
                room.systemMessage(`⭐ ${room.nicknameOf(userId)} subiu para o nível ${reward.level}!`);
        }
    }
    shutdown() {
        clearInterval(this.sweeper);
        for (const r of this.rooms.values())
            r.destroy();
        this.rooms.clear();
    }
}
