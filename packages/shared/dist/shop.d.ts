/**
 * Loja: molduras de avatar, cores de nome e títulos, comprados com moedas ganhas jogando.
 * O que a pessoa está usando vai junto do código do avatar ("c-xxxxxx.f3.n2.t1"),
 * assim aparece para todos na sala sem consultas extras.
 */
export type ShopKind = 'frame' | 'name' | 'title';
export interface ShopItem {
    id: string;
    kind: ShopKind;
    name: string;
    price: number;
    /** só ganha como prêmio (não está à venda) */
    prizeOnly?: boolean;
    /** cores para desenhar (moldura/nome) */
    colors?: string[];
    /** texto do título */
    label?: string;
}
export declare const SHOP_ITEMS: ShopItem[];
export declare const shopItem: (id: string) => ShopItem | undefined;
export interface Cosmetics {
    frame?: string;
    name?: string;
    title?: string;
}
/** "c-abc123.f3.n2" → { base: "c-abc123", frame: "f3", name: "n2" } */
export declare function parseAvatar(avatar: string): {
    base: string;
} & Cosmetics;
export declare function buildAvatar(base: string, c: Cosmetics): string;
/** Itens usados no avatar que a pessoa ainda não tem. */
export declare const missingItems: (avatar: string, owned: string[]) => string[];
/** Moedas ganhas numa partida. */
export declare function matchCoins(place: number, players: number): number;
export declare const DAILY_COINS = 15;
export declare const WEEKLY_PRIZES: {
    place: number;
    coins: number;
    items: string[];
}[];
