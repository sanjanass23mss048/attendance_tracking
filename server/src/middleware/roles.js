/** Role-based authorization helpers. */

export function requireRoles(...allowed) {
  const set = new Set(allowed.map((r) => String(r).toUpperCase()));
  return (req, res, next) => {
    const role = String(req.user?.role || '').toUpperCase();
    if (!set.has(role)) {
      return res.status(403).json({ error: 'Forbidden for this role' });
    }
    return next();
  };
}
