import jwt from 'jsonwebtoken';
import { APEX_TENANT } from '../lib/tenantHost.js';
import { getRequestTenant } from '../lib/tenantContext.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const requestTenant = req.tenant || getRequestTenant() || APEX_TENANT;
    const tokenTenant = payload.tenant || APEX_TENANT;
    if (tokenTenant !== requestTenant) {
      return res.status(401).json({ error: 'Session belongs to a different school. Please sign in again.' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * @param {{ id: string, email: string, role: string, name: string, tenant?: string }} user
 * @param {{ expiresIn?: string }} [options]
 */
export function signToken(user, options = {}) {
  const expiresIn = options.expiresIn || '7d';
  const tenant = user.tenant || getRequestTenant() || APEX_TENANT;
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name, tenant },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant: user.tenant || getRequestTenant() || APEX_TENANT,
  };
}
