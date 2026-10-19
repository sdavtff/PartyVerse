/** Situação do banco de dados, para responder rápido (e com mensagem clara) quando ele está fora. */
export type DbState = 'off' | 'connecting' | 'ok' | 'error';

export const dbStatus: {
  state: DbState;
  error: string | null;
  /** explicação em português do provável motivo (nunca inclui senha) */
  hint: string | null;
  since: number;
} = { state: 'off', error: null, hint: null, since: Date.now() };

/** Traduz o erro de conexão para uma dica prática. */
export function explainDbError(message: string, code?: string, url?: string): string {
  const m = `${code ?? ''} ${message}`.toLowerCase();
  let host = '';
  let port = '';
  try {
    const u = new URL(url ?? '');
    host = u.hostname;
    port = u.port;
  } catch {
    return 'O DATABASE_URL não é um endereço válido. Ele deve começar com postgresql:// (copie de novo do Supabase).';
  }
  if (m.includes('[your-password]') || (url ?? '').includes('[YOUR-PASSWORD]'))
    return 'O endereço ainda tem [YOUR-PASSWORD]. Troque pelo sua senha do banco (sem os colchetes).';
  if (m.includes('password authentication failed') || m.includes('28p01'))
    return 'Senha do banco incorreta. No Supabase: Project Settings → Database → Reset database password, e use uma senha só com letras e números.';
  if (m.includes('tenant or user not found') || m.includes('xx000'))
    return 'Usuário do pooler inválido. Use o endereço "Session pooler" do Supabase, que começa com postgresql://postgres.SEU-PROJETO:...';
  if (host.startsWith('db.') && host.endsWith('.supabase.co'))
    return 'Você usou a "Direct connection" do Supabase, que só funciona em IPv6. Troque pela "Session pooler" (host termina em pooler.supabase.com, porta 5432).';
  if (m.includes('enotfound') || m.includes('eai_again'))
    return `O endereço do banco (${host}) não foi encontrado. Confira se copiou o host certo.`;
  if (m.includes('enetunreach') || m.includes('ehostunreach'))
    return 'O servidor não alcança esse endereço (provável IPv6). Use a "Session pooler" do Supabase.';
  if (m.includes('timeout') || m.includes('etimedout'))
    return `A conexão com ${host}:${port || '5432'} expirou. Se for Supabase, use a "Session pooler" (porta 5432). Se continuar, a hospedagem pode estar bloqueando essa porta.`;
  if (m.includes('econnrefused'))
    return `Conexão recusada em ${host}:${port || '5432'}. Confira host e porta.`;
  if (m.includes('ssl') || m.includes('certificate'))
    return 'Problema de SSL na conexão. Remova "?sslmode=..." do final do endereço.';
  if (m.includes('does not exist') && m.includes('database'))
    return 'O nome do banco no final do endereço não existe. No Supabase ele é /postgres.';
  return 'Não foi possível conectar ao banco. Confira o DATABASE_URL.';
}

export function setDbState(
  state: DbState,
  error: string | null = null,
  hint: string | null = null,
) {
  dbStatus.state = state;
  dbStatus.error = error;
  dbStatus.hint = hint;
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
