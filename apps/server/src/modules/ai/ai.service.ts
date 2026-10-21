import type { AiKind, CustomQuestion } from '@partyverse/shared';
import { z } from 'zod';
import { chatJson, type OpenRouterConfig } from '../../lib/openrouter.js';
import { normalize } from '../../lib/text.js';
import { containsProfanity } from '../moderation/profanity.js';

const SYSTEM =
  'Você cria conteúdo para um site brasileiro de jogos em grupo, para todas as idades. ' +
  'Escreve em português do Brasil, confere fatos com cuidado, evita temas ofensivos, políticos ' +
  'ou impróprios para crianças e responde APENAS com JSON válido.';

/** Recurso usado pelos jogos durante a partida (o jogo nunca chama a API diretamente). */
export interface GameAi {
  /** Juiz da Adedonha: devolve, por jogador, as categorias com resposta suspeita. */
  judgeStop(
    letter: string,
    categories: string[],
    answers: Record<string, Record<string, string>>,
  ): Promise<Record<string, string[]>>;
}

const clean = (xs: string[], max: number, len: number) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of xs) {
    const x = raw.trim().replace(/\s+/g, ' ');
    const k = normalize(x);
    if (x.length < 2 || x.length > len || seen.has(k) || containsProfanity(x)) continue;
    seen.add(k);
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
};

export class AiService implements GameAi {
  constructor(private cfg: OpenRouterConfig) {}

  get enabled() {
    return Boolean(this.cfg.apiKey);
  }

  private ask<T>(user: string, timeoutMs = 45_000) {
    return chatJson<T>(this.cfg, SYSTEM, user, timeoutMs);
  }

  private need<T>(v: T | null): T {
    if (v === null) throw new Error('A IA não respondeu. Tente de novo em instantes.');
    return v;
  }

  // ---------- conteúdo por tema (anfitrião no lobby) ----------

  async quiz(theme: string, count = 15): Promise<CustomQuestion[]> {
    const raw = this.need(
      await this.ask<unknown>(
        `Crie ${count} perguntas de quiz de múltipla escolha sobre o tema "${theme}".\n` +
          '- Fatos verdadeiros e estáveis; uma única resposta certa; 3 erradas plausíveis do mesmo tipo.\n' +
          '- Misture fáceis, médias e difíceis. Respostas com até 6 palavras.\n' +
          '- Se o tema for sobre pessoas comuns (ex.: "minha turma"), faça perguntas gerais e divertidas relacionadas ao assunto, sem inventar fatos sobre pessoas reais.\n' +
          'Formato: {"perguntas":[{"pergunta":"...","certa":"...","erradas":["...","...","..."]}]}',
      ),
    );
    const data = z
      .object({
        perguntas: z.array(
          z.object({
            pergunta: z.string(),
            certa: z.string(),
            erradas: z.array(z.string()).length(3),
          }),
        ),
      })
      .parse(raw);
    const out: CustomQuestion[] = [];
    const seen = new Set<string>();
    for (const p of data.perguntas) {
      const q = p.pergunta.trim();
      const all = [p.certa, ...p.erradas].map((x) => x.trim());
      if (q.length < 3 || q.length > 160 || all.some((x) => !x || x.length > 60)) continue;
      if (new Set(all.map(normalize)).size !== 4 || seen.has(normalize(q))) continue;
      if (containsProfanity([q, ...all].join(' '))) continue;
      seen.add(normalize(q));
      out.push({ q, a: all[0]!, w: [all[1]!, all[2]!, all[3]!] });
    }
    if (out.length < 5)
      throw new Error('A IA não conseguiu criar perguntas boas. Tente outro tema.');
    return out.slice(0, 60);
  }

  async words(theme: string, count = 40): Promise<string[]> {
    const raw = this.need(
      await this.ask<unknown>(
        `Liste ${count} palavras ou expressões curtas (1 a 3 palavras, até 30 letras) do tema "${theme}" ` +
          'para um jogo de desenhar e adivinhar / mímica. Coisas concretas e reconhecíveis, sem nomes de pessoas comuns.\n' +
          'Formato: {"palavras":["...","..."]}',
      ),
    );
    const words = clean(z.object({ palavras: z.array(z.string()) }).parse(raw).palavras, 200, 30);
    if (words.length < 6) throw new Error('Poucas palavras geradas. Tente outro tema.');
    return words;
  }

  async locations(theme: string, count = 12) {
    const raw = this.need(
      await this.ask<unknown>(
        `Crie ${count} locais para o jogo Impostor (estilo Spyfall) no tema "${theme}". ` +
          'Cada local precisa de 5 papéis de pessoas que estariam lá. Nomes curtos (até 30 letras).\n' +
          'Formato: {"locais":[{"nome":"...","papeis":["...","...","...","...","..."]}]}',
      ),
    );
    const data = z
      .object({ locais: z.array(z.object({ nome: z.string(), papeis: z.array(z.string()) })) })
      .parse(raw);
    const seen = new Set<string>();
    const out: { name: string; roles: string[] }[] = [];
    for (const l of data.locais) {
      const name = l.nome.trim();
      const roles = clean(l.papeis, 8, 30);
      if (name.length < 2 || name.length > 30 || roles.length < 3 || seen.has(normalize(name)))
        continue;
      if (containsProfanity(name)) continue;
      seen.add(normalize(name));
      out.push({ name, roles });
    }
    if (out.length < 5) throw new Error('Poucos locais gerados. Tente outro tema.');
    return out.slice(0, 30);
  }

  async phrases(kind: 'mostlikely' | 'truths' | 'dares', theme: string, count = 25) {
    const ask = {
      mostlikely: `${count} complementos para a frase "Quem é mais provável de…" (ex.: "dormir no cinema"), no tema "${theme}". Só o complemento, sem "Quem é mais provável de".`,
      truths: `${count} perguntas leves de "Verdade" (Verdade ou Desafio) no tema "${theme}", para qualquer idade, sem nada constrangedor ou íntimo.`,
      dares: `${count} desafios leves e seguros de "Desafio" (Verdade ou Desafio) no tema "${theme}", que dê para fazer em chamada de vídeo, sem riscos, sem gastar dinheiro e sem constranger ninguém.`,
    }[kind];
    const raw = this.need(
      await this.ask<unknown>(`Escreva ${ask}\nFormato: {"itens":["...","..."]}`),
    );
    const len = kind === 'mostlikely' ? 100 : 140;
    const items = clean(z.object({ itens: z.array(z.string()) }).parse(raw).itens, 100, len).map(
      (x) =>
        kind === 'mostlikely'
          ? x.replace(/^quem é mais provável de\s*/i, '').replace(/\?$/, '')
          : x,
    );
    if (items.length < 5) throw new Error('Poucas frases geradas. Tente outro tema.');
    return items;
  }

  /** Gera o conteúdo pedido no lobby e devolve as configurações do jogo a salvar. */
  async forRoom(kind: AiKind, theme: string): Promise<Record<string, unknown>> {
    switch (kind) {
      case 'quiz':
        return { category: 'personalizado', customQuestions: await this.quiz(theme) };
      case 'words':
        return { category: 'personalizado', customWords: await this.words(theme) };
      case 'locations':
        return { customLocations: await this.locations(theme) };
      case 'mostlikely':
        return { customPrompts: await this.phrases('mostlikely', theme), onlyCustom: true };
      case 'truths':
        return { customTruths: await this.phrases('truths', theme) };
      case 'dares':
        return { customDares: await this.phrases('dares', theme) };
    }
  }

  // ---------- durante a partida ----------

  async judgeStop(
    letter: string,
    categories: string[],
    answers: Record<string, Record<string, string>>,
  ): Promise<Record<string, string[]>> {
    if (!this.enabled) return {};
    // respostas únicas por categoria (anônimas)
    const byCat: Record<string, string[]> = {};
    for (const c of categories) {
      const set = new Set<string>();
      for (const a of Object.values(answers)) {
        const v = (a[c] ?? '').trim();
        if (v && normalize(v)[0] === normalize(letter)) set.add(v);
      }
      if (set.size) byCat[c] = [...set].slice(0, 40);
    }
    if (!Object.keys(byCat).length) return {};
    const raw = await this.ask<unknown>(
      `Você é o juiz de uma partida de Adedonha (STOP) com a letra "${letter}". ` +
        'Para cada categoria, diga quais respostas NÃO servem (não existem, não pertencem à categoria ou são só letras aleatórias). ' +
        'Seja tolerante com erros pequenos de digitação, acentos e respostas criativas mas corretas. Na dúvida, aceite.\n' +
        `Respostas: ${JSON.stringify(byCat)}\n` +
        'Formato: {"invalidas":{"Categoria":["resposta", "..."]}} (use objeto vazio se todas servirem)',
      20_000,
    );
    if (!raw) return {};
    const parsed = z
      .object({ invalidas: z.record(z.array(z.string())).default({}) })
      .safeParse(raw);
    if (!parsed.success) return {};
    const bad: Record<string, Set<string>> = {};
    for (const [c, list] of Object.entries(parsed.data.invalidas))
      if (categories.includes(c)) bad[c] = new Set(list.map(normalize));
    const out: Record<string, string[]> = {};
    for (const [player, a] of Object.entries(answers)) {
      const flagged = categories.filter((c) => a[c] && bad[c]?.has(normalize(a[c]!)));
      if (flagged.length) out[player] = flagged;
    }
    return out;
  }

  /** Narrador: 2–3 frases bem-humoradas sobre o fim da partida. */
  async narrate(game: string, ranking: { nickname: string; score: number }[], facts: string[]) {
    if (!this.enabled) return null;
    const raw = await this.ask<{ texto?: string }>(
      `Você é o narrador animado de um jogo online chamado PartyVerse. A partida de "${game}" acabou.\n` +
        `Classificação: ${ranking.map((r, i) => `${i + 1}º ${r.nickname} (${r.score} pts)`).join(', ')}.\n` +
        (facts.length ? `Destaques: ${facts.join('; ')}.\n` : '') +
        'Escreva um comentário de 2 a 3 frases curtas, divertido e gentil (sem zoar ninguém de forma maldosa), citando o campeão. ' +
        'Formato: {"texto":"..."}',
      20_000,
    );
    const t = raw?.texto?.trim();
    if (!t || containsProfanity(t)) return null;
    return t.slice(0, 400);
  }
}
