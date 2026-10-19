import type { DrawOp } from '@partyverse/shared';

/** Canvas lógico (todas as coordenadas trafegam nesta escala). */
export const W = 800;
export const H = 600;
export const BG = '#ffffff';

export type Item = Extract<DrawOp, { t: 's' | 'sh' | 'f' }>;

/** Aplica operações a uma lista de itens (mesma regra do servidor). */
export function applyOps(items: Item[], ops: DrawOp[]): { items: Item[]; full: boolean } {
  let full = false;
  for (const op of ops) {
    if (op.t === 'clear') {
      items = [];
      full = true;
    } else if (op.t === 'u') {
      items = items.slice(0, -1);
      full = true;
    } else if (op.t === 'a') {
      for (let k = items.length - 1; k >= 0; k--) {
        const it = items[k]!;
        if (it.id === op.id && it.t === 's') {
          it.p.push(...op.p);
          break;
        }
      }
    } else {
      items.push(op.t === 's' ? { ...op, p: [...op.p] } : { ...op });
    }
  }
  return { items, full };
}

export function clearCanvas(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
}

/** Desenha um trecho de traço (de `from` em diante, em pares x,y). */
export function drawStroke(ctx: CanvasRenderingContext2D, it: Extract<Item, { t: 's' }>, from = 0) {
  const p = it.p;
  if (p.length < 2) return;
  ctx.strokeStyle = it.e ? BG : it.c;
  ctx.fillStyle = it.e ? BG : it.c;
  ctx.lineWidth = it.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const start = Math.max(0, from - 2);
  if (p.length === 2 || (start === 0 && p.length === 2)) {
    ctx.beginPath();
    ctx.arc(p[0]!, p[1]!, it.w / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(p[start]!, p[start + 1]!);
  for (let i = start + 2; i < p.length; i += 2) ctx.lineTo(p[i]!, p[i + 1]!);
  ctx.stroke();
}

export function drawShape(ctx: CanvasRenderingContext2D, it: Extract<Item, { t: 'sh' }>) {
  const [x1, y1, x2, y2] = it.p;
  ctx.strokeStyle = it.c;
  ctx.fillStyle = it.c;
  ctx.lineWidth = it.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (it.k === 'line') {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return;
  }
  if (it.k === 'rect')
    ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  else
    ctx.ellipse(
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      Math.max(1, Math.abs(x2 - x1) / 2),
      Math.max(1, Math.abs(y2 - y1) / 2),
      0,
      0,
      Math.PI * 2,
    );
  if (it.f) ctx.fill();
  else ctx.stroke();
}

const hex = (c: string) =>
  [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

/** Balde de tinta (preenchimento por inundação com tolerância). */
export function floodFill(ctx: CanvasRenderingContext2D, x0: number, y0: number, color: string) {
  const x = Math.round(x0);
  const y = Math.round(y0);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const at = (px: number, py: number) => (py * W + px) * 4;
  const i0 = at(x, y);
  const target = [d[i0]!, d[i0 + 1]!, d[i0 + 2]!];
  const [r, g, b] = hex(color);
  if (Math.abs(target[0]! - r) + Math.abs(target[1]! - g) + Math.abs(target[2]! - b) < 8) return;
  const TOL = 48;
  const match = (i: number) =>
    Math.abs(d[i]! - target[0]!) +
      Math.abs(d[i + 1]! - target[1]!) +
      Math.abs(d[i + 2]! - target[2]!) <=
    TOL;
  const seen = new Uint8Array(W * H);
  const stack: number[] = [x, y];
  while (stack.length) {
    const py = stack.pop()!;
    let px = stack.pop()!;
    while (px >= 0 && match(at(px, py)) && !seen[py * W + px]) px--;
    px++;
    let up = false;
    let down = false;
    while (px < W && match(at(px, py)) && !seen[py * W + px]) {
      const i = at(px, py);
      seen[py * W + px] = 1;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
      if (py > 0) {
        const m = match(at(px, py - 1)) && !seen[(py - 1) * W + px];
        if (m && !up) stack.push(px, py - 1);
        up = m;
      }
      if (py < H - 1) {
        const m = match(at(px, py + 1)) && !seen[(py + 1) * W + px];
        if (m && !down) stack.push(px, py + 1);
        down = m;
      }
      px++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function drawItem(ctx: CanvasRenderingContext2D, it: Item) {
  if (it.t === 's') drawStroke(ctx, it);
  else if (it.t === 'sh') drawShape(ctx, it);
  else floodFill(ctx, it.x, it.y, it.c);
}

export function redraw(ctx: CanvasRenderingContext2D, items: Item[]) {
  clearCanvas(ctx);
  for (const it of items) drawItem(ctx, it);
}
