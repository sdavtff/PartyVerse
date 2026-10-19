import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // `prisma generate` não precisa de banco: sem DATABASE_URL usamos um endereço fictício
  // para que a instalação (postinstall) e o build funcionem em qualquer máquina.
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/placeholder',
  },
});
