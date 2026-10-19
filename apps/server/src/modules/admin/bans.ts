/** Contas suspensas, em memória para checagem rápida a cada conexão/requisição. */
export class BanList {
  private ids = new Set<string>();
  load(ids: string[]) {
    this.ids = new Set(ids);
  }
  set(id: string, banned: boolean) {
    if (banned) this.ids.add(id);
    else this.ids.delete(id);
  }
  has(id: string) {
    return this.ids.has(id);
  }
}
