import { logger } from './logger.js';

export interface OpenRouterConfig {
  apiKey?: string;
  model: string;
  /** para testes */
  fetchFn?: typeof fetch;
  /** endereço do site (a OpenRouter mostra no painel de uso) */
  referer?: string;
}

/** Chama o chat completions da OpenRouter e devolve o JSON parseado, ou null se falhar. */
export async function chatJson<T>(
  cfg: OpenRouterConfig,
  system: string,
  user: string,
  timeoutMs = 25_000,
): Promise<T | null> {
  if (!cfg.apiKey) return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await (cfg.fetchFn ?? fetch)('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': cfg.referer ?? 'https://partyverse.app',
        'X-Title': 'PartyVerse Daily',
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn({ status: res.status, body: body.slice(0, 300) }, 'openrouter error');
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    // alguns modelos envolvem em ```json ou escrevem algo antes/depois: pega o objeto JSON
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('resposta sem JSON');
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch (err) {
    logger.warn({ err: String(err) }, 'openrouter failed');
    return null;
  } finally {
    clearTimeout(t);
  }
}
