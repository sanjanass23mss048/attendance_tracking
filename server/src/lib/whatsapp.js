/**
 * WhatsApp Cloud API (Meta) — credentials stay server-side only.
 * Uses approved template `attendance_appr`, then sends Approve/Deny buttons.
 */
import { env } from './appSettings.js';

function graphVersion() {
  return env('META_GRAPH_VERSION', 'v21.0');
}

function configured() {
  return Boolean(env('WHATSAPP_ACCESS_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));
}

export function isWhatsAppConfigured() {
  return configured();
}

function graphUrl() {
  return `https://graph.facebook.com/${graphVersion()}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`;
}

async function postMessage(payload) {
  const res = await fetch(graphUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[whatsapp] send failed', data);
    throw new Error(data?.error?.message || 'WhatsApp send failed');
  }
  return data;
}

function textParams(values) {
  return values.map((text) => ({ type: 'text', text: String(text ?? '').slice(0, 1024) || '—' }));
}

function namedTextParams(entries) {
  return entries.map(({ name, text }) => ({
    type: 'text',
    parameter_name: name,
    text: String(text ?? '').slice(0, 1024) || '—',
  }));
}

function attendanceApprovalBodyParams({
  teacherName,
  className,
  sectionName,
  attendanceDate,
  reason,
}) {
  // attendance_approval template uses NAMED body variables (en)
  return namedTextParams([
    { name: 'teacher_name', text: teacherName || 'Teacher' },
    { name: 'class_name', text: className || '—' },
    { name: 'section', text: sectionName || '—' },
    { name: 'attendance_date', text: attendanceDate },
    { name: 'reason', text: reason || '—' },
  ]);
}

/**
 * Send approved Utility template (business-initiated), then interactive Approve/Deny.
 */
export async function sendAttendanceEditApprovalMessage({
  toPhone,
  teacherName,
  className,
  sectionName,
  attendanceDate,
  reason,
  requestId,
}) {
  if (!configured()) {
    console.warn('[whatsapp] Skipping send — WHATSAPP_* env not configured');
    return { skipped: true, messageId: null };
  }

  const to = String(toPhone || '').replace(/\D/g, '');
  if (!to) {
    throw new Error('Approver WhatsApp phone is missing');
  }

  const classLabel = `${className}${sectionName ? `-${sectionName}` : ''}`;
  const templateName = env('WHATSAPP_TEMPLATE_NAME', 'attendance_approval');
  const languageCode = env('WHATSAPP_TEMPLATE_LANG', 'en');

  const bodyParams =
    templateName === 'attendance_approval'
      ? attendanceApprovalBodyParams({
          teacherName,
          className,
          sectionName,
          attendanceDate,
          reason,
        })
      : textParams([
          teacherName || 'Teacher',
          classLabel,
          attendanceDate,
          reason || '—',
          requestId,
        ]);

  const templatePayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: bodyParams,
        },
      ],
    },
  };

  let templateData;
  try {
    templateData = await postMessage(templatePayload);
  } catch (err) {
    // Retry with fewer params if template has fewer variables
    const msg = String(err.message || '');
    if (/parameter|variables|number of params/i.test(msg)) {
      console.warn('[whatsapp] template param mismatch — retrying with 4 body params');
      templatePayload.template.components[0].parameters = textParams([
        teacherName || 'Teacher',
        classLabel,
        attendanceDate,
        reason || '—',
      ]);
      templateData = await postMessage(templatePayload);
    } else {
      throw err;
    }
  }

  const templateMessageId = templateData?.messages?.[0]?.id || null;

  // attendance_approval already includes Approve/Deny quick-reply buttons in the template.
  // Webhook resolves the latest pending request for the approver phone when buttons lack a request id.
  if (templateName === 'attendance_approval' && templateMessageId) {
    return {
      skipped: false,
      messageId: templateMessageId,
      templateMessageId,
      interactiveMessageId: null,
      raw: { template: templateData },
    };
  }

  // Fallback: interactive buttons carry the request id (for templates without built-in buttons)
  const interactivePayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: [
          'Please approve or deny this attendance edit request.',
          `Request ID: ${requestId}`,
          `Teacher: ${teacherName || 'Teacher'}`,
          `Class: ${classLabel}`,
          `Date: ${attendanceDate}`,
        ].join('\n'),
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: `ATTENDANCE_APPROVE:${requestId}`,
              title: 'Approve',
            },
          },
          {
            type: 'reply',
            reply: {
              id: `ATTENDANCE_DENY:${requestId}`,
              title: 'Deny',
            },
          },
        ],
      },
    },
  };

  let interactiveData = null;
  try {
    interactiveData = await postMessage(interactivePayload);
  } catch (err) {
    console.error('[whatsapp] interactive follow-up failed (template was sent)', err);
    // Template alone still notifies; webhook may resolve latest pending by phone
  }

  const messageId =
    interactiveData?.messages?.[0]?.id || templateMessageId || null;

  return {
    skipped: false,
    messageId,
    templateMessageId,
    interactiveMessageId: interactiveData?.messages?.[0]?.id || null,
    raw: { template: templateData, interactive: interactiveData },
  };
}

/**
 * Send an absence / attendance alert to a parent via WhatsApp.
 * Uses WHATSAPP_ABSENCE_TEMPLATE when set; otherwise sends a free-form text body.
 */
export async function sendAbsenceAlertWhatsApp({
  toPhone,
  body,
  studentName,
  rollNo,
  date,
}) {
  if (!configured()) {
    console.warn('[whatsapp] Skipping absence alert — WhatsApp is not configured in Settings');
    return { ok: true, skipped: true, provider: 'whatsapp', to: null, reason: 'not_configured' };
  }

  const to = String(toPhone || '').replace(/\D/g, '');
  if (!to) {
    return { ok: false, skipped: false, provider: 'whatsapp', error: 'Missing phone number', to: '' };
  }

  const templateName = env('WHATSAPP_ABSENCE_TEMPLATE');
  const languageCode = env('WHATSAPP_ABSENCE_TEMPLATE_LANG') || env('WHATSAPP_TEMPLATE_LANG', 'en');

  try {
    if (templateName) {
      const data = await postMessage({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: textParams([
                studentName || 'Student',
                rollNo || '-',
                date || '—',
              ]),
            },
          ],
        },
      });
      return {
        ok: true,
        skipped: false,
        provider: 'whatsapp',
        to,
        id: data?.messages?.[0]?.id || null,
      };
    }

    const text = String(body || '').trim();
    if (!text) {
      return { ok: false, skipped: false, provider: 'whatsapp', error: 'Empty message body', to };
    }

    const data = await postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: text.slice(0, 4096) },
    });

    return {
      ok: true,
      skipped: false,
      provider: 'whatsapp',
      to,
      id: data?.messages?.[0]?.id || null,
    };
  } catch (err) {
    console.error('[whatsapp] absence alert failed', err);
    return {
      ok: false,
      skipped: false,
      provider: 'whatsapp',
      to,
      error: err.message || 'WhatsApp send failed',
    };
  }
}
