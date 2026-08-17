import crypto from 'crypto';
import { getRequestTenant } from './tenantContext.js';

const OTP_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;

/** @type {Map<string, { hash: string, expiresAt: number, attempts: number, sentAt: number, sendCount: number, windowStart: number }>} */
const store = new Map();

function secret() {
  return process.env.JWT_SECRET || 'presence-otp';
}

function keyFor(phone) {
  return `${getRequestTenant()}:${phone}`;
}

function hashOtp(phone, otp) {
  return crypto.createHmac('sha256', secret()).update(`${phone}:${otp}`).digest('hex');
}

function hashesEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function last10Digits(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function peekOtpState(phone) {
  const row = store.get(keyFor(phone));
  if (!row) return null;
  if (row.expiresAt < Date.now() && Date.now() - row.windowStart > SEND_WINDOW_MS) {
    store.delete(keyFor(phone));
    return null;
  }
  return row;
}

/**
 * @param {string} phone last-10 or E.164 digits
 * @returns {{ ok: true, otp: string } | { ok: false, error: string, retryAfterSec?: number }}
 */
export function issueOtp(phone) {
  const now = Date.now();
  const key = keyFor(phone);
  const existing = store.get(key);

  if (existing) {
    const waitMs = existing.sentAt + RESEND_COOLDOWN_MS - now;
    if (waitMs > 0) {
      return {
        ok: false,
        error: `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another OTP`,
        retryAfterSec: Math.ceil(waitMs / 1000),
      };
    }
    const windowStart = now - existing.windowStart > SEND_WINDOW_MS ? now : existing.windowStart;
    const sendCount = windowStart === now ? 1 : existing.sendCount + 1;
    if (sendCount > MAX_SENDS_PER_WINDOW) {
      return { ok: false, error: 'Too many OTP requests. Try again in a few minutes.' };
    }
  }

  const otp = generateOtp();
  const prev = store.get(key);
  const windowStart = prev && now - prev.windowStart <= SEND_WINDOW_MS ? prev.windowStart : now;
  const sendCount = prev && windowStart === prev.windowStart ? prev.sendCount + 1 : 1;

  store.set(key, {
    hash: hashOtp(phone, otp),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    sentAt: now,
    sendCount,
    windowStart,
  });
  return { ok: true, otp, expiresInSec: Math.floor(OTP_TTL_MS / 1000) };
}

/**
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function consumeOtp(phone, otp) {
  const key = keyFor(phone);
  const row = store.get(key);
  if (!row) return { ok: false, error: 'OTP expired or not requested. Request a new code.' };
  if (row.expiresAt < Date.now()) {
    store.delete(key);
    return { ok: false, error: 'OTP expired. Request a new code.' };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    store.delete(key);
    return { ok: false, error: 'Too many incorrect attempts. Request a new OTP.' };
  }
  row.attempts += 1;
  if (!hashesEqual(row.hash, hashOtp(phone, String(otp || '').trim()))) {
    store.set(key, row);
    const left = MAX_VERIFY_ATTEMPTS - row.attempts;
    return { ok: false, error: left > 0 ? `Incorrect OTP. ${left} attempt(s) left.` : 'Incorrect OTP.' };
  }
  store.delete(key);
  return { ok: true };
}

export function otpTtlSeconds() {
  return Math.floor(OTP_TTL_MS / 1000);
}
