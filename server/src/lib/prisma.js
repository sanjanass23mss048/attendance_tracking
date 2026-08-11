import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

/** Cap pool size so we don't exhaust shared VPS Postgres (max_connections). */
function datasourceUrl() {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '5');
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '20');
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: datasourceUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Always reuse one client (prod + dev) — multiple PrismaClients open many PG sessions.
globalForPrisma.prisma = prisma;
