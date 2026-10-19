import { randomBytes, randomInt, randomUUID } from 'node:crypto';
// Sem 0/O/1/I para facilitar a leitura em voz alta
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(length = 6) {
    let s = '';
    for (let i = 0; i < length; i++)
        s += ALPHABET[randomInt(ALPHABET.length)];
    return s;
}
export const uid = () => randomUUID();
export const guestId = () => 'g_' + randomBytes(9).toString('base64url');
export const pick = (arr) => arr[randomInt(arr.length)];
