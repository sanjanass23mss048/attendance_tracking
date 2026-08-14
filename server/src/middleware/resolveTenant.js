import { controlPrisma } from '../lib/prisma.js';
import { tenantAls } from '../lib/tenantContext.js';
import { APEX_TENANT, resolveRequestTenantSlug } from '../lib/tenantHost.js';
import { getPrismaForSlug } from '../services/tenantPrismaCache.js';
import { loadAppSettings } from '../lib/appSettings.js';

async function bindTenant(req, res, next, prismaClient, tenant, { loadSettings = true } = {}) {
  req.tenant = tenant;
  req.prisma = prismaClient;
  return tenantAls.run({ prisma: prismaClient, tenant }, async () => {
    if (loadSettings) {
      try {
        await loadAppSettings();
      } catch (err) {
        console.warn('app settings load', err?.message || err);
      }
    }
    next();
  });
}

/**
 * Bind this request to the school Prisma client (or Bright Future on apex).
 * All `import { prisma }` call sites read this ALS store.
 */
export async function resolveTenant(req, res, next) {
  const path = req.path || req.originalUrl || '';
  const loadSettings = path.startsWith('/api') && !path.startsWith('/api/setup');

  if (path.startsWith('/api/setup') || path.startsWith('/health')) {
    return bindTenant(req, res, next, controlPrisma, APEX_TENANT, { loadSettings: false });
  }

  const slug = resolveRequestTenantSlug(req);
  if (!slug || slug === APEX_TENANT) {
    return bindTenant(req, res, next, controlPrisma, APEX_TENANT, { loadSettings });
  }

  try {
    const client = await getPrismaForSlug(slug);
    if (!client) {
      return res.status(404).json({
        error: `Unknown school “${slug}”. Check the URL or create it at /setup.`,
        code: 'UNKNOWN_TENANT',
      });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[tenant] ${slug} ${req.method} ${req.originalUrl}`);
    }
    return bindTenant(req, res, next, client, slug, { loadSettings });
  } catch (err) {
    console.error('resolveTenant', err);
    return res.status(503).json({ error: 'School database unavailable' });
  }
}
