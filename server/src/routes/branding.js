import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { APEX_TENANT } from '../lib/tenantHost.js';
import { getRequestTenant } from '../lib/tenantContext.js';
import {
  LOGO_MAX_BYTES,
  LOGO_MIME_TYPES,
  brandingPublicInfo,
  readBranding,
  readLogoFile,
  saveSchoolLogo,
} from '../lib/schoolBranding.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!LOGO_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('School logo must be a PNG, JPEG, or WebP image.'));
    }
    return cb(null, true);
  },
});

function tenantSlug(req) {
  return req.tenant || getRequestTenant() || APEX_TENANT;
}

router.get('/', async (req, res) => {
  const slug = tenantSlug(req);
  const info = await readBranding(slug);
  return res.json(brandingPublicInfo(slug, info));
});

router.get('/logo', async (req, res) => {
  const slug = tenantSlug(req);
  const file = await readLogoFile(slug);
  if (!file) {
    return res.status(404).json({ error: 'No school logo uploaded' });
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=120');
  return res.send(file.buffer);
});

router.put(
  '/logo',
  requireAuth,
  requireRoles('ADMIN', 'INCHARGE', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEADMASTER', 'HOD'),
  upload.single('logo'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Choose a school logo image to upload.' });
    }
    try {
      const slug = tenantSlug(req);
      const saved = await saveSchoolLogo(slug, req.file.buffer, req.file.mimetype);
      return res.json(brandingPublicInfo(slug, saved));
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Could not save school logo.' });
    }
  }
);

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'School logo must be 2 MB or smaller.' });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Could not upload school logo.' });
  }
  return res.status(400).json({ error: 'Could not upload school logo.' });
});

export default router;
