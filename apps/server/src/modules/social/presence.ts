/**
 * Quem está conectado agora (por conta), para mostrar amigos online e entregar convites.
 * Mantido pelo gateway Socket.IO.
 */
export class Presence {
  private sockets = new Map<string, Set<string>>();
  private emitFn: ((socketId: string, event: string, payload: unknown) => void) | null = null;

  bind(emit: (socketId: string, event: string, payload: unknown) => void) {
    this.emitFn = emit;
  }

  add(userId: string, socketId: string) {
    const set = this.sockets.get(userId) ?? new Set();
    set.add(socketId);
    this.sockets.set(userId, set);
  }

  remove(userId: string, socketId: string) {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (!set.size) this.sockets.delete(userId);
  }

  socketsOf(userId: string) {
    return [...(this.sockets.get(userId) ?? [])];
  }

  isOnline(userId: string) {
    return this.sockets.has(userId);
  }

  get count() {
    return this.sockets.size;
  }

  /** Envia para todas as abas/aparelhos da pessoa. Retorna se havia alguém para receber. */
  emitToUser(userId: string, event: string, payload: unknown) {
    const set = this.sockets.get(userId);
    if (!set || !this.emitFn) return false;
    for (const sid of set) this.emitFn(sid, event, payload);
    return true;
  }
}
