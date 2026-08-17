export const RESERVED_SLUGS = new Set([
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

/** Browser + proxy send this so APIs bind to the school DB even if Host is rewritten. */
export const TENANT_HEADER = 'x-tenant';

/** Apex + Bright Future host. */
export function attendanceMainHost() {
  return String(process.env.MAIN_DOMAIN || process.env.ATTENDANCE_MAIN_HOST || 'rioassetmanagement.info')
    .trim()
    .toLowerCase();
}

/** First label of Host, or apex for localhost / IP / main attendance host. */
export function parseTenantSlug(hostname) {
  const host = String(hostname || '')
    .split(':')[0]
    .trim()
    .toLowerCase();
  if (!host || host === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return APEX_TENANT;
  }

  const main = attendanceMainHost();
  if (host === main || host === `www.${main}`) return APEX_TENANT;

  if (host.endsWith(`.${main}`)) {
    const prefix = host.slice(0, -(main.length + 1));
    const label = prefix.split('.')[0];
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

export function validateSlug(raw) {
  const slug = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  if (slug.length < 3 || slug.length > 40) {
    throw new Error('School slug must be 3–40 characters (letters, numbers, hyphens).');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('School slug cannot start or end with a hyphen.');
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`“${slug}” is reserved. Choose another school slug.`);
  }
  return slug;
}

export function dbNameForSlug(slug) {
  return `${String(slug).replace(/-/g, '_')}_attdb`;
}

export function tenantSubdomainUrl(slug) {
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.FRONTEND_PORT || process.env.VITE_DEV_PORT || '5173';
    return `http://${slug}.localhost:${port}`;
  }
  return `https://${slug}.${attendanceMainHost()}`;
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function hostnameFromUrlLike(value) {
  const raw = firstHeaderValue(value);
  if (!raw) return '';
  try {
    const href = raw.includes('://') ? raw : `http://${raw}`;
    return new URL(href).hostname;
  } catch {
    return raw.split('/')[0].split(':')[0].trim().toLowerCase();
  }
}

/** Live school URL used in emails (never localhost — Gmail cannot open it). */
export function passwordResetAppOrigin(req) {
  const slug = resolveRequestTenantSlug(req);
  const main = attendanceMainHost();
  const configured = String(process.env.APP_PUBLIC_URL || process.env.PUBLIC_APP_ORIGIN || '')
    .trim()
    .replace(/\/$/, '');
  if (configured && /^https?:\/\//i.test(configured)) {
    try {
      const u = new URL(configured);
      if (slug && slug !== APEX_TENANT) {
        const root = u.hostname.replace(/^www\./, '');
        u.hostname = `${slug}.${root}`;
      }
      return u.origin;
    } catch {
      // fall through to MAIN_DOMAIN
    }
  }
  if (slug && slug !== APEX_TENANT) {
    return `https://${slug}.${main}`;
  }
  return `https://${main}`;
}

/** Public browser origin for this request (reset-password emails, same-origin links). */
export function requestPublicOrigin(req) {
  const origin = firstHeaderValue(req.headers.origin);
  if (origin && /^https?:\/\//i.test(origin)) {
    try {
      return new URL(origin).origin;
    } catch {
      return origin.replace(/\/$/, '');
    }
  }
  const proto =
    firstHeaderValue(req.headers['x-forwarded-proto']).split(',')[0] ||
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = requestHostname(req);
  if (host) return `${proto}://${host.split(',')[0].trim()}`;
  return process.env.NODE_ENV === 'production'
    ? `https://${attendanceMainHost()}`
    : 'http://localhost:5173';
}

export function requestHostname(req) {
  const xfHost = firstHeaderValue(req.headers['x-forwarded-host']);
  if (xfHost) return xfHost.split(',')[0].trim();

  const originHost = hostnameFromUrlLike(req.headers.origin);
  if (originHost) return originHost;

  const refererHost = hostnameFromUrlLike(req.headers.referer);
  if (refererHost) return refererHost;

  return firstHeaderValue(req.headers.host);
}

function slugFromExplicitHeader(req) {
  const raw = firstHeaderValue(req.headers[TENANT_HEADER] || req.headers['x-school-slug']);
  if (!raw) return null;
  const slug = raw.trim().toLowerCase();
  if (!slug || slug === APEX_TENANT || RESERVED_SLUGS.has(slug)) return APEX_TENANT;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

/**
 * Single place APIs use to decide which school DB to open.
 * Prefers a real subdomain (Origin / forwarded Host / X-Tenant) over a rewritten Host
 * like localhost:4000 from the Vite proxy.
 */
export function resolveRequestTenantSlug(req) {
  const fromOrigin = parseTenantSlug(hostnameFromUrlLike(req.headers.origin));
  const fromReferer = parseTenantSlug(hostnameFromUrlLike(req.headers.referer));
  const fromHost = parseTenantSlug(requestHostname(req));
  const fromHeader = slugFromExplicitHeader(req);

  if (fromOrigin !== APEX_TENANT) return fromOrigin;
  if (fromReferer !== APEX_TENANT) return fromReferer;
  if (fromHost !== APEX_TENANT) return fromHost;
  if (fromHeader && fromHeader !== APEX_TENANT) return fromHeader;
  return APEX_TENANT;
}

export function isAllowedBrowserOrigin(origin) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    const main = attendanceMainHost();
    if (host === main || host === `www.${main}` || host.endsWith(`.${main}`)) return true;
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}
