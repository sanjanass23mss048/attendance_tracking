import { getRegistryPool, parseDatabaseUrl, templateTenantUrl } from '../lib/tenantDb.js';
import { dbNameForSlug } from '../lib/tenantHost.js';

function mapRow(r) {
  if (!r) return null;
  return {
    orgId: r.org_id,
    slug: r.subdomain,
    dbHost: r.db_host,
    dbPort: r.db_port,
    dbName: r.db_name,
    dbUser: r.db_user,
    dbPassword: r.db_password,
    adminEmail: r.email,
    isActive: r.is_active,
    createdOn: r.created_at,
    updatedOn: r.updated_at,
  };
}

/** ALM-style org_id: uppercase alphanumeric, max 10. */
export function orgIdFromSlug(slug) {
  const normalized = String(slug || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!normalized) throw new Error('Invalid slug for tenant registry');
  return normalized.slice(0, 10);
}

export async function findTenantBySlug(slug) {
  const { rows } = await getRegistryPool().query(
    `SELECT * FROM "tenants" WHERE LOWER(TRIM(subdomain)) = $1 LIMIT 1`,
    [String(slug || '').trim().toLowerCase()]
  );
  return mapRow(rows[0]);
}

export async function findTenantByOrgId(orgId) {
  const { rows } = await getRegistryPool().query(
    `SELECT * FROM "tenants" WHERE org_id = $1 LIMIT 1`,
    [String(orgId || '').toUpperCase()]
  );
  return mapRow(rows[0]);
}

export async function findTenantByDbName(dbName) {
  const { rows } = await getRegistryPool().query(
    `SELECT * FROM "tenants" WHERE db_name = $1 LIMIT 1`,
    [String(dbName)]
  );
  return mapRow(rows[0]);
}

export async function listTenants() {
  const { rows } = await getRegistryPool().query(
    `SELECT * FROM "tenants" ORDER BY created_at DESC`
  );
  return (rows || []).map(mapRow);
}

export async function insertTenant({ slug, dbName, adminEmail } = {}) {
  const subdomain = String(slug || '').trim().toLowerCase();
  let orgId = orgIdFromSlug(subdomain);
  const clash = await findTenantByOrgId(orgId);
  if (clash && clash.slug !== subdomain) {
    orgId = `${orgId.slice(0, 7)}${Date.now().toString().slice(-3)}`.slice(0, 10);
  }

  const cfg = parseDatabaseUrl(templateTenantUrl());
  const email = adminEmail ? String(adminEmail).trim().toLowerCase() : null;
  const name = dbName || dbNameForSlug(subdomain);

  await getRegistryPool().query(
    `INSERT INTO "tenants"
      (org_id, db_host, db_port, db_name, db_user, db_password, subdomain, email, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
     ON CONFLICT (org_id) DO UPDATE
       SET db_host = EXCLUDED.db_host,
           db_port = EXCLUDED.db_port,
           db_name = EXCLUDED.db_name,
           db_user = EXCLUDED.db_user,
           db_password = EXCLUDED.db_password,
           subdomain = EXCLUDED.subdomain,
           email = COALESCE(EXCLUDED.email, "tenants".email),
           updated_at = CURRENT_TIMESTAMP,
           is_active = true`,
    [
      orgId,
      cfg.host,
      cfg.port || 5432,
      name,
      cfg.user,
      cfg.password,
      subdomain,
      email,
    ]
  );
  return findTenantBySlug(subdomain);
}

export async function deleteTenantBySlug(slug) {
  await getRegistryPool().query(
    `DELETE FROM "tenants" WHERE LOWER(TRIM(subdomain)) = $1`,
    [String(slug || '').trim().toLowerCase()]
  );
}
