import { AsyncLocalStorage } from 'node:async_hooks';

/** Per-request tenant Prisma client + slug. */
export const tenantAls = new AsyncLocalStorage();

export function getRequestTenant() {
  return tenantAls.getStore()?.tenant || 'apex';
}

export function getRequestPrisma() {
  return tenantAls.getStore()?.prisma || null;
}
