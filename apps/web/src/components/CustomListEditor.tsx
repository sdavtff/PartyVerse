import { useState } from 'react';

/** Lê/escreve com segurança no armazenamento do navegador (pode falhar em aba anônima). */
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) ?? '';
    } catch {
      return '';
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* sem armazenamento: tudo bem */
    }
  },
};

/** Uma entrada por linha, sem linhas vazias. */
export const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Editor de tema personalizado (palavras, frases ou perguntas, uma por linha).
 * O texto fica guardado neste navegador; o servidor só conta quantos itens a sala tem,
 * para que os outros jogadores não vejam as respostas.
 */
export function CustomListEditor<T>({
  id,
  title,
  hint,
  placeholder,
  savedCount,
  parse,
  onSave,
  editable,
}: {
  id: string;
  title: string;
  hint: string;
  placeholder: string;
  savedCount: number;
  parse: (text: string) => { items: T[]; errors: string[] };
  onSave: (items: T[]) => Promise<unknown>;
  editable: boolean;
}) {
  const key = `pv-custom-${id}`;
  const [text, setText] = useState(() => store.get(key));
  const [busy, setBusy] = useState(false);
  const { items, errors } = parse(text);

  if (!editable)
    return savedCount > 0 ? (
      <p className="rounded-2xl bg-ink-900 px-4 py-3 text-sm text-ink-200">
        ✍️ O anfitrião criou um tema com <b className="text-white">{savedCount}</b> itens
        personalizados.
      </p>
    ) : null;

  return (
    <div className="rounded-2xl bg-ink-900 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={key} className="font-bold text-white">
          {title}
        </label>
        <span className="text-xs text-ink-400">
          {savedCount > 0 ? `${savedCount} salvos na sala` : 'nada salvo ainda'}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-400">{hint}</p>
      <textarea
        id={key}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          store.set(key, e.target.value);
        }}
        rows={6}
        placeholder={placeholder}
        className="input mt-2 min-h-[8rem] resize-y py-2 font-mono text-sm"
        spellCheck={false}
      />
      {errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-pop-amber">
          {errors.slice(0, 4).map((e) => (
            <li key={e}>⚠️ {e}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-400">{items.length} prontos para salvar</span>
        <button
          type="button"
          disabled={busy || (items.length === 0 && savedCount === 0)}
          onClick={async () => {
            setBusy(true);
            await onSave(items).finally(() => setBusy(false));
          }}
          className="rounded-xl bg-lime-400 px-3 py-1.5 text-sm font-bold text-night hover:bg-lime-300 disabled:opacity-50"
        >
          {items.length === 0 ? 'Limpar lista' : `Salvar ${items.length}`}
        </button>
      </div>
    </div>
  );
}
