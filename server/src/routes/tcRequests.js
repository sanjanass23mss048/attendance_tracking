import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireStaff } from '../middleware/roles.js';
import { canAccessSection, hasFullClassAccess } from '../services/schoolRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { getRequestTenant } from '../lib/tenantContext.js';
import { APEX_TENANT } from '../lib/tenantHost.js';
import { readBranding, readLogoDataUrl } from '../lib/schoolBranding.js';
import {
  loadAppSettings,
  parseTcWorkflowConfig,
  saveAppSettings,
  TC_APPROVAL_VALUES,
  TC_METHOD_VALUES,
  TC_WORKFLOW_SETTING_KEYS,
} from '../lib/appSettings.js';
import { readFile, saveFile, sanitizeFileName } from '../lib/storage.js';
import {
  SIG_MAX_BYTES,
  SIG_MIME_TYPES,
  isValidSignatureDataUrl,
  readTcSignatureFile,
  readTcSignatureMeta,
  resolveTcSignatureDataUrl,
  saveTcSignature,
  tcSignaturePublicInfo,
} from '../lib/tcSignature.js';
import {
  TC_STATUS,
  findById,
  listForStaff,
  markForwarded,
  markReviewed,
  markIssued,
  deactivateStudentKeepRecord,
  createRequest,
  loadEnrollmentForTc,
  listOpenForStudent,
  getTcHtml,
  buildTcHtml,
  skipToApproved,
  ensureTcNumber,
  saveGeneratedTcHtml,
} from '../services/tcRequestRepo.js';

const router = Router();
router.use(requireStaff);

const TC_FILE_MAX_BYTES = 10 * 1024 * 1024;
const TC_FILE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/jpg',
];

const sigUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SIG_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!SIG_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Signature must be a PNG, JPEG, or WebP image.'));
    }
    return cb(null, true);
  },
});

const tcFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TC_FILE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (!TC_FILE_MIME_TYPES.includes(mime)) {
      return cb(new Error('TC file must be a PDF, PNG, JPEG, or WebP.'));
    }
    return cb(null, true);
  },
});

async function loadTcWorkflow() {
  const map = await loadAppSettings();
  return parseTcWorkflowConfig(map);
}

function canIssueTc(role, workflow) {
  if (hasFullClassAccess(role)) return true;
  return Boolean(workflow) && workflow.approvalRequired === false;
}

async function ensureApprovedForIssue(id, row, userId, workflow) {
  if (row.status === TC_STATUS.APPROVED) return row;
  if (
    workflow &&
    !workflow.approvalRequired &&
    [TC_STATUS.REQUESTED, TC_STATUS.FORWARDED].includes(row.status)
  ) {
    return skipToApproved(id, userId, 'Verification not required');
  }
  return row;
}

async function applySkipVerification(created, userId) {
  if (!created?.id) return created;
  const workflow = await loadTcWorkflow();
  if (workflow.approvalRequired) return created;
  return skipToApproved(created.id, userId, 'Verification not required');
}

function tenantSlug(req) {
  return req.tenant || getRequestTenant() || APEX_TENANT;
}

async function schoolNameFromReq() {
  try {
    const info = await readBranding(getRequestTenant());
    if (info?.schoolName) return info.schoolName;
  } catch {
    // fall through
  }
  return process.env.SCHOOL_NAME || 'Presence School';
}

async function resolveSignatureForGenerate(req, body = {}) {
  const slug = tenantSlug(req);
  let signerName = body.signerName ? String(body.signerName).trim().slice(0, 255) : '';
  let signerDesignation = body.signerDesignation
    ? String(body.signerDesignation).trim().slice(0, 100)
    : '';
  let signatureDataUrl = null;

  if (body.signatureDataUrl && isValidSignatureDataUrl(body.signatureDataUrl)) {
    signatureDataUrl = body.signatureDataUrl;
  }

  const meta = await readTcSignatureMeta(slug);
  if (!signerName) signerName = meta?.signerName || '';
  if (!signerDesignation) signerDesignation = meta?.signerDesignation || 'Principal';
  if (!signatureDataUrl) {
    signatureDataUrl = await resolveTcSignatureDataUrl(slug);
  }

  return {
    signerName: signerName || null,
    signerDesignation: signerDesignation || 'Principal',
    signatureDataUrl,
  };
}

async function resolveSignatureForSlug(slug, body = {}) {
  return resolveSignatureForGenerate({ tenant: slug }, body);
}

async function buildHtmlForRow(row, { draft = false, signatureOverride = null } = {}) {
  const schoolName = await schoolNameFromReq();
  let signerName = row.signerName || null;
  let signerDesignation = row.signerDesignation || null;
  let signatureDataUrl = null;

  if (signatureOverride) {
    signerName = signatureOverride.signerName || signerName;
    signerDesignation = signatureOverride.signerDesignation || signerDesignation;
    signatureDataUrl = signatureOverride.signatureDataUrl || null;
  } else if (!draft && row.hasSignature) {
    const doc = await getTcHtml(row.id);
    signatureDataUrl = doc?.signatureImage || null;
    signerName = doc?.signerName || signerName;
    signerDesignation = doc?.signerDesignation || signerDesignation;
  } else {
    const resolved = await resolveSignatureForSlug(getRequestTenant() || APEX_TENANT, {});
    signerName = signerName || resolved.signerName;
    signerDesignation = signerDesignation || resolved.signerDesignation;
    signatureDataUrl = resolved.signatureDataUrl;
  }

  return buildTcHtml({
    schoolName,
    studentName: row.studentName,
    admissionNo: row.admissionNo,
    rollNo: row.rollNo,
    classLabel: row.classLabel,
    parentName: row.parentName,
    reason: row.reason,
    issuedOn: draft ? new Date().toISOString() : row.issuedOn || new Date().toISOString(),
    requestId: row.id,
    tcNo: row.tcNo || null,
    logoDataUrl: await readLogoDataUrl(getRequestTenant()),
    signerName,
    signerDesignation,
    signatureDataUrl,
    draft,
  });
}

router.get('/', async (req, res) => {
  const status = req.query.status ? String(req.query.status).toUpperCase() : '';
  const dateFrom = req.query.dateFrom ? String(req.query.dateFrom).slice(0, 10) : '';
  const dateTo = req.query.dateTo ? String(req.query.dateTo).slice(0, 10) : '';
  const workflow = await loadTcWorkflow();
  const canIssue = canIssueTc(req.user.role, workflow);
  const requests = await listForStaff(req.user.sub, req.user.role, {
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  return res.json({
    requests,
    canForward: true,
    canVerify: workflow.approvalRequired,
    canReview: hasFullClassAccess(req.user.role) && workflow.approvalRequired,
    canGenerate: canIssue && workflow.allowsGenerate,
    canUpload: canIssue && workflow.allowsUpload,
    workflow,
  });
});

router.get('/workflow-settings', async (req, res) => {
  const workflow = await loadTcWorkflow();
  return res.json(workflow);
});

router.put('/workflow-settings', async (req, res) => {
  if (!hasFullClassAccess(req.user.role)) {
    return res.status(403).json({ error: 'Only management can update TC configuration' });
  }
  const approvalRaw = String(req.body?.managementApproval || '').toLowerCase();
  const methodRaw = String(req.body?.tcMethod || '').toLowerCase();
  const managementApproval = TC_APPROVAL_VALUES.includes(approvalRaw)
    ? approvalRaw
    : 'required';
  const tcMethod = TC_METHOD_VALUES.includes(methodRaw) ? methodRaw : 'generate';

  await saveAppSettings(
    {
      [TC_WORKFLOW_SETTING_KEYS.MANAGEMENT_APPROVAL]: managementApproval,
      [TC_WORKFLOW_SETTING_KEYS.METHOD]: tcMethod,
    },
    req.user?.sub || null
  );

  const workflow = await loadTcWorkflow();
  logAdminAudit(req, {
    action: 'TC_WORKFLOW_SETTINGS',
    category: 'TC',
    entityType: 'tc_workflow',
    entityId: tenantSlug(req),
    summary: `Updated TC configuration`,
    details: workflow,
  });
  return res.json(workflow);
});

/** School-level default TC signature (image + name + designation). */
router.get('/signature-settings', async (req, res) => {
  if (!hasFullClassAccess(req.user.role)) {
    return res.status(403).json({ error: 'Only management can view TC signature settings' });
  }
  const slug = tenantSlug(req);
  const meta = await readTcSignatureMeta(slug);
  const file = await readTcSignatureFile(slug);
  return res.json(tcSignaturePublicInfo(slug, meta, { hasImage: Boolean(file) }));
});

router.get('/signature-image', async (req, res) => {
  if (!hasFullClassAccess(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const slug = tenantSlug(req);
  const file = await readTcSignatureFile(slug);
  if (!file) return res.status(404).json({ error: 'No signature image uploaded' });
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=60');
  return res.send(file.buffer);
});

router.put(
  '/signature-settings',
  (req, res, next) => {
    if (!hasFullClassAccess(req.user.role)) {
      return res.status(403).json({ error: 'Only management can update TC signature settings' });
    }
    return next();
  },
  sigUpload.single('signature'),
  async (req, res) => {
    try {
      const slug = tenantSlug(req);
      const signerName = req.body?.signerName != null ? String(req.body.signerName) : undefined;
      const signerDesignation =
        req.body?.signerDesignation != null ? String(req.body.signerDesignation) : undefined;

      let buffer = req.file?.buffer || null;
      let mimeType = req.file?.mimetype || null;

      if (!buffer && req.body?.signatureDataUrl && isValidSignatureDataUrl(req.body.signatureDataUrl)) {
        const m = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(req.body.signatureDataUrl);
        if (m) {
          mimeType = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
          buffer = Buffer.from(m[2], 'base64');
        }
      }

      const existing = await readTcSignatureMeta(slug);
      const saved = await saveTcSignature(slug, {
        buffer,
        mimeType,
        signerName: signerName !== undefined ? signerName : existing?.signerName,
        signerDesignation:
          signerDesignation !== undefined ? signerDesignation : existing?.signerDesignation || 'Principal',
      });
      const file = await readTcSignatureFile(slug);

      logAdminAudit(req, {
        action: 'TC_SIGNATURE_SETTINGS',
        category: 'TC',
        entityType: 'tc_signature',
        entityId: slug,
        summary: `Updated TC authorized signatory settings`,
        details: {
          signerName: saved.signerName,
          signerDesignation: saved.signerDesignation,
          hasImage: Boolean(file),
        },
      });

      return res.json(tcSignaturePublicInfo(slug, saved, { hasImage: Boolean(file) }));
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Could not save signature settings' });
    }
  }
);

router.get('/:id', async (req, res) => {
  const row = await findById(String(req.params.id || ''));
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  const ok = await canAccessSection(req.user.sub, req.user.role, row.classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });
  return res.json({ request: row });
});

/** HTML preview: stored Tc_Html when issued; draft (no status change) when approved. */
router.get('/:id/preview', async (req, res) => {
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  const ok = await canAccessSection(req.user.sub, req.user.role, row.classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const issued = [TC_STATUS.TC_ISSUED, TC_STATUS.INACTIVE].includes(row.status) || row.hasTcDocument;
  const workflow = await loadTcWorkflow();
  const approved =
    row.status === TC_STATUS.APPROVED ||
    (!workflow.approvalRequired &&
      [TC_STATUS.REQUESTED, TC_STATUS.FORWARDED].includes(row.status));

  if (!issued && !approved) {
    return res.status(409).json({
      error: 'TC preview is available after approval (draft) or after issue',
    });
  }

  if (issued) {
    const doc = await getTcHtml(id);
    if (doc?.fileKey) {
      try {
        const buffer = await readFile(doc.fileKey);
        res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'private, no-store');
        if (doc.fileName) {
          res.setHeader('Content-Disposition', `inline; filename="${sanitizeFileName(doc.fileName)}"`);
        }
        return res.send(buffer);
      } catch {
        // fall through to HTML if the file is missing
      }
    }
    if (doc?.html || !doc?.fileKey) {
      const tcNo = row.tcNo || (await ensureTcNumber(id));
      const html = await buildHtmlForRow({ ...row, tcNo }, { draft: false });
      await saveGeneratedTcHtml(id, html);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(html);
    }
  }

  if (approved && !issued) {
    if (workflow.tcMethod === 'upload') {
      return res.status(409).json({ error: 'Upload a TC document to preview it' });
    }
  }

  const html = await buildHtmlForRow(row, { draft: !issued });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(html);
});

const createSchema = z.object({
  studentClassId: z.string().min(1).max(50),
  reason: z.string().max(2000).optional().nullable(),
  source: z.enum(['STAFF', 'PROMOTION', 'PARENT']).optional(),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }
  const enrollment = await loadEnrollmentForTc(parsed.data.studentClassId);
  if (!enrollment) {
    return res.status(404).json({ error: 'Student enrollment not found' });
  }
  const ok = await canAccessSection(req.user.sub, req.user.role, enrollment.classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const open = await listOpenForStudent(enrollment.studentId);
  if (open.length) {
    return res.status(409).json({
      error: 'A transfer certificate request is already in progress for this student',
      request: open[0],
    });
  }

  const created = await createRequest({
    studentId: enrollment.studentId,
    studentClassId: enrollment.studentClassId,
    classSectionId: enrollment.classSectionId,
    studentName: enrollment.studentName,
    classLabel: enrollment.classLabel,
    admissionNo: enrollment.admissionNo,
    rollNo: enrollment.rollNo,
    parentName: enrollment.parentName,
    parentContact: enrollment.parentContact,
    reason: parsed.data.reason || 'Requested during promotion / staff entry',
    requestedBy: req.user.sub,
    source: parsed.data.source || 'STAFF',
  });
  const request = await applySkipVerification(created, req.user.sub);

  logAdminAudit(req, {
    action: 'TC_REQUEST',
    category: 'TC',
    entityType: 'tc_request',
    entityId: request?.id,
    summary: `TC requested for ${enrollment.studentName} (${parsed.data.source || 'STAFF'})`,
    details: {
      classLabel: enrollment.classLabel,
      studentClassId: enrollment.studentClassId,
      source: parsed.data.source || 'STAFF',
    },
  });
  return res.status(201).json({ request });
});

const noteSchema = z.object({
  note: z.string().max(500).optional().nullable(),
});

async function handleVerify(req, res) {
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  if (row.status !== TC_STATUS.REQUESTED) {
    return res.status(409).json({ error: 'Only a requested TC can be verified by a teacher' });
  }
  const ok = await canAccessSection(req.user.sub, req.user.role, row.classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const workflow = await loadTcWorkflow();
  if (!workflow.approvalRequired) {
    const updated = await skipToApproved(id, req.user.sub, 'Verification not required');
    logAdminAudit(req, {
      action: 'TC_VERIFY',
      category: 'TC',
      entityType: 'tc_request',
      entityId: id,
      summary: `Verification skipped for ${row.studentName} (not required)`,
      details: { classLabel: row.classLabel, studentId: row.studentId, autoApproved: true },
    });
    return res.json({ request: updated, workflow });
  }

  const forwarded = await markForwarded(id, req.user.sub);
  if (forwarded?.status !== TC_STATUS.FORWARDED) {
    return res.status(409).json({ error: 'Could not verify TC request' });
  }

  logAdminAudit(req, {
    action: 'TC_VERIFY',
    category: 'TC',
    entityType: 'tc_request',
    entityId: id,
    summary: `Teacher verified TC request for ${row.studentName}`,
    details: { classLabel: row.classLabel, studentId: row.studentId, autoApproved: false },
  });
  return res.json({ request: forwarded, workflow });
}

/** Teacher verifies request (notifies management). */
router.post('/:id/verify', handleVerify);
/** @deprecated Prefer /verify — kept for mobile/older clients. */
router.post('/:id/forward', handleVerify);

router.post('/:id/approve', async (req, res) => {
  if (!hasFullClassAccess(req.user.role)) {
    return res.status(403).json({ error: 'Only management can approve a TC request' });
  }
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  if (row.status !== TC_STATUS.FORWARDED) {
    return res.status(409).json({
      error: 'Management can approve only after a teacher verifies the request',
    });
  }

  const updated = await markReviewed(id, {
    status: TC_STATUS.APPROVED,
    reviewerId: req.user.sub,
    note: parsed.data.note,
  });
  if (updated?.status !== TC_STATUS.APPROVED) {
    return res.status(409).json({ error: 'Could not approve TC request' });
  }
  logAdminAudit(req, {
    action: 'TC_APPROVE',
    category: 'TC',
    entityType: 'tc_request',
    entityId: id,
    summary: `TC approved for ${row.studentName} — ready to generate`,
    details: { studentId: row.studentId, classLabel: row.classLabel },
  });
  return res.json({ request: updated });
});

router.post('/:id/reject', async (req, res) => {
  if (!hasFullClassAccess(req.user.role)) {
    return res.status(403).json({ error: 'Only management can reject a TC request' });
  }
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  if (row.status !== TC_STATUS.FORWARDED) {
    return res.status(409).json({
      error: 'Management can reject only after a teacher verifies the request',
    });
  }
  const updated = await markReviewed(id, {
    status: TC_STATUS.REJECTED,
    reviewerId: req.user.sub,
    note: parsed.data.note,
  });
  if (updated?.status !== TC_STATUS.REJECTED) {
    return res.status(409).json({ error: 'Could not reject TC request' });
  }
  logAdminAudit(req, {
    action: 'TC_REJECT',
    category: 'TC',
    entityType: 'tc_request',
    entityId: id,
    summary: `TC rejected for ${row.studentName}`,
    details: { studentId: row.studentId, classLabel: row.classLabel },
  });
  return res.json({ request: updated });
});

const generateSchema = z.object({
  signerName: z.string().max(255).optional().nullable(),
  signerDesignation: z.string().max(100).optional().nullable(),
  signatureDataUrl: z.string().max(1_600_000).optional().nullable(),
});

router.post('/:id/generate', async (req, res) => {
  const workflow = await loadTcWorkflow();
  if (!workflow.allowsGenerate) {
    return res.status(409).json({ error: 'This school is configured to upload TCs' });
  }
  if (!canIssueTc(req.user.role, workflow)) {
    return res.status(403).json({ error: 'Only management can generate a TC' });
  }
  const parsed = generateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  const ok = await canAccessSection(req.user.sub, req.user.role, row.classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const ready = await ensureApprovedForIssue(id, row, req.user.sub, workflow);
  if (ready?.status !== TC_STATUS.APPROVED) {
    return res.status(409).json({
      error: workflow.approvalRequired
        ? 'TC can be generated only after management approval'
        : 'TC can be generated from this request',
    });
  }

  const sig = await resolveSignatureForGenerate(req, parsed.data);
  const issuedAt = new Date().toISOString();
  const tcNo = await ensureTcNumber(id);
  const html = await buildHtmlForRow(
    { ...row, tcNo, issuedOn: issuedAt },
    { draft: false, signatureOverride: sig }
  );

  // Soft-deactivate first so records stay; never delete.
  await deactivateStudentKeepRecord(row.studentId, req.user.sub);
  const updated = await markIssued(id, {
    issuerId: req.user.sub,
    tcHtml: html,
    terminalStatus: TC_STATUS.TC_ISSUED,
    signerName: sig.signerName,
    signerDesignation: sig.signerDesignation,
    signatureImage: sig.signatureDataUrl || null,
    tcMimeType: 'text/html',
    tcFileName: `TC-${(row.studentName || 'student').replace(/[^\w.-]+/g, '_')}.html`,
  });
  if (updated?.status !== TC_STATUS.TC_ISSUED) {
    return res.status(409).json({ error: 'Could not generate TC' });
  }

  logAdminAudit(req, {
    action: 'TC_GENERATE',
    category: 'TC',
    entityType: 'tc_request',
    entityId: id,
    summary: `TC issued and signed for ${row.studentName} — student set inactive (record kept)`,
    details: {
      studentId: row.studentId,
      classLabel: row.classLabel,
      signerName: sig.signerName,
      signerDesignation: sig.signerDesignation,
      hasSignatureImage: Boolean(sig.signatureDataUrl),
      signedAt: new Date().toISOString(),
    },
  });
  return res.json({ request: updated });
});

router.post('/:id/upload', (req, res, next) => {
  tcFileUpload.single('file')(req, res, (err) => {
    if (err) return next(err);
    return next();
  });
}, async (req, res) => {
  const workflow = await loadTcWorkflow();
  if (!workflow.allowsUpload) {
    return res.status(409).json({ error: 'This school is configured to generate TCs' });
  }
  if (!canIssueTc(req.user.role, workflow)) {
    return res.status(403).json({ error: 'Only management can upload a TC' });
  }
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'Choose a TC file to upload (PDF, PNG, JPEG, or WebP)' });
  }

  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  const ok = await canAccessSection(req.user.sub, req.user.role, row.classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const ready = await ensureApprovedForIssue(id, row, req.user.sub, workflow);
  if (ready?.status !== TC_STATUS.APPROVED) {
    return res.status(409).json({
      error: workflow.approvalRequired
        ? 'TC can be uploaded only after management approval'
        : 'TC can be uploaded from this request',
    });
  }

  const originalName = sanitizeFileName(req.file.originalname || 'TC.pdf');
  const fileKey = `tc/${tenantSlug(req)}/${id}/${originalName}`;
  await saveFile(fileKey, req.file.buffer);

  await deactivateStudentKeepRecord(row.studentId, req.user.sub);
  await ensureTcNumber(id);
  const mimeType = String(req.file.mimetype || 'application/octet-stream').toLowerCase();
  const updated = await markIssued(id, {
    issuerId: req.user.sub,
    tcHtml: null,
    terminalStatus: TC_STATUS.TC_ISSUED,
    tcFileKey: fileKey,
    tcMimeType: mimeType,
    tcFileName: originalName,
  });
  if (updated?.status !== TC_STATUS.TC_ISSUED) {
    return res.status(409).json({ error: 'Could not upload TC' });
  }

  logAdminAudit(req, {
    action: 'TC_UPLOAD',
    category: 'TC',
    entityType: 'tc_request',
    entityId: id,
    summary: `TC uploaded for ${row.studentName} — student set inactive (record kept)`,
    details: {
      studentId: row.studentId,
      classLabel: row.classLabel,
      fileName: originalName,
      mimeType,
    },
  });
  return res.json({ request: updated });
});

router.get('/:id/download', async (req, res) => {
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  const ok = await canAccessSection(req.user.sub, req.user.role, row.classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  if (![TC_STATUS.TC_ISSUED, TC_STATUS.INACTIVE].includes(row.status) && !row.hasTcDocument) {
    return res.status(409).json({ error: 'TC has not been issued yet' });
  }

  const doc = await getTcHtml(id);
  if (doc?.fileKey) {
    try {
      const buffer = await readFile(doc.fileKey);
      const filename = sanitizeFileName(
        doc.fileName || `TC-${(row.studentName || 'student').replace(/[^\w.-]+/g, '_')}`
      );
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch {
      // fall through to HTML
    }
  }

  let html = '';
  if (!doc?.fileKey) {
    const tcNo = row.tcNo || (await ensureTcNumber(id));
    html = await buildHtmlForRow({ ...row, tcNo }, { draft: false });
    await saveGeneratedTcHtml(id, html);
  } else {
    html = doc?.html || '';
    if (!html) {
      html = await buildHtmlForRow(row, { draft: false });
    }
  }

  const filename = `TC-${(row.studentName || 'student').replace(/[^\w.-]+/g, '_')}.html`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(html);
});

router.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    const uploadRoute = String(req.path || '').endsWith('/upload');
    return res.status(400).json({
      error: uploadRoute
        ? 'TC file must be 10 MB or smaller.'
        : 'Signature image must be 1 MB or smaller.',
    });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Request failed' });
  }
  return res.status(400).json({ error: 'Request failed' });
});

export default router;
