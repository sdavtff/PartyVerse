import { logger } from './logger.js';
/** Chama o chat completions da OpenRouter e devolve o JSON parseado, ou null se falhar. */
export async function chatJson(cfg, system, user, timeoutMs = 25_000) {
    if (!cfg.apiKey)
        return null;
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
        const data = (await res.json());
        const raw = data.choices?.[0]?.message?.content?.trim();
        if (!raw)
            return null;
        // alguns modelos envolvem em ```json ou escrevem algo antes/depois: pega o objeto JSON
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start < 0 || end <= start)
            throw new Error('resposta sem JSON');
        return JSON.parse(raw.slice(start, end + 1));
    }
    catch (err) {
        logger.warn({ err: String(err) }, 'openrouter failed');
        return null;
    }
    finally {
        clearTimeout(t);
    }
}
