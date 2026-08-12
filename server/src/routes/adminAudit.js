import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { AUDIT_CATEGORIES, listAdminAuditLogs } from '../services/adminAuditRepo.js';

const router = Router();

router.get('/', requireAuth, requireRoles('ADMIN'), async (req, res) => {
  try {
    const successRaw = req.query.success;
    let success;
    if (successRaw === 'true' || successRaw === '1') success = true;
    else if (successRaw === 'false' || successRaw === '0') success = false;

    const data = await listAdminAuditLogs({
      category: req.query.category ? String(req.query.category) : undefined,
      action: req.query.action ? String(req.query.action) : undefined,
      actorUserId: req.query.actorUserId ? String(req.query.actorUserId) : undefined,
      actorSearch: req.query.actor ? String(req.query.actor) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      success,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ ...data, categories: AUDIT_CATEGORIES });
  } catch (err) {
    console.error('audit-logs list', err);
    return res.status(500).json({ error: 'Could not load audit logs' });
  }
});

router.get('/meta', requireAuth, requireRoles('ADMIN'), async (_req, res) => {
  return res.json({ categories: AUDIT_CATEGORIES });
});

export default router;
