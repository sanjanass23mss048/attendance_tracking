import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { getRequestTenant } from './tenantContext.js';

/** Keys copied from .env into tblApp_Settings and read at request time. */
export const APP_SETTING_GROUPS = [
  {
    id: 'sms',
    label: 'SMS',
    description: 'Parent absence SMS (MSG91 or Twilio). Stored per school in the database.',
    fields: [
      { key: 'SMS_PROVIDER', label: 'Provider', hint: 'msg91, twilio, or console' },
      { key: 'SMS_DEFAULT_COUNTRY', label: 'Default country code', hint: '91 for India' },
      { key: 'SMS_MSG91_AUTH_KEY', label: 'MSG91 auth key', secret: true },
      { key: 'SMS_MSG91_SENDER_ID', label: 'MSG91 sender ID' },
      { key: 'SMS_MSG91_TEMPLATE_ID', label: 'MSG91 absence template ID' },
      { key: 'SMS_MSG91_OTP_TEMPLATE_ID', label: 'MSG91 OTP template ID', hint: 'DLT template for parent login OTP' },
      { key: 'SMS_MSG91_ROUTE', label: 'MSG91 route', hint: 'Usually 4' },
      { key: 'SMS_TWILIO_ACCOUNT_SID', label: 'Twilio account SID', secret: true },
      { key: 'SMS_TWILIO_AUTH_TOKEN', label: 'Twilio auth token', secret: true },
      { key: 'SMS_TWILIO_FROM', label: 'Twilio from number' },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Meta WhatsApp Cloud API. Webhook verify uses the main (apex) school row.',
    fields: [
      { key: 'WHATSAPP_ACCESS_TOKEN', label: 'Access token', secret: true },
      { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone number ID' },
      { key: 'WHATSAPP_VERIFY_TOKEN', label: 'Webhook verify token', secret: true },
      { key: 'WHATSAPP_APP_SECRET', label: 'App secret', secret: true },
      { key: 'WHATSAPP_WEBHOOK_SKIP_VERIFY', label: 'Skip webhook signature', hint: 'true only for local dev' },
      { key: 'META_GRAPH_VERSION', label: 'Graph API version', hint: 'e.g. v21.0' },
      { key: 'WHATSAPP_TEMPLATE_NAME', label: 'Approval template name', hint: 'Staff edit request, e.g. attendance_approval' },
      { key: 'WHATSAPP_TEMPLATE_LANG', label: 'Template language', hint: 'Must match Meta, usually en' },
      { key: 'WHATSAPP_ABSENCE_TEMPLATE', label: 'Absence template name', hint: 'Exact Meta name: attendance_alert' },
      { key: 'WHATSAPP_ABSENCE_TEMPLATE_LANG', label: 'Absence template language', hint: 'Must match Meta, usually en' },
      { key: 'WHATSAPP_HOLIDAY_TEMPLATE', label: 'Sudden holiday template name', hint: 'Exact Meta name: sudden_holiday' },
      { key: 'WHATSAPP_HOLIDAY_TEMPLATE_LANG', label: 'Sudden holiday template language', hint: 'Use en for Meta “English”' },
      { key: 'WHATSAPP_HOLIDAY_HEADER', label: 'Sudden holiday header text', hint: 'Must match the template header variable, e.g. St.Joseph' },
      { key: 'WHATSAPP_OTP_TEMPLATE', label: 'Login OTP template name', hint: 'Exact Meta name, e.g. login_otp' },
      { key: 'WHATSAPP_PROMOTION_TEMPLATE', label: 'Promotion template name', hint: 'Exact Meta name, e.g. promotion_message' },
      { key: 'WHATSAPP_MEETING_TEMPLATE', label: 'Parent meeting template name', hint: 'Exact Meta name: school_parent_meeting_schedule' },
      { key: 'WHATSAPP_MEETING_TEMPLATE_LANG', label: 'Parent meeting template language', hint: 'Must match Meta, usually en' },
      { key: 'WHATSAPP_NOTICE_TEMPLATE', label: 'School notice template name', hint: 'Exact Meta name: general_notice' },
      { key: 'WHATSAPP_NOTICE_TEMPLATE_LANG', label: 'School notice template language', hint: 'Must match Meta, usually en' },
      { key: 'WHATSAPP_NOTICE_HEADER', label: 'School notice header text', hint: 'Only if template has a header variable; general_notice uses static St.Josephs' },
      { key: 'WHATSAPP_NOTICE_HEADER_VAR', label: 'Notice header is a variable?', hint: 'Set 1 only if Meta header is {{1}}; leave empty for general_notice' },
      {
        key: 'WHATSAPP_NOTICE_IMAGE_TEMPLATE',
        label: 'Notice + image template',
        hint: 'Optional approved IMAGE-header template for Chronicle posters (e.g. general_notice_image)',
      },
      { key: 'WHATSAPP_BUSINESS_ACCOUNT_ID', label: 'WhatsApp Business Account ID', hint: 'WABA id for template listing, e.g. 1683072422845683' },
    ],
  },
  {
    id: 'push',
    label: 'Push notifications',
    description: 'Firebase Cloud Messaging. JSON can be pasted here instead of a file path.',
    fields: [
      { key: 'FIREBASE_SERVICE_ACCOUNT_JSON', label: 'Firebase service account JSON', secret: true, multiline: true },
      { key: 'FCM_SERVER_KEY', label: 'Legacy FCM server key', secret: true },
    ],
  },
  {
    id: 'school',
    label: 'School',
    description: 'Timezone and attendance edit window for this school.',
    fields: [
      { key: 'SCHOOL_TIMEZONE', label: 'Timezone', hint: 'e.g. Asia/Kolkata' },
      { key: 'EDIT_PERMISSION_MINUTES', label: 'Edit permission minutes', hint: 'How long an approved edit stays open' },
    ],
  },
];

export const ALERT_SETTING_KEYS = {
  CHANNEL: 'ABSENCE_ALERT_CHANNEL',
  RECIPIENT: 'ABSENCE_ALERT_RECIPIENT',
};

export const ALERT_CHANNEL_VALUES = ['whatsapp', 'sms', 'whatsapp_sms'];
export const ALERT_RECIPIENT_VALUES = ['father', 'mother', 'both'];

export const MANAGED_SETTING_KEYS = [
  ...APP_SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.key)),
  ALERT_SETTING_KEYS.CHANNEL,
  ALERT_SETTING_KEYS.RECIPIENT,
];

export function parseAlertDeliveryPrefs(map = {}) {
  const storedChannel = map[ALERT_SETTING_KEYS.CHANNEL];
  const storedRecipient = map[ALERT_SETTING_KEYS.RECIPIENT];
  const hasChannel = ALERT_CHANNEL_VALUES.includes(storedChannel);
  const hasRecipient = ALERT_RECIPIENT_VALUES.includes(storedRecipient);
  return {
    channel: hasChannel ? storedChannel : 'sms',
    recipient: hasRecipient ? storedRecipient : 'father',
    configured: hasChannel || hasRecipient,
  };
}

const SECRET_KEYS = new Set(
  APP_SETTING_GROUPS.flatMap((g) => g.fields.filter((f) => f.secret).map((f) => f.key))
);

const cache = new Map();

function cacheKey() {
  return getRequestTenant() || 'apex';
}

export async function ensureAppSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblApp_Settings" (
      "setting_key" VARCHAR(80) NOT NULL,
      "setting_value" TEXT,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_by" VARCHAR(50),
      CONSTRAINT "tblApp_Settings_pkey" PRIMARY KEY ("setting_key")
    )
  `);
}

/** Copy .env into DB when a key is missing — never overwrite a value already in the table. */
export async function seedAppSettingsFromEnv() {
  for (const key of MANAGED_SETTING_KEYS) {
    const fromFile = process.env[key];
    if (fromFile == null || String(fromFile).trim() === '') continue;
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO "tblApp_Settings" ("setting_key", "setting_value")
       VALUES (${key}, ${String(fromFile)})
       ON CONFLICT ("setting_key") DO NOTHING`
    );
  }
}

async function readAllRows() {
  const rows = await prisma.$queryRaw(
    Prisma.sql`SELECT "setting_key", "setting_value" FROM "tblApp_Settings"`
  );
  const map = {};
  for (const row of rows || []) {
    map[row.setting_key] = row.setting_value == null ? '' : String(row.setting_value);
  }
  return map;
}

export async function loadAppSettings({ force = false } = {}) {
  const key = cacheKey();
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.loadedAt < 15_000) return hit.map;
  await ensureAppSettingsTable();
  await seedAppSettingsFromEnv();
  const map = await readAllRows();
  cache.set(key, { map, loadedAt: Date.now() });
  return map;
}

/**
 * Read a managed setting: school DB first, then process.env.
 * Safe to call from SMS / WhatsApp / FCM on every send.
 */
export function env(key, fallback = '') {
  const hit = cache.get(cacheKey());
  const fromDb = hit?.map?.[key];
  if (fromDb != null && String(fromDb).trim() !== '') return String(fromDb);
  const fromFile = process.env[key];
  if (fromFile != null && String(fromFile).trim() !== '') return String(fromFile);
  return fallback;
}

export function invalidateAppSettingsCache() {
  cache.delete(cacheKey());
}

function maskSecret(value) {
  const raw = String(value || '');
  if (!raw) return { configured: false, preview: '' };
  const tail = raw.length <= 4 ? '••••' : `••••${raw.slice(-4)}`;
  return { configured: true, preview: tail };
}

export function serializeSettingsForAdmin() {
  const hit = cache.get(cacheKey()) || { map: {} };
  return {
    groups: APP_SETTING_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      description: group.description,
      fields: group.fields.map((field) => {
        const stored = hit.map?.[field.key];
        const resolved = env(field.key, '');
        const secret = Boolean(field.secret);
        const masked = secret ? maskSecret(resolved) : null;
        return {
          key: field.key,
          label: field.label,
          hint: field.hint || '',
          secret,
          multiline: Boolean(field.multiline),
          value: secret ? '' : stored ?? resolved ?? '',
          configured: secret ? masked.configured : Boolean(String(resolved || '').trim()),
          preview: secret ? masked.preview : '',
        };
      }),
    })),
  };
}

export async function saveAppSettings(values = {}, userId = null) {
  await ensureAppSettingsTable();
  const allowed = new Set(MANAGED_SETTING_KEYS);
  const saved = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    if (raw === undefined) continue;
    // Blank on a secret field means "leave unchanged"
    if (SECRET_KEYS.has(key) && String(raw).trim() === '') continue;
    const settingValue = raw == null ? '' : String(raw);
    const now = new Date();
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO "tblApp_Settings" ("setting_key", "setting_value", "updated_at", "updated_by")
       VALUES (${key}, ${settingValue}, ${now}, ${userId})
       ON CONFLICT ("setting_key") DO UPDATE
         SET "setting_value" = EXCLUDED."setting_value",
             "updated_at" = EXCLUDED."updated_at",
             "updated_by" = EXCLUDED."updated_by"`
    );
    saved.push(key);
  }
  invalidateAppSettingsCache();
  await loadAppSettings({ force: true });
  return saved;
}
