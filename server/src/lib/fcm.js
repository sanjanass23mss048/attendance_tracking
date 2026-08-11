/**
 * Firebase Cloud Messaging (HTTP v1) via service account, or legacy server key.
 * No-ops when credentials are missing so local/dev still works (Socket.IO notifies).
 */

let cachedAccessToken = null;
let cachedAccessTokenExp = 0;

function hasServiceAccount() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.FCM_SERVER_KEY
  );
}

async function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fs = await import('fs/promises');
    const raw = await fs.readFile(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
    return JSON.parse(raw);
  }
  return null;
}

async function getGoogleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessTokenExp > now + 60) {
    return cachedAccessToken;
  }

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');

  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  sign.end();
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'FCM token exchange failed');
  }
  cachedAccessToken = data.access_token;
  cachedAccessTokenExp = now + Number(data.expires_in || 3600);
  return cachedAccessToken;
}

async function sendViaHttpV1(tokens, { title, body, data }) {
  const sa = await loadServiceAccount();
  if (!sa?.project_id || !sa?.client_email || !sa?.private_key) {
    return null;
  }
  const accessToken = await getGoogleAccessToken(sa);
  const invalidTokens = [];
  let success = 0;
  let failure = 0;

  // FCM HTTP v1 is one message per request
  for (const token of tokens) {
    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: Object.fromEntries(
                Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '')])
              ),
              android: {
                priority: 'HIGH',
                notification: {
                  channel_id: 'notices',
                  click_action: 'FLUTTER_NOTIFICATION_CLICK',
                },
              },
            },
          }),
        }
      );
      if (res.ok) {
        success += 1;
      } else {
        failure += 1;
        const err = await res.json().catch(() => ({}));
        const code = err?.error?.details?.[0]?.errorCode || err?.error?.status;
        if (code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' || res.status === 404) {
          invalidTokens.push(token);
        }
        console.warn('FCM send failed', res.status, code || err);
      }
    } catch (e) {
      failure += 1;
      console.warn('FCM send error', e?.message || e);
    }
  }

  return { success, failure, invalidTokens, provider: 'httpv1' };
}

/** Legacy FCM API (server key) — still used by some projects. */
async function sendViaLegacy(tokens, { title, body, data }) {
  const key = process.env.FCM_SERVER_KEY;
  if (!key) return null;

  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registration_ids: tokens.slice(0, 1000),
      priority: 'high',
      notification: { title, body, sound: 'default' },
      data: data || {},
    }),
  });
  const json = await res.json().catch(() => ({}));
  const invalidTokens = [];
  if (Array.isArray(json.results)) {
    json.results.forEach((r, i) => {
      if (r.error === 'NotRegistered' || r.error === 'InvalidRegistration') {
        invalidTokens.push(tokens[i]);
      }
    });
  }
  return {
    success: json.success || 0,
    failure: json.failure || 0,
    invalidTokens,
    provider: 'legacy',
  };
}

/**
 * @returns {Promise<null | { success: number, failure: number, invalidTokens: string[], provider: string, skipped?: boolean }>}
 */
export async function sendFcmToTokens(tokens, message) {
  const list = [...new Set((tokens || []).filter(Boolean))];
  if (!list.length) return { success: 0, failure: 0, invalidTokens: [], provider: 'none' };

  if (!hasServiceAccount()) {
    console.log(
      `FCM skipped (${list.length} tokens) — set FIREBASE_SERVICE_ACCOUNT_JSON/PATH or FCM_SERVER_KEY`
    );
    return { success: 0, failure: 0, invalidTokens: [], provider: 'none', skipped: true };
  }

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      return await sendViaHttpV1(list, message);
    }
    return await sendViaLegacy(list, message);
  } catch (e) {
    console.warn('FCM send aborted', e?.message || e);
    return { success: 0, failure: list.length, invalidTokens: [], provider: 'error' };
  }
}
