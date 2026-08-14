import { getRegistryPool } from './tenantDb.js';

const TENANTS_DDL = `
CREATE TABLE IF NOT EXISTS "tenants" (
    org_id character varying(10) PRIMARY KEY,
    db_host character varying(255) NOT NULL,
    db_port integer NOT NULL DEFAULT 5432,
    db_name character varying(255) NOT NULL,
    db_user character varying(255) NOT NULL,
    db_password text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    subdomain character varying(63) UNIQUE,
    email character varying(320)
)
`;

/**
 * Ensure ALM-style public.tenants exists on Attendence_Tenants.
 * Does not create the database (already provisioned) and does not touch Attendence / ALM.
 */
export async function ensureTenantRegistry() {
  if (!String(process.env.TENANT_DATABASE_URL || '').trim()) {
    console.warn('TENANT_DATABASE_URL not set — skipping tenant registry');
    return;
  }

  const pool = getRegistryPool();
  await pool.query(TENANTS_DDL);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_org_id') THEN
        ALTER TABLE "tenants" ADD CONSTRAINT unique_org_id UNIQUE (org_id);
      END IF;
    END $$
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tenants_org_id ON "tenants"(org_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON "tenants"(is_active)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON "tenants"(subdomain)`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tenants_email_lower
      ON "tenants"(LOWER(email)) WHERE email IS NOT NULL
  `);
}
