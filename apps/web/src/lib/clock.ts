/**
 * Diferença entre o relógio do servidor e o deste aparelho (ms).
 * Os prazos do jogo vêm em horário do servidor; sem essa correção, um celular com o relógio
 * adiantado veria o cronômetro errado.
 */
let skew = 0;

export function syncClock(serverNow: unknown) {
  if (typeof serverNow !== 'number') return;
  const measured = serverNow - Date.now();
  // suaviza para não "pular" por causa da latência de uma mensagem isolada
  skew = skew === 0 ? measured : skew * 0.7 + measured * 0.3;
}

export const clockSkew = () => skew;
export const serverNow = () => Date.now() + skew;
