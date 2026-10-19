/** Contas suspensas, em memória para checagem rápida a cada conexão/requisição. */
export class BanList {
    ids = new Set();
    load(ids) {
        this.ids = new Set(ids);
    }
    set(id, banned) {
        if (banned)
            this.ids.add(id);
        else
            this.ids.delete(id);
    }
    has(id) {
        return this.ids.has(id);
    }
}
