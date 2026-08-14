-- Attendance tenant registry (ALM-style).
-- Database: Attendence_Tenants  (already created — run this against that DB)
-- Table:    public.tenants      (same columns as ALM tenants)
--
-- Does not touch Bright Future "Attendence" or ALM's tenant registry.
-- App startup also CREATE TABLE IF NOT EXISTS via TENANT_DATABASE_URL.

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
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_org_id') THEN
        ALTER TABLE "tenants" ADD CONSTRAINT unique_org_id UNIQUE (org_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_org_id ON "tenants"(org_id);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON "tenants"(is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON "tenants"(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_email_lower ON "tenants"(LOWER(email)) WHERE email IS NOT NULL;

COMMENT ON TABLE "tenants" IS 'Attendance school registry: subdomain → school database credentials';
COMMENT ON COLUMN "tenants".org_id IS 'Organization ID (primary key, max 10)';
COMMENT ON COLUMN "tenants".db_host IS 'Database host address';
COMMENT ON COLUMN "tenants".db_port IS 'Database port number';
COMMENT ON COLUMN "tenants".db_name IS 'School database name ({slug}_attdb)';
COMMENT ON COLUMN "tenants".db_user IS 'Database username';
COMMENT ON COLUMN "tenants".db_password IS 'Database password';
COMMENT ON COLUMN "tenants".subdomain IS 'Subdomain label for {subdomain}.rioassetmanagement.info';
COMMENT ON COLUMN "tenants".email IS 'School admin email';
