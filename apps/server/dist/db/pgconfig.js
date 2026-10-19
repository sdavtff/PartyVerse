/**
 * Configuração de conexão PostgreSQL usada pelo Prisma e pelas migrations.
 * Bancos remotos (Supabase, Neon…) usam SSL; o parâmetro sslmode da URL é removido para não
 * conflitar com a configuração abaixo (o driver `pg` trataria `require` como verificação total
 * de certificado, o que falha em alguns provedores).
 */
export function pgConfig(databaseUrl) {
    let connectionString = databaseUrl;
    let ssl = false;
    try {
        const u = new URL(databaseUrl);
        const mode = u.searchParams.get('sslmode');
        u.searchParams.delete('sslmode');
        connectionString = u.toString();
        const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
        ssl = mode === 'disable' || (local && !mode) ? false : { rejectUnauthorized: false };
    }
    catch {
        /* URL inválida: o erro aparece ao conectar */
    }
    return { connectionString, ssl, connectionTimeoutMillis: 15_000 };
}
