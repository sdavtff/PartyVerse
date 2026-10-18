import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

let client: PrismaClient | null = null;

export function getPrisma(databaseUrl: string): PrismaClient {
  if (!client)
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return client;
}

export type { PrismaClient };
