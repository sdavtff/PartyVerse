/** Progresso do jogador: XP, níveis, conquistas e itens de avatar desbloqueáveis. */
/** XP total necessário para chegar ao nível `level` (nível 1 = 0 XP). Cresce devagar. */
export declare function xpForLevel(level: number): number;
export declare function levelInfo(xp: number): {
    level: number;
    xp: number;
    base: number;
    next: number;
    progress: number;
};
/** XP ganho numa partida. */
export declare function matchXp(place: number, players: number): number;
export interface AchievementDef {
    code: string;
    name: string;
    description: string;
    icon: string;
}
export declare const ACHIEVEMENTS: AchievementDef[];
export declare const achievementByCode: (code: string) => AchievementDef | undefined;
/**
 * Itens de avatar que exigem nível. Índices das partes do código "c-" (base 36):
 * posição 0 = fundo, 5 = acessório.
 */
export declare const AVATAR_LOCKS: {
    bg: Record<number, number>;
    accessory: Record<number, number>;
};
/** Nível mínimo para usar o avatar (1 = livre). */
export declare function avatarMinLevel(avatar: string): number;
/** Destaques que cada jogo informa ao fim da partida (por jogador). */
export type Highlights = Record<string, Partial<Record<HighlightKey, number>>>;
export type HighlightKey = 'maxStreak' | 'firstGuesses' | 'allGuessedTurns' | 'impostorWins' | 'uniqueAnswers';
export interface MatchReward {
    xpGained: number;
    xp: number;
    level: number;
    leveledUp: boolean;
    achievements: string[];
}
