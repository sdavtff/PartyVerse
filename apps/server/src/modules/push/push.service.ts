import webpush from 'web-push';
import type { PrismaClient } from '../../db/prisma.js';
import { logger } from '../../lib/logger.js';

export interface PushSub {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushRepository {
  save(sub: PushSub): Promise<void>;
  remove(endpoint: string, userId?: string): Promise<void>;
  forUser(userId: string): Promise<PushSub[]>;
  /** Inscrições de quem ainda não fez nenhum desafio no dia. */
  withoutDaily(day: string): Promise<PushSub[]>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

export class PrismaPushRepository implements PushRepository {
  constructor(private db: PrismaClient) {}
  async save(s: PushSub) {
    await this.db.pushSubscription.upsert({
      where: { endpoint: s.endpoint },
      create: s,
      update: { userId: s.userId, p256dh: s.p256dh, auth: s.auth },
    });
  }
  async remove(endpoint: string, userId?: string) {
    await this.db.pushSubscription.deleteMany({
      where: { endpoint, ...(userId ? { userId } : {}) },
    });
  }
  forUser(userId: string) {
    return this.db.pushSubscription.findMany({
      where: { userId },
      select: { userId: true, endpoint: true, p256dh: true, auth: true },
    });
  }
  withoutDaily(day: string) {
    return this.db.pushSubscription.findMany({
      where: { user: { banned: false, daily: { none: { day } } } },
      select: { userId: true, endpoint: true, p256dh: true, auth: true },
    });
  }
  async getSetting(key: string) {
    return (await this.db.appSetting.findUnique({ where: { key } }))?.value ?? null;
  }
  async setSetting(key: string, value: string) {
    await this.db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}

export class MemoryPushRepository implements PushRepository {
  readonly subs = new Map<string, PushSub>();
  readonly settings = new Map<string, string>();
  /** quem já fez o desafio em cada dia (testes) */
  readonly played = new Set<string>();
  async save(s: PushSub) {
    this.subs.set(s.endpoint, s);
  }
  async remove(endpoint: string, userId?: string) {
    const s = this.subs.get(endpoint);
    if (s && (!userId || s.userId === userId)) this.subs.delete(endpoint);
  }
  async forUser(userId: string) {
    return [...this.subs.values()].filter((s) => s.userId === userId);
  }
  async withoutDaily(day: string) {
    return [...this.subs.values()].filter((s) => !this.played.has(`${s.userId}:${day}`));
  }
  async getSetting(key: string) {
    return this.settings.get(key) ?? null;
  }
  async setSetting(key: string, value: string) {
    this.settings.set(key, value);
  }
}

export interface PushMessage {
  title: string;
  body: string;
  /** caminho aberto ao tocar na notificação */
  url: string;
  /** notificações com a mesma etiqueta se substituem */
  tag?: string;
}

export type PushSender = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  opts: { vapidDetails: { subject: string; publicKey: string; privateKey: string }; TTL: number },
) => Promise<unknown>;

const DAILY_KEY = 'push:daily-last';
/** lembrete do desafio do dia a partir do meio-dia (horário de Brasília) */
const DAILY_HOUR_BRT = 12;

/**
 * Notificações push (Web Push, padrão aberto: funciona no Chrome, Edge, Firefox e no
 * iPhone com o app instalado na tela de início). As chaves VAPID vêm do .env ou são
 * geradas na primeira vez e guardadas no banco, para não mudarem a cada reinício.
 */
export class PushService {
  private keys: { publicKey: string; privateKey: string } | null = null;
  private ready: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private repo: PushRepository,
    private opts: {
      publicKey?: string;
      privateKey?: string;
      subject: string;
      sender?: PushSender;
    },
  ) {}

  private init() {
    this.ready ??= (async () => {
      if (this.opts.publicKey && this.opts.privateKey) {
        this.keys = { publicKey: this.opts.publicKey, privateKey: this.opts.privateKey };
        return;
      }
      const saved = await this.repo.getSetting('vapid').catch(() => null);
      if (saved) {
        this.keys = JSON.parse(saved) as { publicKey: string; privateKey: string };
        return;
      }
      const k = webpush.generateVAPIDKeys();
      this.keys = { publicKey: k.publicKey, privateKey: k.privateKey };
      await this.repo.setSetting('vapid', JSON.stringify(this.keys));
      logger.info('chaves VAPID geradas e salvas no banco');
    })().catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  async publicKey() {
    await this.init();
    return this.keys!.publicKey;
  }

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.repo.save({ userId, endpoint: sub.endpoint, ...sub.keys });
  }

  unsubscribe(userId: string, endpoint: string) {
    return this.repo.remove(endpoint, userId);
  }

  async hasSubscription(userId: string) {
    return (await this.repo.forUser(userId)).length > 0;
  }

  /** Envia para todos os aparelhos da pessoa. Retorna quantos receberam. */
  async notify(userId: string, msg: PushMessage) {
    return this.send(await this.repo.forUser(userId), msg);
  }

  private async send(subs: PushSub[], msg: PushMessage) {
    if (!subs.length) return 0;
    await this.init();
    const send = this.opts.sender ?? (webpush.sendNotification.bind(webpush) as PushSender);
    const payload = JSON.stringify(msg);
    let ok = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            vapidDetails: { subject: this.opts.subject, ...this.keys! },
            TTL: 60 * 60 * 6,
          });
          ok++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // inscrição expirada ou cancelada no navegador: some da lista
          if (status === 404 || status === 410) await this.repo.remove(s.endpoint).catch(() => {});
          else logger.warn({ status, err: String(err) }, 'falha ao enviar push');
        }
      }),
    );
    return ok;
  }

  /** Lembrete diário do desafio para quem ainda não jogou (uma vez por dia). */
  async dailyReminder(day: string, hourBrt: number) {
    if (hourBrt < DAILY_HOUR_BRT || hourBrt >= 22) return 0;
    if ((await this.repo.getSetting(DAILY_KEY)) === day) return 0;
    await this.repo.setSetting(DAILY_KEY, day);
    return this.send(await this.repo.withoutDaily(day), {
      title: 'Desafio do dia 🧠',
      body: 'O Quiz, a Adedonha e o Termo de hoje já estão esperando. Bora manter a sequência?',
      url: '/desafio',
      tag: 'daily',
    });
  }

  start(dayKey: () => string) {
    const tick = () => {
      const hour = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          hour: 'numeric',
          hourCycle: 'h23',
        }).format(new Date()),
      );
      this.dailyReminder(dayKey(), hour).catch((err) =>
        logger.warn({ err: String(err) }, 'lembrete diário falhou'),
      );
    };
    this.timer = setInterval(tick, 10 * 60_000);
    this.timer.unref?.();
    setTimeout(tick, 30_000).unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}
