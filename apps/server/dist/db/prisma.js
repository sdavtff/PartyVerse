import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { pgConfig } from './pgconfig.js';
let client = null;
export function getPrisma(databaseUrl) {
    if (!client)
        client = new PrismaClient({ adapter: new PrismaPg(pgConfig(databaseUrl)) });
    return client;
}
