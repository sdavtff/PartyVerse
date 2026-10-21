import type { DrawOp } from '@partyverse/shared';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { applyOps, H, redraw, W } from './drawing';

/** Mostra um desenho pronto (só leitura). `ref.toBlob()` exporta como imagem PNG. */
export const DrawingView = forwardRef<
  { toBlob: () => Promise<Blob | null> },
  { ops: DrawOp[]; label?: string; className?: string }
>(function DrawingView({ ops, label = 'Desenho', className = '' }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    redraw(ctx, applyOps([], ops).items);
  }, [ops]);
  useImperativeHandle(ref, () => ({
    toBlob: () => new Promise((res) => canvas.current?.toBlob(res, 'image/png') ?? res(null)),
  }));
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border-4 border-night bg-paper shadow-chunky ${className}`}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={label}
      />
    </div>
  );
});
