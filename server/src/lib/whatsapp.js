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
 * attendance_alert body:
 *   Name: {{1}}
 *   Class & Section: {{2}}
 *   Your ward is absent on {{3}}
 */
export async function sendAbsenceAlertWhatsApp({
  toPhone,
  body,
  studentName,
  classSection,
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

  const templateName = env('WHATSAPP_ABSENCE_TEMPLATE', 'attendance_alert');
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
                classSection || '—',
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

function waLang() {
  return env('WHATSAPP_ABSENCE_TEMPLATE_LANG') || env('WHATSAPP_TEMPLATE_LANG', 'en');
}

function waResult({ ok, skipped = false, to, id = null, error = null, reason = null }) {
  return { ok, skipped, provider: 'whatsapp', to, id, error, reason };
}

/**
 * Parent login OTP via Authentication template `login_otp`:
 * "{{1}} is your verification code. For your security, do not share this code."
 */
export async function sendOtpWhatsApp({ toPhone, otp }) {
  if (!configured()) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'not_configured' });
  }
  const templateName = env('WHATSAPP_OTP_TEMPLATE', 'login_otp');
  if (!templateName) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'no_template' });
  }
  const to = String(toPhone || '').replace(/\D/g, '');
  if (!to) {
    return waResult({ ok: false, to: '', error: 'Missing phone number' });
  }
  const code = String(otp || '').trim();
  const languageCode = waLang();
  const bodyComponent = { type: 'body', parameters: textParams([code]) };
  const buttonComponent = {
    type: 'button',
    sub_type: 'url',
    index: '0',
    parameters: [{ type: 'text', text: code }],
  };

  try {
    const data = await postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [bodyComponent, buttonComponent],
      },
    });
    return waResult({ ok: true, to, id: data?.messages?.[0]?.id || null });
  } catch (err) {
    try {
      const data = await postMessage({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [bodyComponent],
        },
      });
      return waResult({ ok: true, to, id: data?.messages?.[0]?.id || null });
    } catch (retryErr) {
      console.error('[whatsapp] login OTP failed', retryErr);
      return waResult({
        ok: false,
        to,
        error: retryErr.message || err.message || 'WhatsApp OTP send failed',
      });
    }
  }
}

/**
 * sudden_holiday body:
 *   Dear Parent,
 *   Due to {{1}}, the school will remain closed on *{{2}}*.
 *   Regards, RIOBizSols
 */
export async function sendSuddenHolidayWhatsApp({ toPhone, reason, dates }) {
  if (!configured()) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'not_configured' });
  }
  const templateName = env('WHATSAPP_HOLIDAY_TEMPLATE', 'sudden_holiday');
  if (!templateName) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'no_template' });
  }
  const to = String(toPhone || '').replace(/\D/g, '');
  if (!to) {
    return waResult({ ok: false, to: '', error: 'Missing phone number' });
  }
  const languageCode = waLang();
  try {
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
            parameters: textParams([reason || 'unforeseen circumstances', dates || '—']),
          },
        ],
      },
    });
    return waResult({ ok: true, to, id: data?.messages?.[0]?.id || null });
  } catch (err) {
    console.error('[whatsapp] sudden holiday failed', err);
    return waResult({
      ok: false,
      to,
      error: err.message || 'WhatsApp holiday send failed',
    });
  }
}
