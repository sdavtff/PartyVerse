import { EVENTS, } from '@partyverse/shared';
import { AppError, forbidden, invalidState } from '../lib/errors.js';
import { uid } from '../lib/ids.js';
import { cleanText } from '../lib/text.js';
import { maskProfanity } from '../modules/moderation/profanity.js';
import { getGameModule } from '../games/registry.js';
const CHAT_HISTORY = 50;
const MAX_SPECTATORS = 50;
/** chat de voz é ponto a ponto (malha): acima disso a conexão de cada um sofre */
export const MAX_VOICE = 8;
const BOT_NAMES = [
    'Robô Zé',
    'Robô Lia',
    'Robô Caju',
    'Robô Pipoca',
    'Robô Tico',
    'Robô Nina',
    'Robô Biju',
    'Robô Fubá',
];
export class Room {
    code;
    settings;
    transport;
    hooks;
    opts;
    players = new Map();
    banned = new Set();
    /** Apelidos de quem já participou (para resultados mesmo após a saída). */
    known = new Map();
    phase = 'lobby';
    hostId;
    gameSettings;
    lastActivity;
    createdAt;
    chatLog = [];
    /** quem está no chat de voz (id -> microfone desligado?) */
    voice = new Map();
    game = null;
    gameState = null;
    matchStartedAt = 0;
    timers = new Map();
    lastResult = null;
    now;
    /** senha da sala ('' = sem senha) */
    password = '';
    constructor(code, settings, host, transport, hooks, opts) {
        this.code = code;
        this.settings = settings;
        this.transport = transport;
        this.hooks = hooks;
        this.opts = opts;
        this.now = opts.now ?? Date.now;
        this.createdAt = this.lastActivity = this.now();
        this.hostId = host.id;
        this.settings = { ...settings, name: maskProfanity(settings.name) };
        this.gameSettings = getGameModule(settings.gameId).defaultSettings();
    }
    // ---------- presença ----------
    get onlinePlayers() {
        return [...this.players.values()].filter((p) => p.status === 'online');
    }
    /** Jogadores que ocupam vaga (espectadores não contam). */
    get activeCount() {
        return [...this.players.values()].filter((p) => p.status !== 'left' && !p.spectator).length;
    }
    get spectatorCount() {
        return [...this.players.values()].filter((p) => p.spectator).length;
    }
    /** Entra (ou reconecta). Retorna true se for reconexão. */
    join(identity, socketId, password) {
        if (this.banned.has(identity.id))
            throw forbidden('Você foi removido desta sala pelo anfitrião');
        const existing = this.players.get(identity.id);
        // quem já está na sala (reconexão) não precisa digitar a senha de novo
        if (!existing && this.password && (password ?? '').trim() !== this.password)
            throw new AppError('PASSWORD_REQUIRED', password ? 'Senha incorreta' : 'Esta sala tem senha', 403);
        if (existing) {
            // reconexão ou segunda aba: a conexão mais recente assume o lugar
            const replaced = existing.socketId && existing.socketId !== socketId ? existing.socketId : null;
            if (existing.graceTimer)
                clearTimeout(existing.graceTimer);
            const wasAway = existing.status !== 'online';
            this.voice.delete(identity.id); // a página nova entra na voz de novo se quiser
            Object.assign(existing, {
                socketId,
                status: 'online',
                graceTimer: null,
                nickname: identity.nickname,
                avatar: identity.avatar,
            });
            this.touch();
            if (wasAway)
                this.systemMessage(`${existing.nickname} voltou`);
            this.broadcastState();
            this.sendPrivateStateTo(existing);
            return { reconnected: true, replacedSocket: replaced };
        }
        // sala cheia: entra como espectador (há um limite próprio para quem só assiste)
        const asSpectator = this.activeCount >= this.settings.maxPlayers;
        if (asSpectator && this.spectatorCount >= MAX_SPECTATORS)
            throw new AppError('ROOM_FULL', 'A sala está cheia', 409);
        const player = {
            ...identity,
            spectator: asSpectator,
            status: 'online',
            joinedAt: this.now(),
            socketId,
            graceTimer: null,
            recentActionIds: [],
        };
        this.players.set(identity.id, player);
        this.known.set(identity.id, {
            nickname: identity.nickname,
            avatar: identity.avatar,
            isGuest: identity.isGuest,
        });
        if (!this.players.has(this.hostId))
            this.hostId = identity.id;
        this.touch();
        this.systemMessage(asSpectator
            ? `${identity.nickname} entrou para assistir (sala cheia)`
            : `${identity.nickname} entrou`);
        this.broadcastState();
        this.sendPrivateStateTo(player);
        return { reconnected: false, replacedSocket: null };
    }
    /** Conexão caiu: mantém o lugar durante o período de graça. */
    disconnect(playerId, socketId) {
        const p = this.players.get(playerId);
        if (!p || p.socketId !== socketId)
            return; // socket antigo (já substituído)
        p.status = 'reconnecting';
        p.socketId = null;
        this.voice.delete(playerId);
        p.graceTimer = setTimeout(() => this.remove(playerId, 'timeout'), this.opts.reconnectGraceMs);
        p.graceTimer.unref?.();
        this.systemMessage(`${p.nickname} perdeu a conexão…`);
        this.broadcastState();
        this.onPresenceChanged(playerId);
    }
    leave(playerId) {
        this.remove(playerId, 'left');
    }
    remove(playerId, reason) {
        const p = this.players.get(playerId);
        if (!p)
            return;
        if (p.graceTimer)
            clearTimeout(p.graceTimer);
        if (p.socketId)
            this.transport.disconnectFromRoom(p.socketId, this.code);
        this.players.delete(playerId);
        this.voice.delete(playerId);
        const verb = reason === 'kicked'
            ? 'foi removido pelo anfitrião'
            : reason === 'timeout'
                ? 'não voltou e saiu'
                : 'saiu';
        this.systemMessage(`${p.nickname} ${verb}`);
        // só bots sobraram: a sala acaba
        if (![...this.players.values()].some((x) => !x.bot)) {
            this.players.clear();
            this.destroy();
            this.hooks.onEmpty(this);
            return;
        }
        if (this.hostId === playerId)
            this.reassignHost();
        this.broadcastState();
        this.onPresenceChanged(playerId);
    }
    /**
     * Regra do anfitrião: se ele sai (ou não reconecta a tempo), a liderança passa para
     * o jogador online mais antigo; se ninguém estiver online, para o mais antigo da sala.
     */
    reassignHost() {
        const candidates = [...this.players.values()]
            .filter((p) => !p.bot)
            .sort((a, b) => a.joinedAt - b.joinedAt);
        const next = candidates.find((c) => c.status === 'online') ?? candidates[0];
        if (next) {
            this.hostId = next.id;
            this.systemMessage(`${next.nickname} agora é o anfitrião`);
        }
    }
    onPresenceChanged(playerId) {
        if (this.phase !== 'playing' || !this.game)
            return;
        const ctx = this.ctx();
        this.game.onPlayerLeft?.(this.gameState, playerId, ctx);
        // sem adversários suficientes conectados, a partida é encerrada (com resultado)
        const stillIn = [...this.players.values()].filter((p) => p.status !== 'left' && this.game.isParticipant(this.gameState, p.id));
        // jogos solo (ex.: Forca) seguem com 1 pessoa; os demais precisam de 2
        if (this.phase === 'playing' && stillIn.length < Math.min(2, this.game.minPlayers)) {
            this.systemMessage('Jogadores insuficientes: partida encerrada');
            this.endMatch(true);
        }
    }
    // ---------- ações do anfitrião ----------
    requireHost(playerId) {
        if (playerId !== this.hostId)
            throw forbidden('Apenas o anfitrião pode fazer isso');
    }
    kick(actorId, targetId) {
        this.requireHost(actorId);
        if (actorId === targetId)
            throw new AppError('VALIDATION', 'Você não pode remover a si mesmo');
        const target = this.players.get(targetId);
        if (!target)
            throw new AppError('NOT_FOUND', 'Jogador não encontrado', 404);
        this.banned.add(targetId);
        if (target.socketId)
            this.transport.toPlayer(target.socketId, EVENTS.ROOM_KICKED, { code: this.code });
        this.remove(targetId, 'kicked');
    }
    /** Remove alguém sem exigir anfitrião (moderação). */
    expel(targetId) {
        const target = this.players.get(targetId);
        if (!target)
            return;
        this.banned.add(targetId);
        if (target.socketId)
            this.transport.toPlayer(target.socketId, EVENTS.ROOM_KICKED, { code: this.code });
        this.remove(targetId, 'kicked');
    }
    /** Fecha a sala para todos (moderação). */
    closeAll() {
        for (const id of [...this.players.keys()])
            this.expel(id);
        this.destroy();
    }
    /** Resumo para o painel de administração. */
    adminSummary() {
        return {
            code: this.code,
            name: this.settings.name,
            gameId: this.settings.gameId,
            phase: this.phase,
            isPublic: this.settings.isPublic,
            hostId: this.hostId,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity,
            players: [...this.players.values()].map((p) => ({
                id: p.id,
                nickname: p.nickname,
                status: p.status,
                isGuest: this.isGuestPlayer(p.id),
            })),
        };
    }
    transferHost(actorId, targetId) {
        this.requireHost(actorId);
        const target = this.players.get(targetId);
        if (!target || target.status !== 'online' || target.bot)
            throw new AppError('VALIDATION', 'Escolha um jogador conectado');
        this.hostId = targetId;
        this.systemMessage(`${target.nickname} agora é o anfitrião`);
        this.touch();
        this.broadcastState();
    }
    updateSettings(actorId, room, game, password) {
        this.requireHost(actorId);
        if (password !== undefined)
            this.password = password.trim();
        if (this.phase === 'playing')
            throw invalidState('Não é possível alterar durante a partida');
        if (room) {
            const next = { ...this.settings, ...room };
            next.name = maskProfanity(next.name);
            if (next.maxPlayers < this.activeCount)
                throw new AppError('VALIDATION', 'Limite menor que o número de jogadores na sala');
            if (next.gameId !== this.settings.gameId)
                this.gameSettings = getGameModule(next.gameId).defaultSettings();
            this.settings = next;
            if (!getGameModule(next.gameId).bot)
                this.removeBots();
        }
        if (game) {
            const mod = getGameModule(this.settings.gameId);
            this.gameSettings = mod.settingsSchema.parse({ ...this.gameSettings, ...game });
        }
        this.touch();
        this.broadcastState();
    }
    start(actorId) {
        this.requireHost(actorId);
        if (this.phase === 'playing')
            throw invalidState('A partida já começou');
        const mod = getGameModule(this.settings.gameId);
        const online = this.onlinePlayers.filter((p) => !p.spectator);
        if (online.length < mod.minPlayers)
            throw invalidState(`São necessários pelo menos ${mod.minPlayers} jogadores conectados`);
        const settings = mod.settingsSchema.parse(this.gameSettings);
        this.game = mod;
        this.gameState = mod.createInitialState(online.map((p) => ({ id: p.id, nickname: p.nickname })), settings);
        this.phase = 'playing';
        this.matchStartedAt = this.now();
        this.lastResult = null;
        for (const p of this.players.values())
            p.recentActionIds = [];
        this.touch();
        this.systemMessage('A partida começou!');
        this.broadcastState();
        mod.startRound(this.gameState, this.ctx());
    }
    /** Anfitrião encerra a partida antes do fim (sem registrar resultado). */
    endByHost(actorId) {
        this.requireHost(actorId);
        if (this.phase !== 'playing')
            throw invalidState('Nenhuma partida em andamento');
        this.systemMessage('O anfitrião encerrou a partida');
        this.endMatch(false);
    }
    backToLobby(actorId) {
        this.requireHost(actorId);
        if (this.phase === 'playing')
            throw invalidState('Encerre a partida primeiro');
        this.phase = 'lobby';
        this.lastResult = null;
        this.game = null;
        this.gameState = null;
        this.touch();
        this.broadcastState();
        this.transport.toRoom(this.code, EVENTS.GAME_STATE, null);
    }
    /** Anfitrião coloca um jogador do computador (só nos jogos que aceitam). */
    addBot(actorId) {
        this.requireHost(actorId);
        if (this.phase === 'playing')
            throw invalidState('Espere a partida acabar');
        const mod = getGameModule(this.settings.gameId);
        if (!mod.bot)
            throw new AppError('VALIDATION', 'Este jogo não tem bots');
        if (this.activeCount >= this.settings.maxPlayers)
            throw new AppError('ROOM_FULL', 'A sala está cheia', 409);
        const used = new Set([...this.players.values()].map((p) => p.nickname));
        const nickname = BOT_NAMES.find((n) => !used.has(n));
        if (!nickname)
            throw new AppError('VALIDATION', 'Bots demais nesta sala');
        const id = `bot-${uid().slice(0, 10)}`;
        const avatar = `bot-${BOT_NAMES.indexOf(nickname) + 1}`;
        this.players.set(id, {
            id,
            nickname,
            avatar,
            isGuest: true,
            spectator: false,
            status: 'online',
            joinedAt: this.now(),
            socketId: null,
            graceTimer: null,
            recentActionIds: [],
            bot: true,
        });
        this.known.set(id, { nickname, avatar, isGuest: true });
        this.touch();
        this.systemMessage(`🤖 ${nickname} entrou para jogar`);
        this.broadcastState();
        return { id };
    }
    removeBots() {
        for (const p of [...this.players.values()])
            if (p.bot)
                this.players.delete(p.id);
    }
    /** Bots decidem a jogada com um atraso "humano"; reavaliam quando o estado muda. */
    scheduleBots() {
        if (this.phase !== 'playing' || !this.game?.bot)
            return;
        for (const p of this.players.values()) {
            if (!p.bot)
                continue;
            const key = `bot:${p.id}`;
            if (this.timers.has(key))
                continue;
            const plan = this.game.bot(this.gameState, p.id);
            if (!plan)
                continue;
            const t = setTimeout(() => {
                this.timers.delete(key);
                if (this.phase !== 'playing' || !this.game?.bot || !this.players.has(p.id))
                    return;
                const now = this.game.bot(this.gameState, p.id);
                if (now) {
                    try {
                        this.gameAction(p.id, now.action);
                    }
                    catch {
                        /* jogada recusada: tenta de novo na próxima mudança */
                    }
                }
                this.scheduleBots();
            }, Math.max(150, plan.delayMs));
            t.unref?.();
            this.timers.set(key, t);
        }
    }
    // ---------- chat de voz (o servidor só repassa a sinalização WebRTC) ----------
    voiceJoin(playerId) {
        const p = this.players.get(playerId);
        if (!p || p.bot)
            throw forbidden('Você não está nesta sala');
        if (!this.voice.has(playerId) && this.voice.size >= MAX_VOICE)
            throw new AppError('ROOM_FULL', `O chat de voz aceita até ${MAX_VOICE} pessoas`, 409);
        if (!this.voice.has(playerId))
            this.voice.set(playerId, false);
        this.broadcastState();
        return { peers: [...this.voice.keys()].filter((id) => id !== playerId) };
    }
    voiceLeave(playerId) {
        if (this.voice.delete(playerId))
            this.broadcastState();
    }
    voiceMute(playerId, muted) {
        if (!this.voice.has(playerId))
            return;
        this.voice.set(playerId, muted);
        this.broadcastState();
    }
    voiceSignal(from, to, data) {
        if (!this.voice.has(from) || !this.voice.has(to) || from === to)
            throw invalidState('Essa pessoa não está no chat de voz');
        this.sendToPlayer(to, EVENTS.VOICE_SIGNAL, { from, data });
    }
    /** Alterna "só assistir". */
    setSpectator(playerId, on) {
        const p = this.players.get(playerId);
        if (!p)
            throw forbidden('Você não está nesta sala');
        if (p.spectator === on)
            return;
        if (!on && this.activeCount >= this.settings.maxPlayers)
            throw new AppError('ROOM_FULL', 'Não há vaga para jogar agora', 409);
        p.spectator = on;
        this.touch();
        this.systemMessage(on ? `${p.nickname} vai só assistir` : `${p.nickname} voltou a jogar`);
        this.broadcastState();
    }
    /** Reação rápida (emoji voando na tela de todos). */
    react(playerId, emoji) {
        if (!this.players.has(playerId))
            throw forbidden('Você não está nesta sala');
        this.transport.toRoom(this.code, EVENTS.REACTION, { playerId, emoji, at: this.now() });
    }
    /** Jogador conectado nesta sala? */
    hasOnline(playerId) {
        return this.players.get(playerId)?.status === 'online';
    }
    // ---------- jogo e chat ----------
    gameAction(playerId, raw, actionId) {
        if (this.phase !== 'playing' || !this.game)
            throw invalidState('Nenhuma partida em andamento');
        const p = this.players.get(playerId);
        if (!p)
            throw forbidden('Você não está nesta sala');
        if (actionId) {
            if (p.recentActionIds.includes(actionId))
                return; // repetição: ignora sem efeito
            p.recentActionIds.push(actionId);
            if (p.recentActionIds.length > 100)
                p.recentActionIds.shift();
        }
        const action = this.game.validateAction(this.gameState, playerId, raw);
        this.touch();
        this.game.processAction(this.gameState, playerId, action, this.ctx());
    }
    sticker(playerId, sticker) {
        const p = this.players.get(playerId);
        if (!p)
            throw forbidden('Você não está nesta sala');
        this.touch();
        this.pushChat({
            id: uid(),
            playerId,
            nickname: p.nickname,
            text: '',
            sticker,
            at: this.now(),
            kind: 'sticker',
        });
    }
    chat(playerId, text) {
        const p = this.players.get(playerId);
        if (!p)
            throw forbidden('Você não está nesta sala');
        const clean = cleanText(text).slice(0, 300);
        if (!clean)
            return;
        this.touch();
        if (this.phase === 'playing' && this.game?.onChat) {
            if (this.game.onChat(this.gameState, playerId, clean, this.ctx()).consumed)
                return;
        }
        this.pushChat({
            id: uid(),
            playerId,
            nickname: p.nickname,
            text: this.settings.chatFilter === false ? clean : maskProfanity(clean),
            at: this.now(),
            kind: 'chat',
        });
    }
    /** Mensagem do narrador (IA) no chat. */
    narrate(text) {
        this.pushChat({
            id: uid(),
            playerId: null,
            nickname: '🎙️ Narrador',
            text,
            at: this.now(),
            kind: 'guess-correct',
        });
    }
    /** Últimas mensagens de alguém (anexadas a uma denúncia). */
    recentChatOf(playerId, limit = 10) {
        return this.chatLog
            .filter((m) => m.playerId === playerId)
            .slice(-limit)
            .map((m) => ({ text: m.text, at: m.at }));
    }
    systemMessage(text) {
        this.pushChat({
            id: uid(),
            playerId: null,
            nickname: 'PartyVerse',
            text,
            at: this.now(),
            kind: 'system',
        });
    }
    /** Mensagem fora do histórico público: entregue só a alguns jogadores. */
    sendTo(ids, m) {
        for (const id of new Set(ids)) {
            const sid = this.players.get(id)?.socketId;
            if (sid)
                this.transport.toPlayer(sid, EVENTS.CHAT_MESSAGE, m);
        }
    }
    pushChat(m) {
        this.chatLog.push(m);
        if (this.chatLog.length > CHAT_HISTORY)
            this.chatLog.shift();
        this.transport.toRoom(this.code, EVENTS.CHAT_MESSAGE, m);
    }
    // ---------- estado público / privado ----------
    toPublic() {
        const scores = this.game && this.gameState ? this.game.calculateScores(this.gameState) : {};
        return {
            code: this.code,
            settings: this.settings,
            password: this.password || null,
            gameSettings: publicGameSettings(this.gameSettings),
            phase: this.phase,
            hostId: this.hostId,
            createdAt: this.createdAt,
            players: [...this.players.values()]
                .sort((a, b) => a.joinedAt - b.joinedAt)
                .map((p) => ({
                id: p.id,
                nickname: p.nickname,
                avatar: p.avatar,
                isHost: p.id === this.hostId,
                status: p.status,
                isGuest: p.isGuest,
                score: scores[p.id] ?? 0,
                spectator: p.spectator,
                ...(p.bot ? { isBot: true } : {}),
                voice: this.voice.has(p.id) ? (this.voice.get(p.id) ? 'muted' : 'on') : null,
            })),
        };
    }
    broadcastState() {
        this.transport.toRoom(this.code, EVENTS.ROOM_STATE, this.toPublic());
    }
    /** Envia ao jogador recém-chegado tudo o que ele precisa para retomar. */
    sendPrivateStateTo(p) {
        if (!p.socketId)
            return;
        this.transport.toPlayer(p.socketId, EVENTS.CHAT_HISTORY, this.chatLog);
        if (this.game && this.gameState)
            this.transport.toPlayer(p.socketId, EVENTS.GAME_STATE, this.viewOf(p.id));
        if (this.lastResult)
            this.transport.toPlayer(p.socketId, EVENTS.GAME_RESULT, this.lastResult);
    }
    syncGame() {
        if (!this.game || !this.gameState)
            return;
        for (const p of this.players.values()) {
            if (p.socketId)
                this.transport.toPlayer(p.socketId, EVENTS.GAME_STATE, this.viewOf(p.id));
        }
        this.broadcastState(); // placar no painel de jogadores
        this.scheduleBots();
    }
    /** Visão do jogo para um jogador + relógio do servidor (o cliente corrige a diferença de horário). */
    viewOf(playerId) {
        const viewer = this.game.isParticipant(this.gameState, playerId) ? playerId : null;
        const view = this.game.viewFor(this.gameState, viewer);
        return { ...view, serverNow: this.now() };
    }
    ctx() {
        return {
            now: this.now,
            setTimer: (name, ms, fn) => {
                const old = this.timers.get(name);
                if (old)
                    clearTimeout(old);
                const t = setTimeout(() => {
                    this.timers.delete(name);
                    try {
                        fn();
                    }
                    catch {
                        /* um erro em temporizador nunca derruba o servidor */
                    }
                }, ms);
                t.unref?.();
                this.timers.set(name, t);
            },
            clearTimer: (name) => {
                const t = this.timers.get(name);
                if (t)
                    clearTimeout(t);
                this.timers.delete(name);
            },
            sync: () => this.syncGame(),
            notice: (text) => this.systemMessage(text),
            announce: (text, kind) => this.pushChat({
                id: uid(),
                playerId: null,
                nickname: 'PartyVerse',
                text,
                at: this.now(),
                kind,
            }),
            whisper: (playerId, text, kind = 'whisper') => this.sendTo([playerId], {
                id: uid(),
                playerId: null,
                nickname: 'PartyVerse',
                text,
                at: this.now(),
                kind,
            }),
            chatTo: (fromId, text, recipients) => {
                const from = this.players.get(fromId);
                this.sendTo(recipients, {
                    id: uid(),
                    playerId: fromId,
                    nickname: from?.nickname ?? 'Jogador',
                    text,
                    at: this.now(),
                    kind: 'chat',
                });
            },
            emit: (payload, except) => {
                for (const pl of this.players.values())
                    if (pl.socketId && pl.id !== except)
                        this.transport.toPlayer(pl.socketId, EVENTS.GAME_EVENT, payload);
            },
            nickname: (id) => this.players.get(id)?.nickname ?? this.known.get(id)?.nickname ?? 'Alguém',
            isOnline: (id) => this.players.get(id)?.status === 'online',
            inRoom: (id) => this.players.has(id),
            finish: () => this.endMatch(true),
            ai: this.opts.ai,
        };
    }
    clearTimers() {
        for (const t of this.timers.values())
            clearTimeout(t);
        this.timers.clear();
    }
    endMatch(record) {
        if (this.phase !== 'playing' || !this.game)
            return;
        this.clearTimers();
        const mod = this.game;
        const state = this.gameState;
        if (!record) {
            this.phase = 'lobby';
            this.game = null;
            this.gameState = null;
            this.broadcastState();
            this.transport.toRoom(this.code, EVENTS.GAME_STATE, null);
            return;
        }
        const scores = mod.calculateScores(state);
        const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const ranking = ordered.map(([playerId, score]) => {
            const info = this.players.get(playerId) ?? this.known.get(playerId);
            return {
                playerId,
                nickname: info?.nickname ?? 'Jogador',
                avatar: info?.avatar ?? 'blob-1',
                score,
                place: 1 + ordered.filter(([, s]) => s > score).length, // empates dividem a posição
            };
        });
        const result = { ranking, gameId: mod.id, endedAt: this.now() };
        this.lastResult = result;
        this.phase = 'results';
        this.syncGame();
        this.transport.toRoom(this.code, EVENTS.GAME_RESULT, result);
        let highlights = {};
        try {
            highlights = mod.highlights?.(state) ?? {};
        }
        catch {
            /* destaques são opcionais */
        }
        this.hooks.onMatchEnd(this, result, this.matchStartedAt, mod.finalize(state).rounds, highlights);
    }
    /** Evento direto para um jogador (se estiver conectado). */
    sendToPlayer(playerId, event, payload) {
        const sid = this.players.get(playerId)?.socketId;
        if (sid)
            this.transport.toPlayer(sid, event, payload);
    }
    nicknameOf(id) {
        return this.players.get(id)?.nickname ?? this.known.get(id)?.nickname ?? 'Alguém';
    }
    isGuestPlayer(id) {
        return this.known.get(id)?.isGuest ?? true;
    }
    touch() {
        this.lastActivity = this.now();
    }
    destroy() {
        this.clearTimers();
        for (const p of this.players.values())
            if (p.graceTimer)
                clearTimeout(p.graceTimer);
    }
}
/**
 * Listas personalizadas (palavras, perguntas) não vão para todos: estragariam o jogo.
 * No lugar, a sala informa só quantos itens existem (ex.: customWordsCount).
 */
export function publicGameSettings(gs) {
    const out = {};
    for (const [k, v] of Object.entries(gs)) {
        if (k.startsWith('custom') && Array.isArray(v)) {
            out[k] = [];
            out[`${k}Count`] = v.length;
        }
        else
            out[k] = v;
    }
    return out;
}
