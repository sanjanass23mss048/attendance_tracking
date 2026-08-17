/**
 * Parent SMS delivery (server-only).
 *
 * Providers (set SMS_PROVIDER in DB Settings or .env):
 * - twilio  → SMS_TWILIO_ACCOUNT_SID, SMS_TWILIO_AUTH_TOKEN, SMS_TWILIO_FROM
 * - msg91   → SMS_MSG91_AUTH_KEY, SMS_MSG91_SENDER_ID, SMS_MSG91_TEMPLATE_ID (DLT Flow)
 * - console → logs only (local / no SMS account yet)
 *
 * Optional: SMS_DEFAULT_COUNTRY=91 (India) for 10-digit numbers.
 */

import { env } from './appSettings.js';

function defaultCountry() {
  return String(env('SMS_DEFAULT_COUNTRY', '91')).replace(/\D/g, '');
}

export function isSmsConfigured() {
  const provider = String(env('SMS_PROVIDER', 'console')).toLowerCase();
  if (provider === 'console') return true;
  if (provider === 'twilio') {
    return Boolean(env('SMS_TWILIO_ACCOUNT_SID') && env('SMS_TWILIO_AUTH_TOKEN') && env('SMS_TWILIO_FROM'));
  }
  if (provider === 'msg91') {
    return Boolean(env('SMS_MSG91_AUTH_KEY') && env('SMS_MSG91_SENDER_ID') && env('SMS_MSG91_TEMPLATE_ID'));
  }
  return false;
}

/** Normalize to digits with country code (MSG91 wants 91XXXXXXXXXX). */
export function normalizePhone(raw, country = defaultCountry()) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length === 10 && country) {
    digits = `${country}${digits}`;
  }
  // Strip leading 00
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 10) return null;
  return digits;
}

function e164(digits) {
  return digits.startsWith('+') ? digits : `+${digits}`;
}

async function sendTwilio({ to, body }) {
  const sid = env('SMS_TWILIO_ACCOUNT_SID');
  const token = env('SMS_TWILIO_AUTH_TOKEN');
  const from = env('SMS_TWILIO_FROM');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({
    To: e164(to),
    From: from,
    Body: body,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error_message || `Twilio HTTP ${res.status}`);
  }
  return { provider: 'twilio', id: data.sid || null };
}

/**
 * MSG91 Flow (DLT) — India transactional SMS.
 *
 * Template (must match DLT / MSG91 Flow exactly):
 *   Name : ##var1##
 *   Roll Number : ##var2##
 *   Your ward is absent on ##var3##
 *   Regards,
 *   RIOBizSols
 *
 * Env:
 *   SMS_MSG91_AUTH_KEY
 *   SMS_MSG91_SENDER_ID
 *   SMS_MSG91_TEMPLATE_ID
 */
async function sendMsg91({ to, body, vars = {} }) {
  const authKey = env('SMS_MSG91_AUTH_KEY');
  const sender = env('SMS_MSG91_SENDER_ID');
  const templateId = env('SMS_MSG91_TEMPLATE_ID');

  if (!authKey || !sender || !templateId) {
    throw new Error(
      'MSG91 requires SMS_MSG91_AUTH_KEY, SMS_MSG91_SENDER_ID, and SMS_MSG91_TEMPLATE_ID'
    );
  }

  const rollNumber =
    vars.rollNo ||
    vars.rollNumber ||
    vars.var2 ||
    '-';

  const recipient = {
    mobiles: to,
    // Match DLT template variables exactly
    var1: String(vars.studentName || vars.var1 || 'Student').slice(0, 30),
    var2: String(rollNumber).slice(0, 30),
    var3: String(vars.date || vars.var3 || '').slice(0, 30),
  };

  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authkey: authKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      sender,
      short_url: '0',
      recipients: [recipient],
    }),
  });

  const data = await res.json().catch(() => ({}));
  const failed =
    !res.ok ||
    data.type === 'error' ||
    String(data.message || '').toLowerCase().includes('error');

  if (failed) {
    throw new Error(
      data.message || data.msg || JSON.stringify(data).slice(0, 200) || `MSG91 HTTP ${res.status}`
    );
  }

  return {
    provider: 'msg91',
    id: data.request_id || data.message || null,
    preview: body?.slice?.(0, 80),
  };
}

/**
 * MSG91 OTP / DLT Flow for login codes.
 * Template should include ##OTP## (SendOTP) or ##var1## (Flow).
 */
async function sendMsg91Otp({ to, otp }) {
  const authKey = env('SMS_MSG91_AUTH_KEY');
  const sender = env('SMS_MSG91_SENDER_ID');
  const templateId = env('SMS_MSG91_OTP_TEMPLATE_ID');
  if (!authKey || !templateId) {
    throw new Error('Set SMS_MSG91_AUTH_KEY and SMS_MSG91_OTP_TEMPLATE_ID in Settings');
  }

  const otpRes = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authkey: authKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      mobile: to,
      otp: String(otp),
      otp_length: 6,
      otp_expiry: 15,
      ...(sender ? { sender } : {}),
    }),
  });
  const otpData = await otpRes.json().catch(() => ({}));
  const otpFailed =
    !otpRes.ok ||
    otpData.type === 'error' ||
    String(otpData.message || '').toLowerCase().includes('error');
  if (!otpFailed) {
    return { provider: 'msg91-otp', id: otpData.request_id || otpData.message || null };
  }

  // Fall back to Flow API — map OTP to ##OTP## / ##var1##
  const flowRes = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authkey: authKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      ...(sender ? { sender } : {}),
      short_url: '0',
      recipients: [
        {
          mobiles: to,
          OTP: String(otp),
          var1: String(otp),
        },
      ],
    }),
  });
  const flowData = await flowRes.json().catch(() => ({}));
  const flowFailed =
    !flowRes.ok ||
    flowData.type === 'error' ||
    String(flowData.message || '').toLowerCase().includes('error');
  if (flowFailed) {
    throw new Error(
      otpData.message ||
        flowData.message ||
        flowData.msg ||
        `MSG91 OTP HTTP ${otpRes.status}`
    );
  }
  return { provider: 'msg91-flow', id: flowData.request_id || flowData.message || null };
}

/**
 * Send a 6-digit parent login OTP.
 * Uses SMS_MSG91_OTP_TEMPLATE_ID (not the absence template).
 */
export async function sendOtpSms({ to, otp }) {
  const phone = normalizePhone(to);
  if (!phone) {
    return { ok: false, error: 'Invalid or missing phone number', to: String(to || '') };
  }
  const code = String(otp || '').trim();
  if (!/^\d{4,8}$/.test(code)) {
    return { ok: false, error: 'Invalid OTP', to: phone };
  }

  const provider = String(env('SMS_PROVIDER', 'console')).toLowerCase();
  const body = `Your Presence login OTP is ${code}. Valid for 5 minutes.`;

  try {
    if (provider === 'console') {
      console.log(`[sms:otp] to=+${phone} otp=${code}`);
      return { ok: true, skipped: true, provider: 'console', to: phone };
    }

    if (provider === 'twilio') {
      if (!isSmsConfigured()) {
        return { ok: false, error: 'Twilio is not fully configured in Settings', to: phone };
      }
      const result = await sendTwilio({ to: phone, body });
      return { ok: true, ...result, to: phone };
    }

    if (provider === 'msg91') {
      const otpTemplate = String(env('SMS_MSG91_OTP_TEMPLATE_ID', '') || '').trim();
      if (!otpTemplate || !env('SMS_MSG91_AUTH_KEY')) {
        console.log(`[sms:otp:no-template] to=+${phone} otp=${code}`);
        return {
          ok: true,
          skipped: true,
          provider: 'msg91',
          to: phone,
          warning: 'SMS_MSG91_OTP_TEMPLATE_ID is not set — OTP was not SMS-delivered',
        };
      }
      const result = await sendMsg91Otp({ to: phone, otp: code });
      return { ok: true, ...result, to: phone };
    }

    return { ok: false, error: `Unknown SMS_PROVIDER: ${provider}`, to: phone };
  } catch (err) {
    console.error('[sms:otp] send failed', err);
    return { ok: false, error: err.message || 'OTP SMS send failed', to: phone };
  }
}

/**
 * @param {{ to: string, body: string, vars?: Record<string, string> }} args
 */
export async function sendSms({ to, body, vars = {} }) {
  const phone = normalizePhone(to);
  if (!phone) {
    return { ok: false, error: 'Invalid or missing phone number', to: String(to || '') };
  }

  const provider = String(env('SMS_PROVIDER', 'console')).toLowerCase();
  const text = String(body || '').trim();
  if (!text && provider !== 'msg91') {
    return { ok: false, error: 'Empty message body', to: phone };
  }

  try {
    if (provider === 'console') {
      console.log(`[sms:console] to=+${phone} body=${text.slice(0, 120)}…`, vars);
      return { ok: true, skipped: true, provider: 'console', to: phone, id: null };
    }

    if (!isSmsConfigured()) {
      return {
        ok: false,
        error: `SMS_PROVIDER=${provider} is not fully configured in Settings`,
        to: phone,
      };
    }

    if (provider === 'twilio') {
      const result = await sendTwilio({ to: phone, body: text });
      return { ok: true, ...result, to: phone };
    }
    if (provider === 'msg91') {
      const result = await sendMsg91({ to: phone, body: text, vars });
      return { ok: true, ...result, to: phone };
    }
    return { ok: false, error: `Unknown SMS_PROVIDER: ${provider}`, to: phone };
  } catch (err) {
    console.error('[sms] send failed', err);
    return { ok: false, error: err.message || 'SMS send failed', to: phone };
  }
}

/**
 * Load parent phones + student names + roll for student_class ids.
 * @returns {Promise<Map<string, {
 *   phone: string|null,
 *   fatherPhone: string|null,
 *   motherPhone: string|null,
 *   guardianPhone: string|null,
 *   name: string,
 *   rollNo: string
 * }>>}
 */
export async function parentContactsForEnrollments(studentClassIds, prisma) {
  const map = new Map();
  if (!studentClassIds?.length) return map;

  const rows = await prisma.tblStudent_Class.findMany({
    where: { student_class_id: { in: studentClassIds } },
    include: { tblStudents: true },
  });

  for (const row of rows) {
    const st = row.tblStudents;
    const fatherPhone = st?.Father_Number || null;
    const motherPhone = st?.Mother_Number || null;
    const guardianPhone = st?.Guardian_Number || null;
    const phone = fatherPhone || motherPhone || guardianPhone || null;
    const name = [st?.First_Name, st?.Last_Name].filter(Boolean).join(' ').trim() || 'Student';
    const rollNo = String(row.Roll_No || st?.Roll_No || '').trim() || '-';
    map.set(row.student_class_id, {
      phone,
      fatherPhone,
      motherPhone,
      guardianPhone,
      name,
      rollNo,
    });
  }
  return map;
}

/**
 * Resolve destination phone numbers from a contact based on recipient preference.
 * @param {{ fatherPhone?: string|null, motherPhone?: string|null, guardianPhone?: string|null, phone?: string|null }} contact
 * @param {'father'|'mother'|'both'} recipient
 * @returns {string[]}
 */
export function resolveRecipientPhones(contact = {}, recipient = 'father') {
  const father = contact.fatherPhone || null;
  const mother = contact.motherPhone || null;
  const guardian = contact.guardianPhone || null;

  if (recipient === 'father') {
    return father ? [father] : [];
  }
  if (recipient === 'mother') {
    return mother ? [mother] : [];
  }

  // both parents — send separately to each available registered number
  const phones = [];
  const seen = new Set();
  for (const raw of [father, mother]) {
    if (!raw) continue;
    const key = String(raw).replace(/\D/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    phones.push(raw);
  }
  if (!phones.length && guardian) {
    phones.push(guardian);
  }
  return phones;
}

function classMatchesApplicable(className, applicableTo) {
  const scope = String(applicableTo || 'All Classes').trim();
  if (!scope || /^all classes$/i.test(scope)) return true;
  const name = String(className || '').trim();
  if (/LKG|UKG/i.test(name)) return /1\s*-\s*5/.test(scope);
  const n = Number.parseInt(name.replace(/^class\s+/i, ''), 10);
  if (!Number.isFinite(n)) return true;
  if (/1\s*-\s*5/.test(scope)) return n >= 1 && n <= 5;
  if (/6\s*-\s*8/.test(scope)) return n >= 6 && n <= 8;
  if (/9\s*-\s*12/.test(scope)) return n >= 9 && n <= 12;
  return true;
}

/** Unique parent mobiles for a sudden-holiday WhatsApp blast. */
export async function listUniqueParentPhones(prismaClient, { applicableTo } = {}) {
  const rows = await prismaClient.tblStudent_Class.findMany({
    where: { Int_Status: { not: 0 } },
    include: {
      tblStudents: true,
      tblClass_Section: { include: { tblClass: true } },
    },
  });
  const seen = new Set();
  const phones = [];
  for (const row of rows) {
    const className = row.tblClass_Section?.tblClass?.Class_Name || '';
    if (!classMatchesApplicable(className, applicableTo)) continue;
    const st = row.tblStudents;
    if (!st || st.Int_Status === 0) continue;
    for (const raw of [st.Father_Number, st.Mother_Number, st.Guardian_Number]) {
      const phone = normalizePhone(raw);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      phones.push(phone);
    }
  }
  return phones;
}

/** @deprecated use parentContactsForEnrollments */
export async function parentPhonesForEnrollments(studentClassIds, prisma) {
  const contacts = await parentContactsForEnrollments(studentClassIds, prisma);
  const map = new Map();
  for (const [id, c] of contacts) map.set(id, c.phone);
  return map;
}
