import { EVENTS, type StopSettings } from '@partyverse/shared';
import { useState } from 'react';
import { useToast } from '../../components/Toast';
import { emitAck } from '../../lib/socket';

const SUGGESTED = [
  'Nome',
  'Animal',
  'Cidade',
  'Comida',
  'Objeto',
  'Profissão',
  'Cor',
  'Fruta',
  'Marca',
  'Filme/Série',
  'País',
  'Parte do corpo',
];

export function StopSettingsForm({
  settings,
  editable,
}: {
  settings: StopSettings;
  editable: boolean;
}) {
  const toast = useToast();
  const [newCat, setNewCat] = useState('');
  const save = (game: Partial<StopSettings>) =>
    emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game }).catch((e) => toast(e.message, 'error'));

  const toggle = (c: string) => {
    const has = settings.categories.includes(c);
    if (has && settings.categories.length <= 2) return toast('Mínimo de 2 categorias', 'error');
    if (!has && settings.categories.length >= 10) return toast('Máximo de 10 categorias', 'error');
    save({
      categories: has ? settings.categories.filter((x) => x !== c) : [...settings.categories, c],
    });
  };
  const custom = settings.categories.filter((c) => !SUGGESTED.includes(c));

  const num = (
    key: 'rounds' | 'roundSeconds' | 'reviewSeconds' | 'stopCountdownSeconds',
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="block">
      <span className="label">{label}</span>
      <select
        className="input py-2"
        disabled={!editable}
        value={settings[key]}
        onChange={(e) => save({ [key]: Number(e.target.value) })}
      >
        {Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step).map(
          (v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ),
        )}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Categorias ({settings.categories.length})</p>
        <div className="flex flex-wrap gap-2">
          {[...SUGGESTED, ...custom].map((c) => {
            const on = settings.categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                disabled={!editable}
                aria-pressed={on}
                onClick={() => toggle(c)}
                className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition disabled:cursor-default ${on ? 'border-lime-400 bg-lime-400 text-ink-950' : 'border-ink-600 text-ink-200 enabled:hover:border-ink-400'}`}
              >
                {c}
              </button>
            );
          })}
        </div>
        {editable && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const c = newCat.trim();
              if (c.length >= 2 && !settings.categories.includes(c)) {
                toggle(c);
                setNewCat('');
              }
            }}
          >
            <label htmlFor="new-cat" className="sr-only">
              Nova categoria
            </label>
            <input
              id="new-cat"
              className="input py-2"
              maxLength={24}
              placeholder="Outra categoria…"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <button
              className="rounded-2xl bg-ink-700 px-4 font-bold text-white hover:bg-ink-600 disabled:opacity-50"
              disabled={newCat.trim().length < 2}
            >
              Adicionar
            </button>
          </form>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {num('rounds', 'Rodadas', 1, 10)}
        {num('roundSeconds', 'Tempo (s)', 30, 300, 15)}
        {num('reviewSeconds', 'Revisão (s)', 15, 180, 15)}
        {num('stopCountdownSeconds', 'Após STOP (s)', 0, 15)}
      </div>
      <div>
        <p className="label">Pontuação</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['unique', 'repeated', 'empty', 'rejected'] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs text-ink-400">
                {
                  {
                    unique: 'Única',
                    repeated: 'Repetida',
                    empty: 'Vazia/errada',
                    rejected: 'Contestada',
                  }[k]
                }
              </span>
              <input
                type="number"
                min={0}
                max={50}
                className="input py-2"
                disabled={!editable}
                defaultValue={settings.points[k]}
                key={settings.points[k]}
                onBlur={(e) => {
                  const v = Math.max(0, Math.min(50, Number(e.target.value) || 0));
                  if (v !== settings.points[k]) save({ points: { ...settings.points, [k]: v } });
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
