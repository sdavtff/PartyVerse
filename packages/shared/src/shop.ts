/**
 * Loja: molduras de avatar, cores de nome e títulos, comprados com moedas ganhas jogando.
 * O que a pessoa está usando vai junto do código do avatar ("c-xxxxxx.f3.n2.t1"),
 * assim aparece para todos na sala sem consultas extras.
 */
export type ShopKind = 'frame' | 'name' | 'title';
export interface ShopItem {
  id: string; // ex.: "f3"
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

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'f1', kind: 'frame', name: 'Moldura Prata', price: 120, colors: ['#e5e7eb', '#9ca3af'] },
  { id: 'f2', kind: 'frame', name: 'Moldura Ouro', price: 250, colors: ['#ffe08a', '#e8b923'] },
  { id: 'f3', kind: 'frame', name: 'Moldura Neon', price: 300, colors: ['#c6f432', '#5cc8ff'] },
  { id: 'f4', kind: 'frame', name: 'Moldura Fogo', price: 350, colors: ['#ffd23f', '#ff5c2b'] },
  { id: 'f5', kind: 'frame', name: 'Moldura Gelo', price: 350, colors: ['#e0f7ff', '#5cc8ff'] },
  { id: 'f6', kind: 'frame', name: 'Moldura Corações', price: 400, colors: ['#ffb3d1', '#ff5fa2'] },
  { id: 'f7', kind: 'frame', name: 'Moldura Galáxia', price: 500, colors: ['#a98bff', '#1b2550'] },
  {
    id: 'f8',
    kind: 'frame',
    name: 'Moldura Arco-íris',
    price: 600,
    colors: ['#ff5c5c', '#ffd23f', '#2ecc71', '#5cc8ff', '#a98bff'],
  },
  {
    id: 'f9',
    kind: 'frame',
    name: 'Troféu da Semana',
    price: 0,
    prizeOnly: true,
    colors: ['#fff3b0', '#e8b923'],
  },
  { id: 'n1', kind: 'name', name: 'Nome Dourado', price: 150, colors: ['#ffd23f'] },
  { id: 'n2', kind: 'name', name: 'Nome Rosa', price: 120, colors: ['#ff5fa2'] },
  { id: 'n3', kind: 'name', name: 'Nome Céu', price: 120, colors: ['#5cc8ff'] },
  { id: 'n4', kind: 'name', name: 'Nome Limão', price: 120, colors: ['#c6f432'] },
  {
    id: 'n5',
    kind: 'name',
    name: 'Nome Arco-íris',
    price: 400,
    colors: ['#ff5c5c', '#ffd23f', '#2ecc71', '#5cc8ff', '#a98bff'],
  },
  { id: 'n6', kind: 'name', name: 'Nome Fogo', price: 300, colors: ['#ffd23f', '#ff5c2b'] },
  { id: 't1', kind: 'title', name: 'Título "Rei da Festa"', price: 150, label: 'Rei da Festa' },
  {
    id: 't2',
    kind: 'title',
    name: 'Título "Rainha da Festa"',
    price: 150,
    label: 'Rainha da Festa',
  },
  { id: 't3', kind: 'title', name: 'Título "Artista"', price: 100, label: 'Artista' },
  { id: 't4', kind: 'title', name: 'Título "Detetive"', price: 100, label: 'Detetive' },
  { id: 't5', kind: 'title', name: 'Título "Gênio"', price: 200, label: 'Gênio' },
  { id: 't6', kind: 'title', name: 'Título "Caótico"', price: 80, label: 'Caótico' },
  { id: 't7', kind: 'title', name: 'Título "Sem Sorte"', price: 80, label: 'Sem Sorte' },
  { id: 't8', kind: 'title', name: 'Título "Lenda"', price: 500, label: 'Lenda' },
  {
    id: 't9',
    kind: 'title',
    name: 'Título "Campeão da Semana"',
    price: 0,
    prizeOnly: true,
    label: 'Campeão da Semana',
  },
];

export const shopItem = (id: string) => SHOP_ITEMS.find((i) => i.id === id);

export interface Cosmetics {
  frame?: string;
  name?: string;
  title?: string;
}

/** "c-abc123.f3.n2" → { base: "c-abc123", frame: "f3", name: "n2" } */
export function parseAvatar(avatar: string): { base: string } & Cosmetics {
  const [base = avatar, ...rest] = avatar.split('.');
  const out: { base: string } & Cosmetics = { base };
  for (const r of rest) {
    if (/^f\d{1,2}$/.test(r)) out.frame = r;
    else if (/^n\d{1,2}$/.test(r)) out.name = r;
    else if (/^t\d{1,2}$/.test(r)) out.title = r;
  }
  return out;
}

export function buildAvatar(base: string, c: Cosmetics) {
  return [base, c.frame, c.name, c.title].filter(Boolean).join('.');
}

/** Itens usados no avatar que a pessoa ainda não tem. */
export const missingItems = (avatar: string, owned: string[]) => {
  const c = parseAvatar(avatar);
  return [c.frame, c.name, c.title].filter((x): x is string => !!x && !owned.includes(x));
};

/** Moedas ganhas numa partida. */
export function matchCoins(place: number, players: number) {
  const bonus = place === 1 ? 10 : place === 2 ? 6 : place === 3 ? 3 : 0;
  return 5 + bonus + Math.min(5, Math.floor(players / 2));
}
export const DAILY_COINS = 15;
export const WEEKLY_PRIZES = [
  { place: 1, coins: 300, items: ['f9', 't9'] },
  { place: 2, coins: 200, items: [] as string[] },
  { place: 3, coins: 100, items: [] as string[] },
];
