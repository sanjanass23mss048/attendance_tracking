import { Router } from 'express';
import {
  approveEditRequest,
  denyEditRequest,
  findApproverByWhatsAppPhone,
  findEditRequestById,
  findLatestPendingForApprover,
} from '../services/editRequestRepo.js';
import { verifyMetaSignature, normalizePhone } from '../lib/attendanceEditRules.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { findClassSectionById } from '../services/schoolRepo.js';
import { toDateString } from '../lib/ids.js';
import { clipAuditSummary } from '../lib/attendanceAuditDetails.js';

const router = Router();

/** Meta webhook verification (GET). */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
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

/** Incoming WhatsApp messages / button replies (POST). */
router.post('/', async (req, res) => {
  const signature = req.get('x-hub-signature-256');
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const skipVerify =
    process.env.WHATSAPP_WEBHOOK_SKIP_VERIFY === 'true' ||
    (process.env.NODE_ENV !== 'production' && !process.env.WHATSAPP_APP_SECRET);
  if (
    !skipVerify &&
    !verifyMetaSignature(raw, signature, process.env.WHATSAPP_APP_SECRET)
  ) {
    console.warn('[whatsapp-webhook] invalid signature — update WHATSAPP_APP_SECRET in Meta App Settings → Basic, or set WHATSAPP_WEBHOOK_SKIP_VERIFY=true for local dev');
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

          let row = null;
          if (parsed.requestId) {
            row = await findEditRequestById(parsed.requestId);
          } else {
            const approverUser = await findApproverByWhatsAppPhone(from);
            if (approverUser) {
              row = await findLatestPendingForApprover(approverUser.user_id);
            }
          }
          if (!row) continue;
          if (row.Status !== 'PENDING') continue; // ignore duplicates

          const approverUser = await findApproverByWhatsAppPhone(from);
          if (!approverUser || approverUser.user_id !== row.Approver_id) {
            const assignedPhone = normalizePhone(row.approver?.phone);
            if (normalizePhone(from) !== assignedPhone) {
              console.warn('[whatsapp-webhook] phone mismatch for', row.Request_id);
              continue;
            }
          }

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
            console.log('[whatsapp-webhook] approved', row.Request_id);
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
            console.log('[whatsapp-webhook] denied', row.Request_id);
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
      }
    }
  } catch (err) {
    console.error('[whatsapp-webhook] handler error', err);
  }
});

export default router;
