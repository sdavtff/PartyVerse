import { HTTPClient, OpenRouter } from '@openrouter/sdk';
import type { ChatStreamChunk } from '@openrouter/sdk/models';
import { logger } from './logger.js';

export interface OpenRouterConfig {
  apiKey?: string;
  model: string;
  /** para testes */
  fetchFn?: typeof fetch;
  /** endereço do site (a OpenRouter mostra no painel de uso) */
  referer?: string;
}

/** Um cliente por chave (o SDK guarda configuração e conexões). */
const clients = new Map<string, OpenRouter>();
function clientFor(cfg: OpenRouterConfig, timeoutMs: number) {
  const key = `${cfg.apiKey}|${cfg.referer ?? ''}|${timeoutMs}`;
  let c = cfg.fetchFn ? undefined : clients.get(key);
  if (!c) {
    c = new OpenRouter({
      apiKey: cfg.apiKey,
      httpReferer: cfg.referer ?? 'https://partyverse.app',
      appTitle: 'PartyVerse Daily',
      timeoutMs,
      // quem tenta de novo é o gerador do desafio (2 tentativas); aqui falha rápido
      retryConfig: { strategy: 'none' },
      ...(cfg.fetchFn ? { httpClient: new HTTPClient({ fetcher: cfg.fetchFn }) } : {}),
    });
    if (!cfg.fetchFn) clients.set(key, c);
  }
  return c;
}

/**
 * Pede uma resposta em JSON ao modelo pelo SDK oficial da OpenRouter, com streaming
 * (o texto chega aos poucos; os tokens de raciocínio vêm no último pedaço).
 * Devolve o JSON já convertido, ou null se algo falhar.
 */
export async function chatJson<T>(
  cfg: OpenRouterConfig,
  system: string,
  user: string,
  timeoutMs = 60_000,
): Promise<T | null> {
  if (!cfg.apiKey) return null;
  try {
    const stream = await clientFor(cfg, timeoutMs).chat.send({
      chatRequest: {
        model: cfg.model,
        temperature: 0.9,
        responseFormat: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: true,
      },
    });

    let raw = '';
    for await (const chunk of stream as AsyncIterable<ChatStreamChunk>) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) raw += content;
      if (chunk.error) throw new Error(`OpenRouter: ${chunk.error.message ?? 'erro no streaming'}`);
      if (chunk.usage)
        logger.debug(
          {
            reasoningTokens: chunk.usage.completionTokensDetails?.reasoningTokens,
            totalTokens: chunk.usage.totalTokens,
          },
          'openrouter: uso de tokens',
        );
    }

    raw = raw.trim();
    if (!raw) return null;
    // alguns modelos envolvem em ```json ou escrevem algo antes/depois: pega o objeto JSON
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('resposta sem JSON');
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch (err) {
    logger.warn({ err: String(err) }, 'openrouter failed');
    return null;
  }
}
