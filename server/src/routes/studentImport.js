import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import {
  buildTemplateBuffer,
  buildWorkbookFromRows,
  createValidatedImport,
  processImport,
  listImportHistory,
  getErrorReportPath,
} from '../services/studentImportService.js';
import { extractStudentsFromChits } from '../services/studentChitService.js';

const router = Router();

const importManagers = requireRoles(
  'INCHARGE',
  'HOD',
  'VICE_PRINCIPAL',
  'PRINCIPAL',
  'ADMIN',
  'HEADMASTER'
);

const MAX_BYTES = Number(process.env.STUDENT_IMPORT_MAX_BYTES) || 15 * 1024 * 1024;
const MAX_CHIT_BYTES = Number(process.env.STUDENT_CHIT_MAX_BYTES) || 12 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const okExt = name.endsWith('.xlsx');
    const okMime =
      !file.mimetype ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'application/zip';
    if (!okExt || !okMime) {
      return cb(new Error('Only .xlsx files are allowed'));
    }
    return cb(null, true);
  },
});

const chitUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHIT_BYTES, files: 8 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const okExt = /\.(jpe?g|png|webp|heic)$/i.test(name);
    const okMime = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/octet-stream',
    ].includes(file.mimetype);
    if (!okExt && !okMime) {
      return cb(new Error('Only photo files are allowed (JPG, PNG, WEBP)'));
    }
    return cb(null, true);
  },
});

function uploadMiddleware(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is too large. Maximum size is 15 MB.' });
      }
      return res.status(400).json({ error: 'Upload failed. Please try again.' });
    }
    return res.status(400).json({ error: err.message || 'Unsupported file type' });
  });
}

function chitUploadMiddleware(req, res, next) {
  chitUpload.array('photos', 8)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Photo is too large. Maximum size is 12 MB each.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'You can upload up to 8 chit photos at once.' });
      }
      return res.status(400).json({ error: 'Photo upload failed. Please try again.' });
    }
    return res.status(400).json({ error: err.message || 'Unsupported photo type' });
  });
}

const draftRowSchema = z.object({
  admissionNo: z.string().optional().nullable(),
  rollNo: z.union([z.string(), z.number()]).optional().nullable(),
  name: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  className: z.string().optional().nullable(),
  sectionName: z.string().optional().nullable(),
  parentName: z.string().optional().nullable(),
  parentMobile: z.string().optional().nullable(),
  parentEmail: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

const validateRowsSchema = z.object({
  fileName: z.string().optional(),
  rows: z.array(draftRowSchema).min(1),
});

router.get('/template', requireAuth, importManagers, async (_req, res) => {
  try {
    const buffer = await buildTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.xlsx"');
    return res.send(buffer);
  } catch (err) {
    console.error('student import template', err);
    return res.status(500).json({ error: 'Could not generate template' });
  }
});

router.post('/chits', requireAuth, importManagers, chitUploadMiddleware, async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No chit photo selected' });
    }
    const result = await extractStudentsFromChits({
      files,
      userId: req.user.sub,
      className: req.body?.className || '',
      sectionName: req.body?.sectionName || '',
    });
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('student chit extract', err);
    return res.status(status).json({ error: err.message || 'Could not read chit photos' });
  }
});

router.post('/validate', requireAuth, importManagers, uploadMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file selected' });
    }
    const result = await createValidatedImport({
      userId: req.user.sub,
      fileName: req.file.originalname || 'students.xlsx',
      buffer: req.file.buffer,
    });
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('student import validate', err);
    return res.status(status).json({ error: err.message || 'Validation failed' });
  }
});

router.post('/validate-rows', requireAuth, importManagers, async (req, res) => {
  try {
    const parsed = validateRowsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Provide at least one student row to validate' });
    }
    const buffer = await buildWorkbookFromRows(parsed.data.rows);
    const result = await createValidatedImport({
      userId: req.user.sub,
      fileName: parsed.data.fileName || 'chit-extract.xlsx',
      buffer,
    });
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('student import validate-rows', err);
    return res.status(status).json({ error: err.message || 'Validation failed' });
  }
});

router.post('/', requireAuth, importManagers, async (req, res) => {
  try {
    const importId = String(req.body?.importId || '').trim();
    if (!importId) {
      return res.status(400).json({ error: 'importId is required' });
    }
    const result = await processImport(importId, req.user.sub);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('student import process', err);
    return res.status(status).json({ error: err.message || 'Import failed' });
  }
});

router.get('/history', requireAuth, importManagers, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const history = await listImportHistory(limit);
    return res.json({ history });
  } catch (err) {
    console.error('student import history', err);
    return res.status(500).json({ error: 'Could not load import history' });
  }
});

router.get('/:importId/errors', requireAuth, importManagers, async (req, res) => {
  try {
    const result = await getErrorReportPath(req.params.importId);
    if (!result) {
      return res.status(404).json({ error: 'Import not found' });
    }
    if (result.missing) {
      return res.status(404).json({ error: 'No error report available for this import' });
    }
    if (!fs.existsSync(result.path)) {
      return res.status(404).json({ error: 'Error report file is missing' });
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    return res.sendFile(path.resolve(result.path));
  } catch (err) {
    console.error('student import errors', err);
    return res.status(500).json({ error: 'Could not download error report' });
  }
});

export default router;
