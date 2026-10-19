import { ACHIEVEMENTS, levelInfo } from '@partyverse/shared';

export interface ProgressData {
  level: number;
  xp: number;
  base: number;
  next: number;
  progress: number;
  achievements: { code: string; unlockedAt: string }[];
}

/** Selo de nível + barra de XP. */
export function LevelBar({ xp }: { xp: number }) {
  const l = levelInfo(xp);
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-4 border-night bg-pop-amber font-display text-xl font-extrabold text-night shadow-chunky">
        {l.level}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-xs text-ink-400">
          <span className="font-bold text-white">Nível {l.level}</span>
          <span>
            {xp - l.base}/{l.next - l.base} XP
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-lime-400 to-pop-sky"
            style={{ width: `${Math.round(l.progress * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Grade de conquistas: as liberadas em cores, as outras apagadas. */
export function AchievementsGrid({
  unlocked,
  showLocked = true,
}: {
  unlocked: { code: string; unlockedAt: string }[];
  showLocked?: boolean;
}) {
  const have = new Map(unlocked.map((a) => [a.code, a.unlockedAt]));
  const list = showLocked ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => have.has(a.code));
  if (!list.length) return <p className="text-sm text-ink-400">Nenhuma conquista ainda.</p>;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {list.map((a) => {
        const at = have.get(a.code);
        return (
          <li
            key={a.code}
            className={`rounded-2xl p-3 text-center transition ${at ? 'bg-lime-400/10 ring-1 ring-lime-400/50' : 'bg-ink-900 opacity-50 grayscale'}`}
            title={a.description}
          >
            <span className="text-3xl" aria-hidden>
              {at ? a.icon : '🔒'}
            </span>
            <span className="mt-1 block text-sm font-bold text-white">{a.name}</span>
            <span className="block text-xs text-ink-400">{a.description}</span>
            {at && (
              <span className="mt-1 block text-[11px] text-lime-400">
                {new Date(at).toLocaleDateString('pt-BR')}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
