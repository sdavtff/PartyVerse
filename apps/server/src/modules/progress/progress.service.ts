import {
  GAME_CATALOG,
  levelInfo,
  matchXp,
  type Highlights,
  type MatchReward,
} from '@partyverse/shared';
import type { ProgressRepository } from './progress.repository.js';

export interface MatchForProgress {
  gameId: string;
  players: number;
  participants: { userId: string; place: number }[];
  highlights: Highlights;
}

/** Calcula XP, nível e conquistas depois de cada partida (só contas registradas). */
export class ProgressService {
  constructor(private repo: ProgressRepository) {}

  async award(match: MatchForProgress): Promise<Map<string, MatchReward>> {
    const out = new Map<string, MatchReward>();
    for (const p of match.participants) {
      try {
        const before = levelInfo(await this.repo.getXp(p.userId)).level;
        const xpGained = matchXp(p.place, match.players);
        const xp = await this.repo.addXp(p.userId, xpGained);
        const { level } = levelInfo(xp);
        const stats = await this.repo.stats(p.userId);
        const h = match.highlights[p.userId] ?? {};
        const codes: string[] = [];
        if (stats.matchesPlayed >= 1) codes.push('first_match');
        if (stats.wins >= 1) codes.push('first_win');
        if (stats.wins >= 10) codes.push('wins_10');
        if (stats.matchesPlayed >= 50) codes.push('matches_50');
        if (match.players >= 10) codes.push('big_room');
        if ((h.maxStreak ?? 0) >= 5) codes.push('quiz_streak_5');
        if ((h.firstGuesses ?? 0) >= 3) codes.push('quick_guesser');
        if ((h.allGuessedTurns ?? 0) >= 1) codes.push('master_artist');
        if ((h.impostorWins ?? 0) >= 1) codes.push('impostor_escape');
        if ((h.uniqueAnswers ?? 0) >= 10) codes.push('stop_unique_10');
        if (level >= 5) codes.push('level_5');
        if (level >= 10) codes.push('level_10');
        const available = GAME_CATALOG.filter((g) => g.available).length;
        if ((await this.repo.distinctGames(p.userId)) >= available) codes.push('all_games');
        const achievements = await this.repo.addAchievements(p.userId, codes);
        out.set(p.userId, { xpGained, xp, level, leveledUp: level > before, achievements });
      } catch {
        /* progresso nunca impede o resultado da partida */
      }
    }
    return out;
  }

  /** Desbloqueia uma conquista avulsa (ex.: desafio diário, primeiro amigo). */
  async unlock(userId: string, code: string): Promise<boolean> {
    return (await this.repo.addAchievements(userId, [code])).length > 0;
  }

  async profile(userId: string) {
    const xp = await this.repo.getXp(userId);
    return { ...levelInfo(xp), achievements: await this.repo.achievements(userId) };
  }
}
