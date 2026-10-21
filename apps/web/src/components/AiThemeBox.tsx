import type { AiKind } from '@partyverse/shared';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useHealth } from '../lib/health';
import { useToast } from './Toast';

const WHAT: Record<AiKind, { label: string; placeholder: string; done: string }> = {
  quiz: {
    label: 'perguntas',
    placeholder: 'Ex.: Harry Potter, anos 2000, dinossauros…',
    done: 'perguntas',
  },
  words: {
    label: 'palavras',
    placeholder: 'Ex.: Copa do Mundo, cozinha, super-heróis…',
    done: 'palavras',
  },
  locations: {
    label: 'locais',
    placeholder: 'Ex.: espaço sideral, Idade Média, shopping…',
    done: 'locais',
  },
  mostlikely: {
    label: 'frases',
    placeholder: 'Ex.: escola, viagem de férias, trabalho…',
    done: 'frases',
  },
  truths: { label: 'verdades', placeholder: 'Ex.: infância, comida, viagens…', done: 'verdades' },
  dares: { label: 'desafios', placeholder: 'Ex.: dança, imitações, música…', done: 'desafios' },
};

/** "✨ Gerar com IA": o anfitrião escreve um tema e a IA cria o conteúdo da partida. */
export function AiThemeBox({ kinds, editable }: { kinds: AiKind[]; editable: boolean }) {
  const health = useHealth();
  const { code = '' } = useParams();
  const toast = useToast();
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState<AiKind | null>(null);
  if (!health?.ai || !editable) return null;

  const run = async (kind: AiKind) => {
    setBusy(kind);
    try {
      const r = await api<{ count: number }>(`/rooms/${code}/ai`, {
        method: 'POST',
        json: { kind, theme: theme.trim() },
        timeoutMs: 120_000,
      });
      toast(`✨ Pronto! ${r.count} ${WHAT[kind].done} sobre "${theme.trim()}"`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-pop-violet/50 bg-pop-violet/10 p-4">
      <p className="font-bold text-white">✨ Criar com IA</p>
      <p className="mt-0.5 text-xs text-ink-200">
        Escreva um tema e a IA prepara as {kinds.map((k) => WHAT[k].label).join(' e ')} da partida.
        Ninguém vê as respostas antes.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="input min-w-[12rem] flex-1 py-2"
          value={theme}
          maxLength={60}
          placeholder={WHAT[kinds[0]!].placeholder}
          onChange={(e) => setTheme(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && theme.trim().length >= 2 && !busy && void run(kinds[0]!)
          }
          aria-label="Tema para a IA"
        />
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            disabled={theme.trim().length < 2 || busy !== null}
            onClick={() => run(k)}
            className="rounded-xl bg-pop-violet px-4 py-2 text-sm font-bold text-night transition hover:brightness-110 disabled:opacity-50"
          >
            {busy === k ? 'Criando…' : `Gerar ${WHAT[k].label}`}
          </button>
        ))}
      </div>
      {busy && (
        <p className="mt-2 animate-pulse text-xs text-ink-200">
          A IA está criando… pode levar até meio minuto.
        </p>
      )}
    </div>
  );
}
