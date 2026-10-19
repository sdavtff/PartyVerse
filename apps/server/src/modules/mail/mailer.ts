import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export interface Mailer {
  readonly enabled: boolean;
  send(to: string, subject: string, text: string, html: string): Promise<void>;
}

/** Envia e-mails por SMTP (ex.: e-mail da Hostinger). Sem SMTP configurado, só registra no log. */
export class SmtpMailer implements Mailer {
  private transport: Transporter | null = null;
  private from: string;
  constructor(env: Env) {
    this.from = env.MAIL_FROM ?? (env.SMTP_USER ? `PartyVerse <${env.SMTP_USER}>` : 'PartyVerse');
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
      });
    }
  }
  get enabled() {
    return this.transport !== null;
  }
  async send(to: string, subject: string, text: string, html: string) {
    if (!this.transport) {
      logger.warn({ to, subject }, 'e-mail não enviado: SMTP não configurado');
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject, text, html });
  }
}

/** Para testes: guarda as mensagens. */
export class MemoryMailer implements Mailer {
  enabled = true;
  sent: { to: string; subject: string; text: string; html: string }[] = [];
  async send(to: string, subject: string, text: string, html: string) {
    this.sent.push({ to, subject, text, html });
  }
}
