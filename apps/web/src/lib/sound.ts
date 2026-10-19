/**
 * Efeitos sonoros sintetizados com Web Audio (sem arquivos de áudio para baixar).
 * Respeitam a preferência "som" — veja prefs.tsx, que chama setSoundEnabled.
 */
export type Sfx =
  | 'click'
  | 'tick'
  | 'go'
  | 'correct'
  | 'wrong'
  | 'stop'
  | 'reveal'
  | 'join'
  | 'message'
  | 'win'
  | 'lose';

let enabled = true;
let ctx: AudioContext | null = null;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// navegadores só liberam áudio depois de um gesto do usuário
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

interface Note {
  f: number; // frequência (Hz)
  t: number; // início (s, relativo)
  d: number; // duração (s)
  type?: OscillatorType;
  v?: number; // volume 0..1
  slide?: number; // frequência final (glissando)
}

function play(notes: Note[]) {
  const ac = audio();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = 0.18;
  master.connect(ac.destination);
  const t0 = ac.currentTime + 0.01;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? 'triangle';
    osc.frequency.setValueAtTime(n.f, t0 + n.t);
    if (n.slide) osc.frequency.exponentialRampToValueAtTime(n.slide, t0 + n.t + n.d);
    const v = n.v ?? 1;
    g.gain.setValueAtTime(0.0001, t0 + n.t);
    g.gain.exponentialRampToValueAtTime(v, t0 + n.t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.t + n.d);
    osc.connect(g).connect(master);
    osc.start(t0 + n.t);
    osc.stop(t0 + n.t + n.d + 0.05);
  }
}

const C5 = 523.25,
  E5 = 659.25,
  G5 = 783.99,
  C6 = 1046.5,
  A4 = 440;

const SOUNDS: Record<Sfx, Note[]> = {
  click: [{ f: 900, t: 0, d: 0.05, type: 'square', v: 0.25 }],
  tick: [{ f: 1200, t: 0, d: 0.06, type: 'sine', v: 0.5 }],
  go: [
    { f: C5, t: 0, d: 0.12 },
    { f: G5, t: 0.1, d: 0.22 },
  ],
  correct: [
    { f: E5, t: 0, d: 0.1 },
    { f: C6, t: 0.08, d: 0.25 },
  ],
  wrong: [{ f: 220, t: 0, d: 0.35, type: 'sawtooth', v: 0.35, slide: 140 }],
  stop: [
    { f: A4, t: 0, d: 0.12, type: 'square', v: 0.5 },
    { f: A4, t: 0.16, d: 0.12, type: 'square', v: 0.5 },
    { f: 880, t: 0.32, d: 0.3, type: 'square', v: 0.5 },
  ],
  reveal: [{ f: 300, t: 0, d: 0.5, type: 'sine', v: 0.6, slide: 900 }],
  join: [
    { f: G5, t: 0, d: 0.08, type: 'sine', v: 0.4 },
    { f: C6, t: 0.07, d: 0.12, type: 'sine', v: 0.4 },
  ],
  message: [{ f: 1500, t: 0, d: 0.05, type: 'sine', v: 0.2 }],
  win: [
    { f: C5, t: 0, d: 0.14 },
    { f: E5, t: 0.12, d: 0.14 },
    { f: G5, t: 0.24, d: 0.14 },
    { f: C6, t: 0.36, d: 0.5 },
    { f: G5, t: 0.36, d: 0.5, v: 0.5 },
  ],
  lose: [
    { f: G5, t: 0, d: 0.2, type: 'sine' },
    { f: E5, t: 0.18, d: 0.2, type: 'sine' },
    { f: C5, t: 0.36, d: 0.45, type: 'sine' },
  ],
};

export function sfx(name: Sfx) {
  if (!enabled) return;
  try {
    play(SOUNDS[name]);
  } catch {
    /* som nunca quebra o jogo */
  }
}
