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

/** Criador de avatar: troca partes com setas, cores em bolinhas e um botão "sortear". */
export function AvatarEditor({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (avatar: string) => void;
  compact?: boolean;
}) {
  const parts: AvatarParts = decodeAvatar(value) ?? randomAvatarParts();
  const set = (patch: Partial<AvatarParts>) => onChange(encodeAvatar({ ...parts, ...patch }));
  const cycle = (key: StepKey, dir: 1 | -1) => {
    const len = PARTS[key].length;
    set({ [key]: (parts[key] + dir + len) % len } as Partial<AvatarParts>);
  };

  const swatches = (key: 'bg' | 'skin' | 'hairColor', label: string) => (
    <div>
      <p className="mb-1 text-xs font-bold text-ink-400">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {PARTS[key].map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={parts[key] === i}
            aria-label={`${label} ${i + 1}`}
            onClick={() => set({ [key]: i } as Partial<AvatarParts>)}
            className={`h-6 w-6 rounded-full border-2 transition ${parts[key] === i ? 'scale-110 border-white ring-2 ring-lime-400' : 'border-ink-950'}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-[auto_1fr]'}`}>
      <div className="flex flex-col items-center gap-2">
        <div className="animate-pop rounded-full shadow-chunky" key={value}>
          <Avatar avatar={encodeAvatar(parts)} size={compact ? 96 : 120} label="seu avatar" />
        </div>
        <button
          type="button"
          onClick={() => onChange(encodeAvatar(randomAvatarParts()))}
          className="rounded-xl bg-ink-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-ink-600"
        >
          🎲 Sortear
        </button>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {STEPS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl bg-ink-900 px-1 py-1"
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
                <span className="text-ink-400">{PARTS[key][parts[key]]}</span>
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
          ))}
        </div>
        {swatches('skin', 'Pele')}
        {swatches('hairColor', 'Cor do cabelo')}
        {swatches('bg', 'Fundo')}
      </div>
    </div>
  );
}
