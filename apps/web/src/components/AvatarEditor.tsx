import { AVATAR_LOCKS } from '@partyverse/shared';
import { useState } from 'react';
import {
  Avatar,
  PARTS,
  decodeAvatar,
  encodeAvatar,
  randomAvatarParts,
  type AvatarParts,
} from './Avatar';

type StepKey = 'hairStyle' | 'eyes' | 'mouth' | 'accessory';
const STEPS: { key: StepKey; label: string }[] = [
  { key: 'hairStyle', label: 'Cabelo' },
  { key: 'eyes', label: 'Olhos' },
  { key: 'mouth', label: 'Boca' },
  { key: 'accessory', label: 'Acessório' },
];

/** Nível exigido por um item (1 = livre). */
const lockOf = (key: keyof AvatarParts, index: number) =>
  key === 'accessory'
    ? (AVATAR_LOCKS.accessory[index] ?? 1)
    : key === 'bg'
      ? (AVATAR_LOCKS.bg[index] ?? 1)
      : 1;

/**
 * Criador de avatar: troca partes com setas, cores em bolinhas e um botão "sortear".
 * Itens acima do nível do jogador aparecem com cadeado (dá para espiar, não para usar).
 */
export function AvatarEditor({
  value,
  onChange,
  compact = false,
  level = 1,
}: {
  value: string;
  onChange: (avatar: string) => void;
  compact?: boolean;
  level?: number;
}) {
  const committed: AvatarParts = decodeAvatar(value) ?? randomAvatarParts();
  const [peek, setPeek] = useState<{ key: keyof AvatarParts; index: number } | null>(null);
  const parts: AvatarParts = peek ? { ...committed, [peek.key]: peek.index } : committed;

  const choose = (key: keyof AvatarParts, index: number) => {
    if (lockOf(key, index) > level) {
      setPeek({ key, index });
      return;
    }
    setPeek(null);
    onChange(encodeAvatar({ ...committed, [key]: index }));
  };
  const cycle = (key: StepKey, dir: 1 | -1) => {
    const len = PARTS[key].length;
    choose(key, (parts[key] + dir + len) % len);
  };
  const lockedNeed = peek ? lockOf(peek.key, peek.index) : 0;

  const swatches = (key: 'bg' | 'skin' | 'hairColor', label: string) => (
    <div>
      <p className="mb-1 text-xs font-bold text-ink-400">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {PARTS[key].map((c, i) => {
          const need = lockOf(key, i);
          const locked = need > level;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={parts[key] === i}
              aria-label={`${label} ${i + 1}${locked ? ` (nível ${need})` : ''}`}
              title={locked ? `Libera no nível ${need}` : undefined}
              onClick={() => choose(key, i)}
              className={`relative h-6 w-6 rounded-full border-2 transition ${parts[key] === i ? 'scale-110 border-white ring-2 ring-lime-400' : 'border-ink-950'}`}
              style={{ background: c }}
            >
              {locked && (
                <span className="absolute -right-1.5 -top-1.5 text-[10px]" aria-hidden>
                  🔒
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-[auto_1fr]'}`}>
      <div className="flex flex-col items-center gap-2">
        <div
          className={`relative animate-pop rounded-full shadow-chunky ${peek ? 'opacity-80' : ''}`}
          key={encodeAvatar(parts)}
        >
          <Avatar avatar={encodeAvatar(parts)} size={compact ? 96 : 120} label="seu avatar" />
          {peek && (
            <span className="absolute inset-x-0 -bottom-2 mx-auto w-fit rounded-full bg-ink-950 px-2 py-0.5 text-xs font-bold text-pop-amber">
              🔒 nível {lockedNeed}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setPeek(null);
            onChange(encodeAvatar(randomAvatarParts()));
          }}
          className="rounded-xl bg-ink-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-ink-600"
        >
          🎲 Sortear
        </button>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {STEPS.map(({ key, label }) => {
            const need = lockOf(key, parts[key]);
            const locked = need > level;
            return (
              <div
                key={key}
                className={`flex items-center justify-between rounded-xl px-1 py-1 ${locked ? 'bg-pop-amber/10 ring-1 ring-pop-amber/50' : 'bg-ink-900'}`}
              >
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-lg font-bold text-ink-200 hover:bg-ink-700"
                  onClick={() => cycle(key, -1)}
                  aria-label={`${label} anterior`}
                >
                  ‹
                </button>
                <span className="min-w-0 truncate text-center text-xs">
                  <span className="block font-bold text-white">{label}</span>
                  <span className={locked ? 'text-pop-amber' : 'text-ink-400'}>
                    {locked ? `🔒 nível ${need}` : PARTS[key][parts[key]]}
                  </span>
                </span>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-lg font-bold text-ink-200 hover:bg-ink-700"
                  onClick={() => cycle(key, 1)}
                  aria-label={`Próximo ${label.toLowerCase()}`}
                >
                  ›
                </button>
              </div>
            );
          })}
        </div>
        {peek && (
          <p className="rounded-xl bg-pop-amber/10 px-3 py-2 text-xs text-pop-amber">
            {peek.key === 'accessory' ? PARTS.accessory[peek.index] : 'Este fundo'} libera no nível{' '}
            {lockedNeed}. Jogue partidas com sua conta para ganhar XP!
          </p>
        )}
        {swatches('skin', 'Pele')}
        {swatches('hairColor', 'Cor do cabelo')}
        {swatches('bg', 'Fundo')}
      </div>
    </div>
  );
}
