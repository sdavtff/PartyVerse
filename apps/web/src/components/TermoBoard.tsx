import type { MatchReward } from '@partyverse/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { sfx } from '../lib/sound';
import { useToast } from './Toast';

type Mark = 'correct' | 'present' | 'absent';
export interface TermoState {
  max: number;
  rows: { guess: string; marks: Mark[] }[];
  done: boolean;
  won: boolean;
  score: number;
  answer: string | null;
}

const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const COLORS: Record<Mark, string> = {
  correct: 'bg-lime-400 text-night border-lime-400',
  present: 'bg-pop-amber text-night border-pop-amber',
  absent: 'bg-ink-700 text-ink-400 border-ink-700',
};
const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Termo do dia: 6 tentativas para achar a palavra de 5 letras. */
export function TermoBoard({
  initial,
  canPlay,
  onFinish,
}: {
  initial: TermoState;
  canPlay: boolean;
  onFinish: (reward: MatchReward | null) => void;
}) {
  const [st, setSt] = useState(initial);
  const [cur, setCur] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const toast = useToast();
  const playing = canPlay && !st.done;

  const keyState = new Map<string, Mark>();
  for (const r of st.rows)
    r.guess.split('').forEach((ch, i) => {
      const m = r.marks[i]!;
      const old = keyState.get(ch);
      if (!old || RANK[m] > RANK[old]) keyState.set(ch, m);
    });

  const submit = useCallback(async () => {
    if (cur.length !== 5 || busy) return;
    setBusy(true);
    try {
      const r = await api<{
        result: TermoState & { finishedNow: boolean };
        reward: MatchReward | null;
      }>('/daily/termo', { method: 'POST', json: { guess: cur } });
      setSt(r.result);
      setCur('');
      if (r.result.done) {
        sfx(r.result.won ? 'win' : 'lose');
        onFinish(r.reward);
      } else sfx('click');
    } catch (e) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }, [cur, busy, onFinish, toast]);

  const press = useCallback(
    (k: string) => {
      if (!playing) return;
      if (k === 'enter') return void submit();
      if (k === 'back') return setCur((c) => c.slice(0, -1));
      if (/^[a-z]$/.test(k)) setCur((c) => (c.length < 5 ? c + k : c));
    },
    [playing, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 'enter') press('enter');
      else if (k === 'backspace') press('back');
      else if (/^[a-zç]$/.test(k)) press(k === 'ç' ? 'c' : k);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [press]);

  const rows = Array.from({ length: st.max }, (_, i) => st.rows[i] ?? null);
  const curRow = st.rows.length;

  return (
    <div className="space-y-4">
      <div className="mx-auto grid w-fit gap-1.5" aria-label="Tabuleiro do Termo">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`grid grid-cols-5 gap-1.5 ${i === curRow && shake ? 'shake' : ''}`}
          >
            {Array.from({ length: 5 }, (_, j) => {
              const ch = r ? r.guess[j] : i === curRow ? cur[j] : '';
              const m = r?.marks[j];
              return (
                <span
                  key={j}
                  className={`grid h-12 w-12 place-items-center rounded-xl border-2 font-display text-2xl font-extrabold uppercase sm:h-14 sm:w-14 ${m ? `${COLORS[m]} flip-in` : ch ? 'border-ink-400 text-white' : 'border-ink-700 text-white'}`}
                  style={m ? { animationDelay: `${j * 90}ms` } : undefined}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {st.done ? (
        <div className="text-center">
          <p className="font-display text-2xl font-extrabold">
            {st.won ? `🎉 Acertou em ${st.rows.length}!` : '😢 Não foi dessa vez'}
          </p>
          <p className="text-ink-200">
            A palavra era <b className="uppercase text-lime-400">{st.answer}</b>
            {st.won && <> · {st.score} pontos</>}
          </p>
          <button
            className="mt-3 rounded-xl bg-ink-700 px-4 py-2 text-sm font-bold text-white hover:bg-ink-600"
            onClick={async () => {
              const grid = st.rows
                .map((r) =>
                  r.marks
                    .map((m) => (m === 'correct' ? '🟩' : m === 'present' ? '🟨' : '⬛'))
                    .join(''),
                )
                .join('\n');
              const text = `Termo do dia no PartyVerse ${st.won ? st.rows.length : 'X'}/${st.max}\n${grid}\n${location.origin}/desafio`;
              try {
                if (navigator.share) await navigator.share({ text });
                else {
                  await navigator.clipboard.writeText(text);
                  toast('Resultado copiado! Cole no WhatsApp.', 'success');
                }
              } catch {
                /* cancelado */
              }
            }}
          >
            📤 Compartilhar resultado
          </button>
        </div>
      ) : (
        canPlay && (
          <div className="mx-auto max-w-lg space-y-1.5" aria-label="Teclado">
            {KEYS.map((row, i) => (
              <div key={row} className="flex justify-center gap-1">
                {i === 2 && (
                  <button
                    onClick={() => press('enter')}
                    disabled={busy}
                    className="h-12 rounded-lg bg-lime-400 px-2 text-xs font-extrabold text-night sm:px-3"
                  >
                    ENTER
                  </button>
                )}
                {row.split('').map((k) => {
                  const m = keyState.get(k);
                  return (
                    <button
                      key={k}
                      onClick={() => press(k)}
                      className={`h-12 w-8 rounded-lg text-sm font-extrabold uppercase sm:w-10 ${m ? COLORS[m] : 'bg-ink-600 text-white hover:bg-ink-400'}`}
                    >
                      {k}
                    </button>
                  );
                })}
                {i === 2 && (
                  <button
                    onClick={() => press('back')}
                    className="h-12 rounded-lg bg-ink-600 px-2 text-lg font-extrabold text-white sm:px-3"
                    aria-label="Apagar"
                  >
                    ⌫
                  </button>
                )}
              </div>
            ))}
            <p className="pt-1 text-center text-xs text-ink-400">
              🟩 letra no lugar certo · 🟨 existe em outro lugar · acentos não importam
            </p>
          </div>
        )
      )}
    </div>
  );
}
