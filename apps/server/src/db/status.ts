/** Situação do banco de dados, para responder rápido (e com mensagem clara) quando ele está fora. */
export type DbState = 'off' | 'connecting' | 'ok' | 'error';

export const dbStatus: { state: DbState; error: string | null; since: number } = {
  state: 'off',
  error: null,
  since: Date.now(),
};

export function setDbState(state: DbState, error: string | null = null) {
  dbStatus.state = state;
  dbStatus.error = error;
  dbStatus.since = Date.now();
}

/** Rejeita se a promessa demorar mais que `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<never>((_, rej) => {
      t = setTimeout(() => rej(onTimeout()), ms);
      t.unref?.();
    }),
  ]);
}
