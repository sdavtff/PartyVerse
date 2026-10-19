import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
const TTL_MS = 60 * 60_000; // 1 hora
const MAX_PER_HOUR = 3;
const sha = (t) => createHash('sha256').update(t).digest('hex');
/** "Esqueci minha senha": envia um link com token de uso único e troca a senha. */
export class PasswordResetService {
    users;
    resets;
    mailer;
    publicUrl;
    constructor(users, resets, mailer, publicUrl) {
        this.users = users;
        this.resets = resets;
        this.mailer = mailer;
        this.publicUrl = publicUrl;
    }
    /** Nunca revela se o e-mail existe: a resposta é a mesma de qualquer jeito. */
    async request(email, now = new Date()) {
        const u = await this.users.findByEmail(email.trim().toLowerCase());
        if (!u || u.banned)
            return;
        if ((await this.resets.recentCount(u.id, new Date(now.getTime() - 3600_000))) >= MAX_PER_HOUR)
            return;
        const token = randomBytes(32).toString('base64url');
        await this.resets.create(u.id, sha(token), new Date(now.getTime() + TTL_MS));
        const link = `${this.publicUrl()}/redefinir-senha?token=${token}`;
        const text = `Olá, ${u.nickname}!\n\nRecebemos um pedido para trocar a senha da sua conta no PartyVerse.\n` +
            `Para criar uma senha nova, abra este link (vale por 1 hora):\n\n${link}\n\n` +
            `Se não foi você, é só ignorar este e-mail — sua senha continua a mesma.`;
        const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#16121f">
<h2 style="color:#16121f">Trocar sua senha</h2>
<p>Olá, <b>${u.nickname.replace(/[<>&"]/g, '')}</b>!</p>
<p>Recebemos um pedido para trocar a senha da sua conta no PartyVerse. O link vale por 1 hora.</p>
<p style="margin:28px 0"><a href="${link}" style="background:#c6f432;color:#0f0b17;padding:12px 22px;border-radius:12px;font-weight:bold;text-decoration:none">Criar nova senha</a></p>
<p style="font-size:13px;color:#555">Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
</div>`;
        try {
            await this.mailer.send(u.email, 'PartyVerse: trocar sua senha', text, html);
        }
        catch (err) {
            logger.error({ err: String(err) }, 'falha ao enviar e-mail de senha');
            throw new AppError('INTERNAL', 'Não conseguimos enviar o e-mail agora. Tente mais tarde.', 503);
        }
    }
    async reset(token, password, now = new Date()) {
        const userId = await this.resets.consume(sha(token), now);
        if (!userId)
            throw new AppError('VALIDATION', 'Link inválido ou vencido. Peça um novo e-mail.', 400);
        await this.users.setPassword(userId, await bcrypt.hash(password, 12));
        const u = await this.users.findById(userId);
        return u;
    }
}
