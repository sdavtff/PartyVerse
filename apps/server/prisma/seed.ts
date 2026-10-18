import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const passwordHash = await bcrypt.hash('partyverse123', 10);
  const users = [
    { email: 'ana@partyverse.dev', nickname: 'Ana', avatar: 'blob-3' },
    { email: 'bruno@partyverse.dev', nickname: 'Bruno', avatar: 'star-2' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, stats: { create: {} } },
    });
  }
  console.log('Seed concluído: ana@partyverse.dev / bruno@partyverse.dev (senha: partyverse123)');
}

main().finally(() => prisma.$disconnect());
