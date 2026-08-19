import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import {
  ALERT_CHANNEL_VALUES,
  ALERT_RECIPIENT_VALUES,
  ALERT_SETTING_KEYS,
  loadAppSettings,
  parseAlertDeliveryPrefs,
  saveAppSettings,
  serializeSettingsForAdmin,
} from '../lib/appSettings.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';

const router = Router();

const editors = requireRoles(
  'ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'HEADMASTER',
  'INCHARGE'
);

router.get('/alert-delivery', requireAuth, async (_req, res) => {
  try {
    const map = await loadAppSettings({ force: true });
    return res.json(parseAlertDeliveryPrefs(map));
  } catch (err) {
    console.error('alert-delivery get', err);
    return res.status(500).json({ error: 'Could not load alert preferences' });
  }
});

router.put('/alert-delivery', requireAuth, async (req, res) => {
  try {
    const channel = ALERT_CHANNEL_VALUES.includes(req.body?.channel) ? req.body.channel : 'sms';
    const recipient = ALERT_RECIPIENT_VALUES.includes(req.body?.recipient)
      ? req.body.recipient
      : 'father';
    await saveAppSettings(
      {
        [ALERT_SETTING_KEYS.CHANNEL]: channel,
        [ALERT_SETTING_KEYS.RECIPIENT]: recipient,
      },
      req.user?.sub || null
    );
    return res.json({ ok: true, channel, recipient });
  } catch (err) {
    console.error('alert-delivery put', err);
    return res.status(500).json({ error: 'Could not save alert preferences' });
  }
});

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
