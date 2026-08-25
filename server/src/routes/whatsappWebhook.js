import { Router } from 'express';
import {
  approveEditRequest,
  denyEditRequest,
  findApproverByWhatsAppPhone,
  findEditRequestById,
  findLatestPendingForApprover,
} from '../services/editRequestRepo.js';
import { verifyMetaSignature, normalizePhone } from '../lib/attendanceEditRules.js';
import { env } from '../lib/appSettings.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { findClassSectionById } from '../services/schoolRepo.js';
import { toDateString } from '../lib/ids.js';
import { clipAuditSummary } from '../lib/attendanceAuditDetails.js';
import { controlPrisma } from '../lib/prisma.js';
import { tenantAls } from '../lib/tenantContext.js';
import { APEX_TENANT } from '../lib/tenantHost.js';
import { listTenants } from '../services/tenantRegistry.js';
import { getPrismaForSlug } from '../services/tenantPrismaCache.js';
import { loadAppSettings } from '../lib/appSettings.js';

const router = Router();

/** Meta webhook verification (GET). */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env('WHATSAPP_VERIFY_TOKEN')) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

function parseButtonAction(buttonId, buttonTitle) {
  const id = String(buttonId || '').trim();
  const title = String(buttonTitle || '').trim().toLowerCase();

  let approveMatch = /^ATTENDANCE_APPROVE:(.+)$/i.exec(id);
  let denyMatch = /^ATTENDANCE_DENY:(.+)$/i.exec(id);
  if (approveMatch || denyMatch) {
    return {
      action: approveMatch ? 'approve' : 'deny',
      requestId: (approveMatch || denyMatch)[1],
    };
  }

  // Template quick-replies often use static payloads / titles only
  if (/^approve$/i.test(id) || title === 'approve') {
    return { action: 'approve', requestId: null };
  }
  if (/^deny$/i.test(id) || title === 'deny' || title === 'reject') {
    return { action: 'deny', requestId: null };
  }
  return null;
}

/**
 * Meta posts webhooks to one URL (usually apex host). Edit requests live in each
 * school DB — search apex + every active tenant until we find the match.
 */
async function forEachSchoolDb(fn) {
  const schools = [{ slug: APEX_TENANT, prisma: controlPrisma }];
  try {
    const rows = await listTenants();
    for (const row of rows || []) {
      if (row.isActive === false) continue;
      const slug = String(row.slug || '').toLowerCase();
      if (!slug || slug === APEX_TENANT) continue;
      const client = await getPrismaForSlug(slug);
      if (client) schools.push({ slug, prisma: client });
    }
  } catch (err) {
    console.warn('[whatsapp-webhook] listTenants failed', err?.message || err);
  }

  for (const school of schools) {
    const result = await tenantAls.run({ prisma: school.prisma, tenant: school.slug }, async () => {
      try {
        await loadAppSettings();
      } catch {
        /* ignore */
      }
      return fn(school);
    });
    if (result) return result;
  }
  return null;
}

async function resolveEditRequestAcrossSchools({ requestId, fromPhone }) {
  if (requestId) {
    return forEachSchoolDb(async ({ slug }) => {
      const row = await findEditRequestById(requestId);
      if (!row || row.Status !== 'PENDING') return null;
      const approverUser = await findApproverByWhatsAppPhone(fromPhone);
      if (!approverUser || approverUser.user_id !== row.Approver_id) {
        const assignedPhone = normalizePhone(row.approver?.phone);
        if (normalizePhone(fromPhone) !== assignedPhone) {
          console.warn('[whatsapp-webhook] phone mismatch for', slug, row.Request_id);
          return null;
        }
      }
      return { slug, row, approverUser };
    });
  }

  // Same WhatsApp number can exist on multiple schools — prefer newest pending.
  const candidates = [];
  await forEachSchoolDb(async ({ slug }) => {
    const approverUser = await findApproverByWhatsAppPhone(fromPhone);
    if (!approverUser) return null;
    const row = await findLatestPendingForApprover(approverUser.user_id);
    if (!row || row.Status !== 'PENDING') return null;
    candidates.push({ slug, row, approverUser });
    return null; // keep scanning
  });
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) => new Date(b.row.Requested_At).getTime() - new Date(a.row.Requested_At).getTime()
  );
  return candidates[0];
}

/** Incoming WhatsApp messages / button replies (POST). */
router.post('/', async (req, res) => {
  const signature = req.get('x-hub-signature-256');
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const skipVerify =
    env('WHATSAPP_WEBHOOK_SKIP_VERIFY') === 'true' ||
    (process.env.NODE_ENV !== 'production' && !env('WHATSAPP_APP_SECRET'));
  if (
    !skipVerify &&
    !verifyMetaSignature(raw, signature, env('WHATSAPP_APP_SECRET'))
  ) {
    console.warn('[whatsapp-webhook] invalid signature — update WHATSAPP_APP_SECRET in Settings, or set WHATSAPP_WEBHOOK_SKIP_VERIFY=true for local dev');
    return res.sendStatus(401);
  }

  // Always ACK quickly
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const messages = value.messages || [];
        for (const msg of messages) {
          const from = msg.from;
          const buttonId =
            msg.interactive?.button_reply?.id ||
            msg.button?.payload ||
            null;
          const buttonTitle =
            msg.interactive?.button_reply?.title ||
            msg.button?.text ||
            '';
          if (!buttonId && !buttonTitle) continue;

          const parsed = parseButtonAction(buttonId, buttonTitle);
          if (!parsed) continue;

          const resolved = await resolveEditRequestAcrossSchools({
            requestId: parsed.requestId,
            fromPhone: from,
          });
          if (!resolved) {
            console.warn(
              '[whatsapp-webhook] no pending edit request for',
              parsed.action,
              parsed.requestId || from
            );
            continue;
          }

          const { slug, row, approverUser } = resolved;

          await tenantAls.run(
            {
              prisma: slug === APEX_TENANT ? controlPrisma : await getPrismaForSlug(slug),
              tenant: slug,
            },
            async () => {
              const cs = await findClassSectionById(row.Class_Section_id);
              const classLabel =
                [cs?.tblClass?.Class_Name, cs?.tblSection?.Section_Name].filter(Boolean).join('-') ||
                row.Class_Section_id;
              const dateLabel = toDateString(row.Attendance_Date) || '';
              const teacherName = row.teacher?.name || row.Teacher_id;
              const approverName = approverUser?.name || row.approver?.name || row.Approver_id;
              const actor = {
                id: approverUser?.user_id || row.Approver_id,
                name: approverUser?.name || row.approver?.name || null,
                email: approverUser?.email || row.approver?.email || null,
                role: approverUser?.role || row.approver?.role || null,
              };
              const requestDetails = {
                channel: 'whatsapp',
                tenant: slug,
                className: cs?.tblClass?.Class_Name || null,
                sectionName: cs?.tblSection?.Section_Name || null,
                classSectionId: row.Class_Section_id,
                attendanceDate: dateLabel,
                teacherId: row.Teacher_id,
                teacherName,
                approverId: row.Approver_id,
                approverName,
                reason: row.Reason || null,
                fromPhone: from || null,
              };

              if (parsed.action === 'approve') {
                await approveEditRequest(row.Request_id, { actorId: row.Approver_id });
                console.log('[whatsapp-webhook] approved', slug, row.Request_id);
                logAdminAudit(
                  { headers: {}, ip: null },
                  {
                    actor,
                    action: 'EDIT_REQUEST_APPROVE',
                    category: 'APPROVAL',
                    entityType: 'attendance_edit_request',
                    entityId: row.Request_id,
                    summary: clipAuditSummary(
                      `${approverName} approved ${teacherName}'s request to edit Class ${classLabel} attendance on ${dateLabel} via WhatsApp`
                    ),
                    details: requestDetails,
                  }
                );
              } else if (parsed.action === 'deny') {
                await denyEditRequest(row.Request_id, { actorId: row.Approver_id });
                console.log('[whatsapp-webhook] denied', slug, row.Request_id);
                logAdminAudit(
                  { headers: {}, ip: null },
                  {
                    actor,
                    action: 'EDIT_REQUEST_DENY',
                    category: 'APPROVAL',
                    entityType: 'attendance_edit_request',
                    entityId: row.Request_id,
                    summary: clipAuditSummary(
                      `${approverName} denied ${teacherName}'s request to edit Class ${classLabel} attendance on ${dateLabel} via WhatsApp`
                    ),
                    details: requestDetails,
                  }
                );
              }
            }
          );
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp-webhook] handler error', err);
  }
});

export default router;
