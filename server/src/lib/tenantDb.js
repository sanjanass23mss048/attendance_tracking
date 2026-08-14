import pg from 'pg';

export function parseDatabaseUrl(raw) {
  const u = new URL(String(raw || '').trim());
  const database = decodeURIComponent((u.pathname || '').replace(/^\//, '').split('/')[0] || '');
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database,
    search: u.search || '',
  };
}

export function templateTenantUrl() {
  const raw = (process.env.TENANT_DATABASE_URL || '').trim();
  if (!raw) {
    throw new Error('TENANT_DATABASE_URL is required for multi-school setup (Attendence_Tenants).');
  }
  return raw;
}

/** Connect to the shared `postgres` DB to CREATE DATABASE. */
export function postgresAdminUrl() {
  const u = new URL(templateTenantUrl());
  u.pathname = '/postgres';
  return u.toString();
}

export function urlForDatabase(dbName) {
  const u = new URL(templateTenantUrl());
  u.pathname = `/${dbName}`;
  return u.toString();
}

export function urlFromTenantRow(row) {
  if (!row?.dbName) throw new Error('Tenant row is missing db_name');
  if (row.dbHost && row.dbUser) {
    const u = new URL(templateTenantUrl());
    u.hostname = row.dbHost;
    u.port = String(row.dbPort || 5432);
    u.username = row.dbUser;
    if (row.dbPassword != null && row.dbPassword !== '') {
      u.password = row.dbPassword;
    }
    u.pathname = `/${row.dbName}`;
    return u.toString();
  }
  return urlForDatabase(row.dbName);
}

let registryPool = null;

export function getRegistryPool() {
  if (!registryPool) {
    registryPool = new pg.Pool({
      connectionString: templateTenantUrl(),
      max: 5,
    });
  }
  return registryPool;
}
