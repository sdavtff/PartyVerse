import { REPORT_REASONS, REPORT_REASON_LABELS } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from './Toast';

/** Janela para denunciar um jogador (vai para o painel de administração). */
export function ReportDialog({
  target,
  roomCode,
  onClose,
}: {
  target: { id: string; nickname: string };
  roomCode?: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>('ofensa');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="card w-full max-w-md animate-pop space-y-4 p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/reports', {
              method: 'POST',
              json: { targetId: target.id, roomCode, reason, details: details.trim() },
            });
            toast('Denúncia enviada. Obrigado por ajudar a manter o PartyVerse legal!', 'success');
            onClose();
          } catch (err) {
            toast((err as Error).message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 id="report-title" className="text-xl font-extrabold">
          Denunciar {target.nickname}
        </h2>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="label">Motivo</legend>
          {REPORT_REASONS.map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold ${reason === r ? 'border-pop-rose bg-pop-rose/15 text-white' : 'border-ink-700 text-ink-200'}`}
            >
              <input
                type="radio"
                name="reason"
                className="sr-only"
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {REPORT_REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>
        <label className="block">
          <span className="label">O que aconteceu? (opcional)</span>
          <textarea
            className="input min-h-[5rem] py-2 text-sm"
            maxLength={300}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        <p className="text-xs text-ink-400">
          As últimas mensagens dessa pessoa no chat da sala vão junto, para a moderação conferir.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 font-bold text-ink-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-pop-rose px-4 py-2 font-bold text-night disabled:opacity-50"
          >
            {busy ? 'Enviando…' : 'Enviar denúncia'}
          </button>
        </div>
      </form>
    </div>
  );
}
