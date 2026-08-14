const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'setup',
  'attendance',
  'web',
  'mail',
  'admin',
  'app',
  'static',
]);

export const APEX_TENANT = 'apex';
export const TENANT_HEADER = 'X-Tenant';

const MAIN_HOST = 'rioassetmanagement.info';

/** First label of the browser hostname, or apex for localhost / the main domain. */
export function parseTenantSlug(hostname) {
  const host = String(hostname || '')
    .split(':')[0]
    .trim()
    .toLowerCase();
  if (!host || host === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return APEX_TENANT;
  }
  if (host === MAIN_HOST || host === `www.${MAIN_HOST}`) return APEX_TENANT;
  if (host.endsWith(`.${MAIN_HOST}`)) {
    const label = host.slice(0, -(MAIN_HOST.length + 1)).split('.')[0];
    if (!label || RESERVED_SLUGS.has(label)) return APEX_TENANT;
    return label;
  }
  if (host.endsWith('.localhost')) {
    const label = host.split('.')[0];
    if (!label || RESERVED_SLUGS.has(label)) return APEX_TENANT;
    return label;
  }
  return APEX_TENANT;
}

export function getBrowserTenantSlug() {
  if (typeof window === 'undefined') return APEX_TENANT;
  return parseTenantSlug(window.location.hostname);
}

export function isApexBrowserHost() {
  return getBrowserTenantSlug() === APEX_TENANT;
}

/** Headers every API call must send so the server opens the matching school DB. */
export function tenantRequestHeaders() {
  const slug = getBrowserTenantSlug();
  const headers = {};
  if (typeof window !== 'undefined' && window.location?.host) {
    headers['X-Forwarded-Host'] = window.location.host;
  }
  if (slug && slug !== APEX_TENANT) {
    headers[TENANT_HEADER] = slug;
  }
  return headers;
}
