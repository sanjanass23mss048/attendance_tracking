import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { loadAppSettings, saveAppSettings, serializeSettingsForAdmin } from '../lib/appSettings.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';

const router = Router();

const editors = requireRoles(
  'ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'HEADMASTER',
  'INCHARGE'
);

router.get('/', requireAuth, editors, async (_req, res) => {
  try {
    await loadAppSettings({ force: true });
    return res.json(serializeSettingsForAdmin());
  } catch (err) {
    console.error('settings get', err);
    return res.status(500).json({ error: 'Could not load settings' });
  }
});

router.put('/', requireAuth, editors, async (req, res) => {
  try {
    const values = req.body?.values && typeof req.body.values === 'object' ? req.body.values : {};
    const saved = await saveAppSettings(values, req.user?.sub || null);
    logAdminAudit(req, {
      action: 'APP_SETTINGS_UPDATE',
      category: 'SETTINGS',
      entityType: 'app_settings',
      entityId: req.tenant || 'apex',
      summary: `Updated ${saved.length} integration setting(s)`,
      details: { keys: saved },
    });
    return res.json({ ok: true, saved, ...serializeSettingsForAdmin() });
  } catch (err) {
    console.error('settings put', err);
    return res.status(500).json({ error: 'Could not save settings' });
  }
});

export default router;
