/**
 * Quem está conectado agora (por conta), para mostrar amigos online e entregar convites.
 * Mantido pelo gateway Socket.IO.
 */
export class Presence {
    sockets = new Map();
    emitFn = null;
    bind(emit) {
        this.emitFn = emit;
    }
    add(userId, socketId) {
        const set = this.sockets.get(userId) ?? new Set();
        set.add(socketId);
        this.sockets.set(userId, set);
    }
    remove(userId, socketId) {
        const set = this.sockets.get(userId);
        if (!set)
            return;
        set.delete(socketId);
        if (!set.size)
            this.sockets.delete(userId);
    }
    socketsOf(userId) {
        return [...(this.sockets.get(userId) ?? [])];
    }
    isOnline(userId) {
        return this.sockets.has(userId);
    }
    get count() {
        return this.sockets.size;
    }
    /** Envia para todas as abas/aparelhos da pessoa. Retorna se havia alguém para receber. */
    emitToUser(userId, event, payload) {
        const set = this.sockets.get(userId);
        if (!set || !this.emitFn)
            return false;
        for (const sid of set)
            this.emitFn(sid, event, payload);
        return true;
    }
}
