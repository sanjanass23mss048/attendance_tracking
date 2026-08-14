import { controlPrisma } from '../lib/prisma.js';
import { getRequestPrisma, getRequestTenant, tenantAls } from '../lib/tenantContext.js';
import { APEX_TENANT } from '../lib/tenantHost.js';

/**
 * Multer / stream parsers can finish outside AsyncLocalStorage.
 * Re-enter the tenant store from req.prisma (set by resolveTenant).
 */
export function continueTenantAls(req, fn) {
  if (tenantAls.getStore()?.prisma) return fn();
  const prisma = req.prisma || getRequestPrisma() || controlPrisma;
  const tenant = req.tenant || getRequestTenant() || APEX_TENANT;
  return tenantAls.run({ prisma, tenant }, fn);
}

export function restoreTenantAls(req, res, next) {
  return continueTenantAls(req, () => next());
}
