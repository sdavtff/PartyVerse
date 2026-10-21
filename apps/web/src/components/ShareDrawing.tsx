import type { DrawOp } from '@partyverse/shared';
import { useRef } from 'react';
import { DrawingView } from '../games/guess/DrawingView';
import { useToast } from './Toast';

/** Botão para baixar/compartilhar um desenho como imagem (com o desenho escondido para gerar o PNG). */
export function ShareDrawingButton({ ops, title }: { ops: DrawOp[]; title: string }) {
  const ref = useRef<{ toBlob: () => Promise<Blob | null> }>(null);
  const toast = useToast();
  if (!ops.length) return null;
  const share = async () => {
    const blob = await ref.current?.toBlob();
    if (!blob) return toast('Não deu para gerar a imagem', 'error');
    const file = new File([blob], 'desenho-partyverse.png', { type: 'image/png' });
    const text = `${title} — desenhado no PartyVerse 🎨 ${location.origin}`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch {
      return; // cancelado
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'desenho-partyverse.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Imagem baixada! Mande no WhatsApp 😉', 'success');
  };
  return (
    <>
      <div className="pointer-events-none fixed -left-[9999px] top-0 w-[400px]" aria-hidden>
        <DrawingView ref={ref} ops={ops} />
      </div>
      <button
        type="button"
        onClick={share}
        className="rounded-xl bg-ink-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-ink-600"
      >
        📤 Compartilhar desenho
      </button>
    </>
  );
}
