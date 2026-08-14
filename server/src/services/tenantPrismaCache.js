import { createPrismaClient } from '../lib/prisma.js';
import { urlFromTenantRow } from '../lib/tenantDb.js';
import { findTenantBySlug } from './tenantRegistry.js';

const cache = new Map();

/**
 * Central lookup: subdomain slug → tenants row credentials → Prisma client.
 * Cached per process. Update TENANT_DATABASE_URL / tenants.db_* to change connections.
 */
export async function getPrismaForSlug(slug) {
  const key = String(slug || '').toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const row = await findTenantBySlug(key);
  if (!row || row.isActive === false) return null;

  const client = createPrismaClient(urlFromTenantRow(row));
  cache.set(key, client);
  return client;
}

export function clearTenantPrismaCache(slug) {
  if (!slug) {
    cache.clear();
    return;
  }
  cache.delete(String(slug).toLowerCase());
}
