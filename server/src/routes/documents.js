import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { newId, parseDateOnly } from '../lib/ids.js';
import {
  createDocument,
  findDocumentById,
  listDocuments,
  softDeleteDocument,
} from '../services/documentRepo.js';
import {
  deleteFile,
  readFile,
  saveFile,
  storageKeyFor,
} from '../lib/storage.js';

const router = Router();

const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('File type not allowed'));
    }
    return cb(null, true);
  },
});

const querySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
});

const uploadFieldsSchema = z.object({
  entityType: z.enum(['student', 'calendar_event', 'attendance_mark']),
  entityId: z.string().min(1).max(50),
  documentType: z
    .enum(['leave_letter', 'medical_leave', 'od_letter', 'other'])
    .optional()
    .nullable(),
  leaveFrom: z.string().optional().nullable(),
  leaveTo: z.string().optional().nullable(),
  reason: z.string().min(1).max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

router.get('/', requireAuth, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }
  const docs = await listDocuments(parsed.data.entityType, parsed.data.entityId);
  return res.json({ documents: docs });
});

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const parsed = uploadFieldsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { entityType, entityId, documentType, leaveFrom, leaveTo, reason, notes } =
    parsed.data;

  const fromDate = leaveFrom ? parseDateOnly(leaveFrom) : null;
  const toDate = leaveTo ? parseDateOnly(leaveTo) : null;
  if (leaveFrom && !fromDate) {
    return res.status(400).json({ error: 'Invalid leave from date' });
  }
  if (leaveTo && !toDate) {
    return res.status(400).json({ error: 'Invalid leave to date' });
  }
  if (fromDate && toDate && fromDate > toDate) {
    return res.status(400).json({ error: 'Leave to date must be on or after from date' });
  }

  const documentId = newId('DOC');
  const key = storageKeyFor(
    entityType,
    entityId,
    documentId,
    req.file.originalname || 'file'
  );

  try {
    await saveFile(key, req.file.buffer);
    const doc = await createDocument({
      documentId,
      entityType,
      entityId,
      documentType: documentType || 'leave_letter',
      fileName: req.file.originalname || 'file',
      storageKey: key,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user.sub,
      leaveFrom: fromDate,
      leaveTo: toDate,
      reason: reason || null,
      notes: notes || null,
      status: 'pending',
    });
    return res.status(201).json({ document: doc });
  } catch (err) {
    console.error('Upload failed', err);
    await deleteFile(key).catch(() => {});
    return res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/:id/download', requireAuth, async (req, res) => {
  const row = await findDocumentById(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Document not found' });
  }
  try {
    const buffer = await readFile(row.Storage_Key);
    const inline = String(req.query.inline || '') === '1' || String(req.query.disposition || '') === 'inline';
    const safeName = String(row.File_Name || 'document').replace(/"/g, '');
    res.setHeader('Content-Type', row.Mime_Type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`
    );
    return res.send(buffer);
  } catch (err) {
    console.error('Download failed', err);
    return res.status(404).json({ error: 'File not found on disk' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const row = await findDocumentById(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Document not found' });
  }
  await softDeleteDocument(row.Document_id);
  await deleteFile(row.Storage_Key).catch(() => {});
  return res.json({ ok: true });
});

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 10 MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err?.message === 'File type not allowed') {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

export default router;
