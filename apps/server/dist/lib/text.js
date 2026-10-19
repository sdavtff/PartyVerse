/** Normaliza para comparação: minúsculas, sem acentos, espaços colapsados. */
export function normalize(s) {
    return s
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
/** Remove caracteres de controle; o front-end já escapa HTML ao renderizar. */
export function cleanText(s) {
    // eslint-disable-next-line no-control-regex
    return s.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}
