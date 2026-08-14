import { controlPrisma } from '../lib/prisma.js';
import { tenantAls } from '../lib/tenantContext.js';
import { APEX_TENANT, resolveRequestTenantSlug } from '../lib/tenantHost.js';
import { getPrismaForSlug } from '../services/tenantPrismaCache.js';

/**
 * Bind this request to the school Prisma client (or Bright Future on apex).
 * All `import { prisma }` call sites read this ALS store.
 */
export async function resolveTenant(req, res, next) {
  const path = req.path || req.originalUrl || '';
  if (path.startsWith('/api/setup') || path.startsWith('/health')) {
    req.tenant = APEX_TENANT;
    return tenantAls.run({ prisma: controlPrisma, tenant: APEX_TENANT }, () => next());
  }

  const slug = resolveRequestTenantSlug(req);
  if (!slug || slug === APEX_TENANT) {
    req.tenant = APEX_TENANT;
    return tenantAls.run({ prisma: controlPrisma, tenant: APEX_TENANT }, () => next());
  }

  try {
    const client = await getPrismaForSlug(slug);
    if (!client) {
      return res.status(404).json({
        error: `Unknown school “${slug}”. Check the URL or create it at /setup.`,
        code: 'UNKNOWN_TENANT',
      });
    }
    req.tenant = slug;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[tenant] ${slug} ${req.method} ${req.originalUrl}`);
    }
    return tenantAls.run({ prisma: client, tenant: slug }, () => next());
  } catch (err) {
    console.error('resolveTenant', err);
    return res.status(503).json({ error: 'School database unavailable' });
  }
}
