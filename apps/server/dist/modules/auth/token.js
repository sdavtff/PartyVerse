import jwt from 'jsonwebtoken';
import { z } from 'zod';
const claimsSchema = z.object({
    sub: z.string(),
    nick: z.string(),
    av: z.string(),
    g: z.boolean(),
});
export const TOKEN_COOKIE = 'pv_token';
const TTL_SECONDS = 60 * 60 * 24 * 30;
export class TokenService {
    secret;
    constructor(secret) {
        this.secret = secret;
    }
    sign(id) {
        return jwt.sign({ sub: id.id, nick: id.nickname, av: id.avatar, g: id.isGuest }, this.secret, {
            expiresIn: TTL_SECONDS,
            algorithm: 'HS256',
        });
    }
    verify(token) {
        try {
            const c = claimsSchema.parse(jwt.verify(token, this.secret, { algorithms: ['HS256'] }));
            return { id: c.sub, nickname: c.nick, avatar: c.av, isGuest: c.g };
        }
        catch {
            return null;
        }
    }
    static maxAgeMs = TTL_SECONDS * 1000;
}
export function readCookie(header, name) {
    if (!header)
        return undefined;
    for (const part of header.split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === name)
            return decodeURIComponent(v.join('='));
    }
    return undefined;
}
