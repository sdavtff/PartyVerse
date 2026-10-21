/**
 * Filtro de palavrões. Compara palavra inteira (sem acentos, letras repetidas juntadas e
 * trocas comuns como 4→a, 0→o, 1→i), para não pegar palavras inocentes como "computador".
 */
const WORDS = [
    'porra',
    'caralho',
    'cacete',
    'merda',
    'bosta',
    'puta',
    'puto',
    'putaria',
    'putinha',
    'foda',
    'foder',
    'fodase',
    'fodido',
    'fodida',
    'fdp',
    'pqp',
    'vsf',
    'vtnc',
    'tnc',
    'krl',
    'crl',
    'buceta',
    'boceta',
    'xoxota',
    'piroca',
    'cu',
    'cuzao',
    'arrombado',
    'arrombada',
    'viado',
    'viadinho',
    'bicha',
    'sapatao',
    'traveco',
    'vagabundo',
    'vagabunda',
    'vadia',
    'piranha',
    'safada',
    'safado',
    'corno',
    'corna',
    'otario',
    'otaria',
    'babaca',
    'idiota',
    'imbecil',
    'retardado',
    'retardada',
    'mongol',
    'desgracado',
    'desgracada',
    'escroto',
    'escrota',
    'canalha',
    'puxasaco',
    'cuzinho',
    'punheta',
    'punheteiro',
    'siririca',
    'tesao',
    'nazista',
    'hitler',
];
/** palavras curtas/comuns demais para bloquear isoladas em nomes e textos gerados */
const CHAT_ONLY = new Set(['cu']);
const SET = new Set(WORDS);
const LEET = {
    '4': 'a',
    '@': 'a',
    '3': 'e',
    '1': 'i',
    '!': 'i',
    '0': 'o',
    '5': 's',
    $: 's',
    '7': 't',
};
export function canon(word) {
    return word
        .toLowerCase()
        .replace(/[4@3105$7!]/g, (c) => LEET[c] ?? c)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z]/g, '')
        .replace(/(.)\1+/g, '$1');
}
/** Variações com letras dobradas legítimas (ex.: "corno" vs "cornno"). */
const CANON = new Set([...SET].map(canon));
const isBad = (w, strict) => {
    const c = canon(w);
    if (!c)
        return false;
    if (!strict && CHAT_ONLY.has(c))
        return CANON.has(c);
    return CANON.has(c) && (strict ? !CHAT_ONLY.has(c) || c.length > 3 : true);
};
const TOKEN = /[\p{L}\p{N}@$!]+/gu;
/** Troca palavrões por asteriscos, mantendo a primeira letra. */
export function maskProfanity(text) {
    return text.replace(TOKEN, (w) => isBad(w, false) ? w[0] + '*'.repeat(Math.max(2, w.length - 1)) : w);
}
/** Há palavrão? (para apelidos e conteúdo gerado; ignora palavras ambíguas como "pinto") */
export function containsProfanity(text) {
    const words = text.match(TOKEN) ?? [];
    if (words.some((w) => isBad(w, true) && !CHAT_ONLY.has(canon(w))))
        return true;
    // apelido grudado: "VaiTomarNoC..." / "fdp123"
    const joined = canon(text);
    return [...SET].some((b) => b.length >= 5 && !CHAT_ONLY.has(b) && joined.includes(canon(b)));
}
