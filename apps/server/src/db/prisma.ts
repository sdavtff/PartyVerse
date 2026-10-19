import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { pgConfig } from './pgconfig.js';

let client: PrismaClient | null = null;

export function getPrisma(databaseUrl: string): PrismaClient {
  if (!client) client = new PrismaClient({ adapter: new PrismaPg(pgConfig(databaseUrl)) });
  return client;
}

export type { PrismaClient };
