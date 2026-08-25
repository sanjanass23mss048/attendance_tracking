import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  listComposerOptions,
  previewTeacherNotification,
  saveTeacherNotification,
} from '../services/teacherNotificationService.js';
import { listEnrollmentsForSection, canAccessSection } from '../services/schoolRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { continueTenantAls } from '../middleware/restoreTenantAls.js';

const router = Router();

const MAX_BYTES = Number(process.env.TEACHER_NOTIF_MAX_BYTES) || 10 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const okExt = /\.(pdf|doc|docx|xls|xlsx|jpe?g|png|webp)$/i.test(name);
    if (!okExt && !ALLOWED.has(file.mimetype)) {
      return cb(new Error('File type not allowed. Use PDF, Word, Excel, or image.'));
    }
    return cb(null, true);
  },
});

function uploadOptional(req, res, next) {
  upload.single('file')(req, res, (err) => {
    continueTenantAls(req, () => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Attachment is too large (max 10 MB).' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    });
  });
}

function parseBodyJson(req) {
  // multipart sends fields as strings; JSON body sends object
  if (req.is('multipart/form-data') || req.body?.payload) {
    try {
      return typeof req.body.payload === 'string'
        ? JSON.parse(req.body.payload)
        : req.body.payload || {};
    } catch {
      return null;
    }
  }
  return req.body || {};
}

router.get('/composer-options', requireAuth, async (req, res) => {
  try {
    const data = await listComposerOptions(req.user.sub, req.user.role);
    return res.json(data);
  } catch (err) {
    console.error('composer-options', err);
    return res.status(500).json({ error: 'Could not load notification options' });
  }
});

router.get('/students', requireAuth, async (req, res) => {
  try {
    const sectionId = String(req.query.sectionId || '').trim();
    if (!sectionId) {
      return res.status(400).json({ error: 'sectionId is required' });
    }
    const ok = await canAccessSection(req.user.sub, req.user.role, sectionId);
    if (!ok) {
      return res.status(403).json({ error: 'You do not have access to this class' });
    }
    const students = await listEnrollmentsForSection(sectionId);
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase();
    const filtered = q
      ? students.filter(
          (s) =>
            String(s.name || '')
              .toLowerCase()
              .includes(q) || String(s.rollNo || '').includes(q)
        )
      : students;
    return res.json({ students: filtered });
  } catch (err) {
    console.error('notification students', err);
    return res.status(500).json({ error: 'Could not load students' });
  }
});

router.post('/preview', requireAuth, async (req, res) => {
  try {
    const body = parseBodyJson(req);
    if (!body) return res.status(400).json({ error: 'Invalid payload' });
    const preview = await previewTeacherNotification(req.user.sub, req.user.role, body);
    return res.json({ preview });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('notification preview', err);
    return res.status(status).json({ error: err.message || 'Preview failed' });
  }
});

router.post('/', requireAuth, uploadOptional, async (req, res) => {
  try {
    const body = parseBodyJson(req);
    if (!body) return res.status(400).json({ error: 'Invalid payload' });
    const result = await saveTeacherNotification({
      userId: req.user.sub,
      role: req.user.role,
      body,
      file: req.file || null,
    });
    const n = result?.notification;
    logAdminAudit(req, {
      action: n?.status === 'SENT' ? 'NOTIFICATION_SEND' : 'NOTIFICATION_SAVE',
      category: 'NOTIFICATION',
      entityType: 'teacher_notification',
      entityId: n?.id,
      summary: `${n?.status === 'SENT' ? 'Sent' : 'Saved'} notification “${n?.title || body?.title || 'Untitled'}” to ${n?.recipientCount ?? 0} recipients`,
      details: {
        status: n?.status,
        category: n?.category,
        recipientType: n?.recipientType,
        recipientSummary: n?.recipientSummary,
        recipientCount: n?.recipientCount,
        whatsapp: result?.whatsapp || null,
      },
    });
    return res.status(201).json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('notification send', err);
    return res.status(status).json({
      error: err.message || 'Could not save notification',
      details: err.details,
    });
  }
});

export default router;
