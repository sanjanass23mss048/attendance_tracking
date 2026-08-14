import { PrismaClient } from '@prisma/client';
import { getRequestPrisma } from './tenantContext.js';

const globalForPrisma = globalThis;

/** Cap pool size so we don't exhaust shared VPS Postgres (max_connections). */
export function withPoolLimits(rawUrl) {
  const raw = rawUrl || '';
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

export function createPrismaClient(databaseUrl) {
  return new PrismaClient({
    datasources: { db: { url: withPoolLimits(databaseUrl) } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

/** Bright Future apex database (DATABASE_URL / Attendence). */
export const controlPrisma =
  globalForPrisma.controlPrisma ?? createPrismaClient(process.env.DATABASE_URL || '');

globalForPrisma.controlPrisma = controlPrisma;

/**
 * Request-scoped Prisma (tenant or apex). Falls back to Bright Future DB.
 * Existing `import { prisma }` call sites keep working under tenant ALS.
 */
export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getRequestPrisma() || controlPrisma;
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);

globalForPrisma.prisma = controlPrisma;
