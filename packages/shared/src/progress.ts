/** Progresso do jogador: XP, níveis, conquistas e itens de avatar desbloqueáveis. */

/** XP total necessário para chegar ao nível `level` (nível 1 = 0 XP). Cresce devagar. */
export function xpForLevel(level: number): number {
  const n = Math.max(0, level - 1);
  return 50 * n * (n + 1); // 100, 300, 600, 1000…
}

export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xp, base, next, progress: (xp - base) / (next - base) };
}

/** XP ganho numa partida. */
export function matchXp(place: number, players: number): number {
  const placeBonus = place === 1 ? 30 : place === 2 ? 20 : place === 3 ? 10 : 0;
  return 20 + placeBonus + Math.min(20, players * 2);
}

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: 'first_match',
    name: 'Primeira partida',
    description: 'Jogue sua primeira partida.',
    icon: '🎮',
  },
  { code: 'first_win', name: 'Primeira vitória', description: 'Vença uma partida.', icon: '🏆' },
  {
    code: 'wins_10',
    name: 'Colecionador de vitórias',
    description: 'Vença 10 partidas.',
    icon: '🥇',
  },
  { code: 'matches_50', name: 'Veterano', description: 'Jogue 50 partidas.', icon: '🎖️' },
  {
    code: 'all_games',
    name: 'Eclético',
    description: 'Jogue todos os jogos ao menos uma vez.',
    icon: '🌈',
  },
  {
    code: 'big_room',
    name: 'Festa lotada',
    description: 'Jogue uma partida com 10 ou mais pessoas.',
    icon: '🎉',
  },
  {
    code: 'quiz_streak_5',
    name: 'Cérebro em chamas',
    description: 'Acerte 5 perguntas seguidas no Quiz.',
    icon: '🔥',
  },
  {
    code: 'quick_guesser',
    name: 'Olho de águia',
    description: 'Seja o primeiro a acertar 3 vezes numa partida de adivinhar.',
    icon: '🦅',
  },
  {
    code: 'master_artist',
    name: 'Artista de mão cheia',
    description: 'Desenhe/encene algo que todo mundo acertou.',
    icon: '🎨',
  },
  {
    code: 'impostor_escape',
    name: 'Mestre do disfarce',
    description: 'Escape ou adivinhe o local sendo o impostor.',
    icon: '🕵️',
  },
  {
    code: 'stop_unique_10',
    name: 'Original',
    description: 'Faça 10 respostas únicas numa partida de Adedonha.',
    icon: '💡',
  },
  {
    code: 'daily_done',
    name: 'Desafiante',
    description: 'Complete um desafio diário.',
    icon: '📅',
  },
  {
    code: 'first_friend',
    name: 'Bom de papo',
    description: 'Faça sua primeira amizade.',
    icon: '🤝',
  },
  { code: 'level_5', name: 'Subindo de nível', description: 'Chegue ao nível 5.', icon: '⭐' },
  {
    code: 'weekly_podium',
    name: 'Pódio da semana',
    description: 'Termine o torneio da semana entre os 3 primeiros.',
    icon: '🏅',
  },
  { code: 'first_clan', name: 'Família', description: 'Entre ou crie um clã.', icon: '🛡️' },
  { code: 'first_purchase', name: 'Estiloso', description: 'Compre algo na loja.', icon: '🛍️' },
  { code: 'level_10', name: 'Lenda da festa', description: 'Chegue ao nível 10.', icon: '👑' },
];

export const achievementByCode = (code: string) => ACHIEVEMENTS.find((a) => a.code === code);

/**
 * Itens de avatar que exigem nível. Índices das partes do código "c-" (base 36):
 * posição 0 = fundo, 5 = acessório.
 */
export const AVATAR_LOCKS = {
  bg: { 8: 4, 9: 6 } as Record<number, number>,
  accessory: { 8: 2, 9: 3, 10: 5, 11: 7, 12: 9, 13: 12 } as Record<number, number>,
};

/** Nível mínimo para usar o avatar (1 = livre). */
export function avatarMinLevel(avatar: string): number {
  const m = /^c-([0-9a-z]{6})(\.|$)/.exec(avatar);
  if (!m) return 1;
  const d = [...m[1]!].map((c) => parseInt(c, 36));
  return Math.max(1, AVATAR_LOCKS.bg[d[0]!] ?? 1, AVATAR_LOCKS.accessory[d[5]!] ?? 1);
}

/** Destaques que cada jogo informa ao fim da partida (por jogador). */
export type Highlights = Record<string, Partial<Record<HighlightKey, number>>>;
export type HighlightKey =
  'maxStreak' | 'firstGuesses' | 'allGuessedTurns' | 'impostorWins' | 'uniqueAnswers';

export interface MatchReward {
  /** moedas ganhas (e saldo atual) */
  coinsGained?: number;
  coins?: number;
  xpGained: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  achievements: string[];
}
