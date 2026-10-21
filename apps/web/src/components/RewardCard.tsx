import { achievementByCode, levelInfo, type MatchReward } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sfx } from '../lib/sound';
import { AnimatedNumber } from './AnimatedNumber';

/** XP ganho, barra de nível animada e conquistas novas (aparece no fim da partida). */
export function RewardCard({ reward }: { reward: MatchReward }) {
  const before = levelInfo(reward.xp - reward.xpGained);
  const after = levelInfo(reward.xp);
  const [fill, setFill] = useState(before.progress);
  useEffect(() => {
    const t = setTimeout(() => setFill(reward.leveledUp ? 1 : after.progress), 400);
    const t2 = reward.leveledUp ? setTimeout(() => setFill(after.progress), 1300) : undefined;
    if (reward.leveledUp || reward.achievements.length) setTimeout(() => sfx('win'), 900);
    return () => {
      clearTimeout(t);
      if (t2) clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reward]);

  return (
    <div
      className="animate-rise space-y-3 rounded-2xl border-2 border-ink-700 bg-ink-900 p-4"
      style={{ animationDelay: '1.4s' }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-2xl font-extrabold text-lime-400">
          +<AnimatedNumber value={reward.xpGained} ms={900} /> XP
          {reward.coinsGained ? (
            <Link to="/loja" className="ml-3 text-pop-amber hover:underline">
              +{reward.coinsGained} 🪙
            </Link>
          ) : null}
        </p>
        <p className="text-sm font-bold text-ink-200">
          Nível <span className="font-display text-xl text-white">{after.level}</span>
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink-700" aria-hidden>
        <div
          className="h-full rounded-full bg-gradient-to-r from-lime-400 to-pop-sky transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(fill * 100)}%` }}
        />
      </div>
      <p className="text-xs text-ink-400">
        {after.next - reward.xp} XP para o nível {after.level + 1}
      </p>
      {reward.leveledUp && (
        <p className="drop-in rounded-xl bg-pop-amber/15 px-3 py-2 text-center font-display text-lg font-extrabold text-pop-amber">
          ⭐ Subiu para o nível {after.level}! Novos itens de avatar podem ter sido liberados.
        </p>
      )}
      {reward.achievements.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {reward.achievements.map((code, i) => {
            const a = achievementByCode(code);
            if (!a) return null;
            return (
              <li
                key={code}
                className="drop-in flex items-center gap-3 rounded-xl bg-lime-400/10 px-3 py-2 ring-1 ring-lime-400/50"
                style={{ animationDelay: `${1.6 + i * 0.25}s` }}
              >
                <span className="text-2xl" aria-hidden>
                  {a.icon}
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase text-lime-400">
                    Conquista nova
                  </span>
                  <span className="font-bold text-white">{a.name}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to="/perfil"
        className="block text-center text-xs font-bold text-ink-400 hover:text-white"
      >
        Ver todas as conquistas ›
      </Link>
    </div>
  );
}
