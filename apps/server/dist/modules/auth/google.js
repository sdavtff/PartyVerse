import { randomBytes } from 'node:crypto';
import { AppError } from '../../lib/errors.js';
/**
 * Login com Google (OAuth 2.0 "authorization code"), feito no servidor:
 * o navegador vai ao Google, volta com um código e o servidor troca o código pelo perfil.
 * Só fica ativo com GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET configurados.
 */
export class GoogleAuth {
    clientId;
    clientSecret;
    fetchImpl;
    constructor(clientId, clientSecret, fetchImpl = fetch) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.fetchImpl = fetchImpl;
    }
    get enabled() {
        return Boolean(this.clientId && this.clientSecret);
    }
    newState() {
        return randomBytes(16).toString('base64url');
    }
    authUrl(redirectUri, state) {
        const q = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            prompt: 'select_account',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
    }
    async exchange(code, redirectUri) {
        const tokenRes = await this.fetchImpl('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!tokenRes.ok)
            throw new AppError('UNAUTHORIZED', 'O Google recusou o login', 401);
        const { access_token } = (await tokenRes.json());
        if (!access_token)
            throw new AppError('UNAUTHORIZED', 'O Google recusou o login', 401);
        const infoRes = await this.fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
            signal: AbortSignal.timeout(10_000),
        });
        if (!infoRes.ok)
            throw new AppError('UNAUTHORIZED', 'Não foi possível ler o perfil do Google', 401);
        const p = (await infoRes.json());
        if (!p.sub || !p.email)
            throw new AppError('UNAUTHORIZED', 'Perfil do Google incompleto', 401);
        return {
            sub: p.sub,
            email: p.email.toLowerCase(),
            emailVerified: Boolean(p.email_verified),
            name: p.given_name || p.name || '',
        };
    }
}
/** Apelido válido a partir do nome do Google (letras, números, espaço, _ . -; 2 a 20). */
export function nicknameFrom(name, email) {
    const clean = (s) => s
        .replace(/[^\p{L}\p{N} _.-]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20)
        .trim();
    const fromName = clean(name);
    if (fromName.length >= 2)
        return fromName;
    const fromEmail = clean(email.split('@')[0] ?? '');
    return fromEmail.length >= 2 ? fromEmail : 'Jogador';
}
/** Evita redirecionar para outro site depois do login. */
export const safeReturnPath = (p) => typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && p.length < 200 ? p : '/';
