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
    const meta = data?.error || {};
    const detail = [meta.message, meta.error_user_msg, meta.error_data?.details]
      .filter(Boolean)
      .join(' — ');
    const code = meta.code != null ? ` (#${meta.code})` : '';
    throw new Error((detail || 'WhatsApp send failed') + code);
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
 * Meta template `sudden_holiday` (English / Utility), body:
 *   Dear Parent,
 *   Due to {{1}}, the school will remain closed on *{{2}}*.
 *   Regards, RIOBizSols
 * Header "St.Joseph" is static — do not send a header component.
 * {{1}} = reason (e.g. Rain)  {{2}} = dates (e.g. 28-07-2026 & 29-07-2026)
 */
function holidayLangs() {
  const preferred =
    env('WHATSAPP_HOLIDAY_TEMPLATE_LANG') || env('WHATSAPP_TEMPLATE_LANG', 'en');
  const langs = [preferred, preferred === 'en_US' ? 'en' : null].filter(Boolean);
  return [...new Set(langs)];
}

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
  const body = textParams([
    String(reason || 'unforeseen circumstances').replace(/\s+/g, ' ').trim() || 'unforeseen circumstances',
    String(dates || '—').replace(/\*/g, '').trim() || '—',
  ]);
  const headerText =
    env('WHATSAPP_HOLIDAY_HEADER') || env('SCHOOL_NAME') || 'St.Joseph';
  const header = {
    type: 'header',
    parameters: textParams([headerText]),
  };
  let lastError = 'WhatsApp holiday send failed';
  for (const languageCode of holidayLangs()) {
    try {
      const data = await postMessage({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            header,
            {
              type: 'body',
              parameters: body,
            },
          ],
        },
      });
      return waResult({ ok: true, to, id: data?.messages?.[0]?.id || null });
    } catch (err) {
      lastError = err.message || lastError;
      console.error('[whatsapp] sudden holiday failed', languageCode, err);
    }
  }
  return waResult({
    ok: false,
    to,
    error: lastError,
  });
}

/**
 * Upload binary media to Meta WhatsApp Cloud API. Returns media id (reusable for ~30 days).
 */
export async function uploadWhatsAppMedia(buffer, mimeType = 'image/png', filename = 'poster.png') {
  if (!configured()) {
    throw new Error('WhatsApp is not configured');
  }
  const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
  const url = `https://graph.facebook.com/${graphVersion()}/${phoneId}/media`;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType || 'image/png');
  form.append(
    'file',
    new Blob([buffer], { type: mimeType || 'image/png' }),
    filename || 'poster.png'
  );
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const meta = data?.error || {};
    const detail = [meta.message, meta.error_user_msg].filter(Boolean).join(' — ');
    throw new Error(detail || 'WhatsApp media upload failed');
  }
  const id = data?.id;
  if (!id) throw new Error('WhatsApp media upload returned no id');
  return id;
}

/**
 * Free-form image (only works inside an open customer-care window, or as a best-effort
 * follow-up after a template). Prefer IMAGE-header templates when available.
 */
export async function sendWhatsAppImage({ toPhone, mediaId, imageLink, caption }) {
  if (!configured()) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'not_configured' });
  }
  const to = String(toPhone || '').replace(/\D/g, '');
  if (!to) {
    return waResult({ ok: false, to: '', error: 'Missing phone number' });
  }
  if (!mediaId && !imageLink) {
    return waResult({ ok: false, to, error: 'Missing image media id or link' });
  }
  const image = mediaId ? { id: mediaId } : { link: String(imageLink) };
  if (caption) image.caption = String(caption).slice(0, 1024);
  try {
    const data = await postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image,
    });
    return waResult({ ok: true, to, id: data?.messages?.[0]?.id || null });
  } catch (err) {
    return waResult({ ok: false, to, error: err.message || 'WhatsApp image send failed' });
  }
}

/**
 * Meta template `general_notice` (Utility / en), APPROVED:
 *   HEADER (static): St.Josephs
 *   BODY:
 *     Dear {{1}},
 *     This is to inform you about {{2}}.
 *     Details: {{3}}
 *     Thank You.
 * {{1}} = greeting e.g. "Parent of Aarav Sharma"
 * {{2}} = notice title
 * {{3}} = details / message body
 * Header is static — do not send a header component unless WHATSAPP_NOTICE_HEADER_VAR=1.
 *
 * Optional image (Chronicle posters):
 * - If WHATSAPP_NOTICE_IMAGE_TEMPLATE is an approved template with an IMAGE header,
 *   send that template with the media header + same body vars.
 * - Otherwise send general_notice text, then best-effort free-form image follow-up
 *   (mediaId / imageLink / imageBuffer).
 */
function noticeLangs() {
  const preferred =
    env('WHATSAPP_NOTICE_TEMPLATE_LANG') || env('WHATSAPP_TEMPLATE_LANG', 'en');
  const langs = [preferred, preferred === 'en_US' ? 'en' : null].filter(Boolean);
  return [...new Set(langs)];
}

export async function sendSchoolNoticeWhatsApp({
  toPhone,
  title,
  message,
  studentName,
  greeting,
  mediaId = null,
  imageLink = null,
  imageBuffer = null,
  imageMime = 'image/png',
  imageFileName = 'chronicle-poster.png',
}) {
  if (!configured()) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'not_configured' });
  }
  const templateName = env('WHATSAPP_NOTICE_TEMPLATE', 'general_notice');
  if (!templateName) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'no_template' });
  }
  const to = String(toPhone || '').replace(/\D/g, '');
  if (!to) {
    return waResult({ ok: false, to: '', error: 'Missing phone number' });
  }
  const name = String(studentName || '').replace(/\s+/g, ' ').trim();
  const greetingText =
    String(greeting || '').replace(/\s+/g, ' ').trim() ||
    (name ? `Parent of ${name}` : 'Parent');
  const titleText =
    String(title || 'School notice').replace(/\s+/g, ' ').trim().slice(0, 1024) || 'School notice';
  const messageText =
    String(message || '—').replace(/\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 1024) || '—';
  const body = textParams([greetingText, titleText, messageText]);

  let resolvedMediaId = mediaId || null;
  if (!resolvedMediaId && !imageLink && imageBuffer) {
    try {
      resolvedMediaId = await uploadWhatsAppMedia(imageBuffer, imageMime, imageFileName);
    } catch (err) {
      console.warn('[whatsapp] media upload failed', err?.message || err);
    }
  }

  const imageTemplate = String(env('WHATSAPP_NOTICE_IMAGE_TEMPLATE', '') || '').trim();
  if (imageTemplate && (resolvedMediaId || imageLink)) {
    const headerImage = resolvedMediaId
      ? { id: resolvedMediaId }
      : { link: String(imageLink) };
    const components = [
      {
        type: 'header',
        parameters: [{ type: 'image', image: headerImage }],
      },
      {
        type: 'body',
        parameters: body,
      },
    ];
    let lastError = 'WhatsApp notice image template failed';
    for (const languageCode of noticeLangs()) {
      try {
        const data = await postMessage({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: imageTemplate,
            language: { code: languageCode },
            components,
          },
        });
        return {
          ...waResult({
            ok: true,
            to,
            id: data?.messages?.[0]?.id || null,
          }),
          imageAttached: true,
        };
      } catch (err) {
        lastError = err.message || lastError;
        console.error('[whatsapp] notice image template failed', languageCode, err);
      }
    }
    // Fall through to text template + image follow-up
    console.warn('[whatsapp] IMAGE template failed; falling back to text+image', lastError);
  }

  const components = [
    {
      type: 'body',
      parameters: body,
    },
  ];
  // Only add a header component when the Meta template uses a header *variable*.
  if (String(env('WHATSAPP_NOTICE_HEADER_VAR', '')).toLowerCase() === '1') {
    const headerText =
      env('WHATSAPP_NOTICE_HEADER') || env('WHATSAPP_HOLIDAY_HEADER') || env('SCHOOL_NAME') || 'School';
    components.unshift({
      type: 'header',
      parameters: textParams([headerText]),
    });
  }
  let lastError = 'WhatsApp notice send failed';
  let templateOk = null;
  for (const languageCode of noticeLangs()) {
    try {
      const data = await postMessage({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      });
      templateOk = waResult({ ok: true, to, id: data?.messages?.[0]?.id || null });
      break;
    } catch (err) {
      lastError = err.message || lastError;
      console.error('[whatsapp] school notice failed', languageCode, err);
    }
  }
  if (!templateOk) {
    return waResult({
      ok: false,
      to,
      error: lastError,
    });
  }

  if (resolvedMediaId || imageLink) {
    const img = await sendWhatsAppImage({
      toPhone: to,
      mediaId: resolvedMediaId,
      imageLink,
      caption: titleText,
    });
    if (img.ok) {
      return { ...templateOk, imageAttached: true, imageMessageId: img.id };
    }
    console.warn('[whatsapp] poster image follow-up failed', img.error);
    return {
      ...templateOk,
      imageAttached: false,
      imageError: img.error || 'Image follow-up failed',
    };
  }

  return templateOk;
}

/**
 * Meta template `school_parent_meeting_schedule` (Utility / en), APPROVED:
 *   HEADER (static TEXT): St.Josephs — do not send a header component
 *   BODY (positional):
 *     Dear {{1}},
 *     A meeting has been scheduled regarding {{2}} - {{3}}.
 *     Reason: {{4}}
 *     Meeting Date: {{5}}
 *     Staff / Principal: {{6}}
 *     Kindly attend the meeting on the scheduled date.
 *      Thank You.
 * {{1}} parent name  {{2}} student name  {{3}} class e.g. Class 7-A
 * {{4}} reason  {{5}} date DD-MM-YYYY  {{6}} staff / principal
 */
function meetingLangs() {
  const preferred =
    env('WHATSAPP_MEETING_TEMPLATE_LANG') || env('WHATSAPP_TEMPLATE_LANG', 'en');
  const langs = [preferred, preferred === 'en_US' ? 'en' : null].filter(Boolean);
  return [...new Set(langs)];
}

function waPlain(value, fallback = '—') {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 1024) || fallback;
}

function formatWaMeetingDate(value) {
  const s = String(value || '').slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return waPlain(value, '—');
}

function formatWaClassSection(className, sectionName) {
  const cls = String(className || '').trim();
  const sec = String(sectionName || '').trim();
  if (!cls && !sec) return 'Class';
  const labelled = /^(class|lkg|ukg)\b/i.test(cls) ? cls : `Class ${cls}`;
  return sec ? `${labelled}-${sec}` : labelled;
}

export async function sendParentMeetingWhatsApp({
  toPhone,
  parentName,
  studentName,
  className,
  sectionName,
  classSection,
  reason,
  meetingDate,
  staffName,
}) {
  if (!configured()) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'not_configured' });
  }
  const templateName = env('WHATSAPP_MEETING_TEMPLATE', 'school_parent_meeting_schedule');
  if (!templateName) {
    return waResult({ ok: true, skipped: true, to: null, reason: 'no_template' });
  }
  const to = String(toPhone || '').replace(/\D/g, '');
  if (!to) {
    return waResult({ ok: false, to: '', error: 'Missing phone number' });
  }
  const body = textParams([
    waPlain(parentName, 'Parent'),
    waPlain(studentName, 'your ward'),
    waPlain(classSection, formatWaClassSection(className, sectionName)),
    waPlain(reason, 'attendance'),
    formatWaMeetingDate(meetingDate),
    waPlain(staffName, 'Principal'),
  ]);
  let lastError = 'WhatsApp meeting send failed';
  for (const languageCode of meetingLangs()) {
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
              parameters: body,
            },
          ],
        },
      });
      return waResult({ ok: true, to, id: data?.messages?.[0]?.id || null });
    } catch (err) {
      lastError = err.message || lastError;
      console.error('[whatsapp] parent meeting failed', languageCode, err);
    }
  }
  return waResult({
    ok: false,
    to,
    error: lastError,
  });
}
