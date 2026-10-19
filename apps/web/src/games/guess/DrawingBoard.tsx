import { EVENTS, type DrawOp } from '@partyverse/shared';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useToast } from '../../components/Toast';
import { actionId, emitAck } from '../../lib/socket';
import { applyOps, drawItem, drawShape, drawStroke, H, redraw, W, type Item } from './drawing';

const COLORS = [
  '#000000',
  '#5c5c66',
  '#a3a3ad',
  '#ffffff',
  '#e8302e',
  '#ff7a6b',
  '#ff9f1c',
  '#ffd23f',
  '#2ecc71',
  '#0b8a4e',
  '#2f80ed',
  '#5cc8ff',
  '#7b4bff',
  '#ff5fa2',
  '#8b5a2b',
  '#f2c79e',
];
const SIZES = [3, 7, 14, 26];
type Tool = 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'ellipse';
const TOOLS: { id: Tool; label: string; icon: JSX.Element }[] = [
  {
    id: 'pen',
    label: 'Lápis',
    icon: <path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" />,
  },
  {
    id: 'eraser',
    label: 'Borracha',
    icon: <path d="M8 20h12M5 15l9-9 5 5-9 9H8z" />,
  },
  {
    id: 'fill',
    label: 'Balde',
    icon: <path d="M5 12l7-7 7 7-7 7zM19 15s2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 2-4 2-4z" />,
  },
  { id: 'line', label: 'Linha', icon: <path d="M5 19L19 5" /> },
  { id: 'rect', label: 'Retângulo', icon: <rect x="4" y="6" width="16" height="12" rx="1" /> },
  { id: 'ellipse', label: 'Círculo', icon: <ellipse cx="12" cy="12" rx="8" ry="6" /> },
];

let idSeq = 0;
const newId = () => `${Date.now().toString(36).slice(-4)}${(idSeq++).toString(36)}`;

/**
 * Quadro de desenho. Quem desenha aplica localmente e envia operações em lotes;
 * os demais recebem as operações em tempo real e, a cada nova visão do servidor, ressincronizam.
 */
export function DrawingBoard({
  turn,
  serverOps,
  canDraw,
  subscribe,
}: {
  turn: number;
  serverOps: DrawOp[];
  canDraw: boolean;
  subscribe: (fn: (ev: unknown) => void) => () => void;
}) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const items = useRef<Item[]>([]);
  const pending = useRef<DrawOp[]>([]);
  const current = useRef<{ id: string; tool: Tool; x: number; y: number } | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(7);
  const [filled, setFilled] = useState(false);
  const lastTurn = useRef(-1);
  const errorShown = useRef(false);

  const ctx2d = () => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;

  /** Aplica operações e desenha só o necessário. */
  const apply = useCallback((ops: DrawOp[]) => {
    const ctx = ctx2d();
    if (!ctx) return;
    const before = new Map(items.current.map((i) => [i, i.t === 's' ? i.p.length : 0]));
    const prevLen = items.current.length;
    const res = applyOps(items.current, ops);
    items.current = res.items;
    if (res.full) return redraw(ctx, items.current);
    // novos pontos em traços existentes
    for (const op of ops) {
      if (op.t !== 'a') continue;
      const it = items.current.find((i) => i.id === op.id && i.t === 's');
      if (it && it.t === 's') drawStroke(ctx, it, before.get(it) ?? 0);
    }
    // itens novos
    for (const it of items.current.slice(prevLen)) drawItem(ctx, it);
  }, []);

  // troca de turno: quadro limpo
  // visão do servidor: espectadores/adivinhadores ressincronizam (quem desenha mantém o local)
  useEffect(() => {
    const ctx = ctx2d();
    if (!ctx) return;
    const turnChanged = lastTurn.current !== turn;
    lastTurn.current = turn;
    if (turnChanged || !canDraw) {
      items.current = serverOps.map((o) =>
        o.t === 's' ? { ...o, p: [...o.p] } : { ...(o as Item) },
      ) as Item[];
      redraw(ctx, items.current);
    }
  }, [turn, serverOps, canDraw]);

  // traços ao vivo de quem desenha
  useEffect(
    () =>
      subscribe((ev) => {
        const e = ev as { kind?: string; turn?: number; ops?: DrawOp[] };
        if (e?.kind === 'draw' && e.turn === lastTurn.current && e.ops && !canDraw) apply(e.ops);
      }),
    [subscribe, apply, canDraw],
  );

  // envio em lotes (~20 por segundo)
  useEffect(() => {
    if (!canDraw) return;
    const t = setInterval(() => {
      if (!pending.current.length) return;
      // junta pontos consecutivos do mesmo traço
      const ops: DrawOp[] = [];
      for (const op of pending.current.splice(0)) {
        const prev = ops.at(-1);
        if (
          op.t === 'a' &&
          prev &&
          (prev.t === 'a' || prev.t === 's') &&
          prev.id === op.id &&
          prev.p.length + op.p.length < 590
        )
          prev.p.push(...op.p);
        else ops.push(op.t === 'a' || op.t === 's' ? { ...op, p: [...op.p] } : op);
      }
      for (let i = 0; i < ops.length; i += 40)
        emitAck(EVENTS.GAME_ACTION, {
          action: { type: 'draw', ops: ops.slice(i, i + 40) },
          actionId: actionId(),
        }).catch((e: Error) => {
          if (!errorShown.current) {
            errorShown.current = true;
            toast(e.message, 'error');
            setTimeout(() => (errorShown.current = false), 4000);
          }
        });
    }, 50);
    return () => clearInterval(t);
  }, [canDraw, toast]);

  const queue = (op: DrawOp) => {
    apply([op]);
    pending.current.push(op);
  };

  const toLogical = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.round(((e.clientX - r.left) / r.width) * W),
      Math.round(((e.clientY - r.top) / r.height) * H),
    ] as [number, number];
  };

  const clearOverlay = () => {
    const o = overlayRef.current?.getContext('2d');
    o?.clearRect(0, 0, W, H);
  };

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toLogical(e);
    if (tool === 'fill') {
      queue({ t: 'f', id: newId(), c: color, x, y });
      return;
    }
    const id = newId();
    current.current = { id, tool, x, y };
    if (tool === 'pen' || tool === 'eraser')
      queue({
        t: 's',
        id,
        c: color,
        w: tool === 'eraser' ? Math.max(size, 14) : size,
        e: tool === 'eraser',
        p: [x, y],
      });
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const cur = current.current;
    if (!cur || !canDraw) return;
    const [x, y] = toLogical(e);
    if (cur.tool === 'pen' || cur.tool === 'eraser') {
      queue({ t: 'a', id: cur.id, p: [x, y] });
    } else {
      const o = overlayRef.current?.getContext('2d');
      if (!o) return;
      o.clearRect(0, 0, W, H);
      drawShape(o, {
        t: 'sh',
        id: cur.id,
        k: cur.tool as 'line',
        c: color,
        w: size,
        f: filled,
        p: [cur.x, cur.y, x, y],
      });
    }
  };

  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const cur = current.current;
    current.current = null;
    if (!cur || !canDraw) return;
    if (cur.tool === 'line' || cur.tool === 'rect' || cur.tool === 'ellipse') {
      clearOverlay();
      const [x, y] = toLogical(e);
      if (Math.abs(x - cur.x) + Math.abs(y - cur.y) > 3)
        queue({
          t: 'sh',
          id: cur.id,
          k: cur.tool,
          c: color,
          w: size,
          f: filled,
          p: [cur.x, cur.y, x, y],
        });
    }
  };

  return (
    <div className="space-y-2">
      <div
        className="relative w-full overflow-hidden rounded-2xl border-4 border-night bg-paper shadow-chunky"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="absolute inset-0 h-full w-full"
          aria-label={canDraw ? 'Quadro de desenho: desenhe aqui' : 'Desenho do jogador da vez'}
          role="img"
        />
        <canvas
          ref={overlayRef}
          width={W}
          height={H}
          className={`absolute inset-0 h-full w-full ${canDraw ? (tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair') : ''}`}
          style={{ touchAction: canDraw ? 'none' : 'auto' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>

      {canDraw && (
        <div className="space-y-2 rounded-2xl bg-ink-900 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                aria-pressed={tool === t.id}
                title={t.label}
                aria-label={t.label}
                className={`grid h-10 w-10 place-items-center rounded-xl transition ${tool === t.id ? 'bg-lime-400 text-night' : 'bg-ink-700 text-white hover:bg-ink-600'}`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {t.icon}
                </svg>
              </button>
            ))}
            {(tool === 'rect' || tool === 'ellipse') && (
              <button
                type="button"
                onClick={() => setFilled((f) => !f)}
                aria-pressed={filled}
                className={`h-10 rounded-xl px-3 text-sm font-bold ${filled ? 'bg-lime-400 text-night' : 'bg-ink-700 text-white'}`}
              >
                {filled ? 'Cheio' : 'Contorno'}
              </button>
            )}
            <span className="mx-1 h-8 w-px bg-ink-600" aria-hidden />
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                aria-label={`Espessura ${s}`}
                className={`grid h-10 w-10 place-items-center rounded-xl ${size === s ? 'bg-lime-400' : 'bg-ink-700 hover:bg-ink-600'}`}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: Math.min(24, s),
                    height: Math.min(24, s),
                    background: size === s ? '#0f0b17' : '#fff',
                  }}
                />
              </button>
            ))}
            <span className="mx-1 h-8 w-px bg-ink-600" aria-hidden />
            <button
              type="button"
              onClick={() => queue({ t: 'u' })}
              className="h-10 rounded-xl bg-ink-700 px-3 text-sm font-bold text-white hover:bg-ink-600"
              title="Desfazer"
            >
              ↶ Desfazer
            </button>
            <button
              type="button"
              onClick={() => queue({ t: 'clear' })}
              className="h-10 rounded-xl bg-ink-700 px-3 text-sm font-bold text-pop-rose hover:bg-ink-600"
            >
              Limpar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cores">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Cor ${c}`}
                onClick={() => {
                  setColor(c);
                  if (tool === 'eraser') setTool('pen');
                }}
                className={`h-8 w-8 rounded-lg border-2 transition ${color === c ? 'scale-110 border-lime-400 ring-2 ring-lime-400' : 'border-night'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
