import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeUser } from '../services/schoolRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { getRequestTenant } from '../lib/tenantContext.js';
import { userRequiresPasswordChange } from '../lib/initialPassword.js';
import { APEX_TENANT, passwordResetAppOrigin } from '../lib/tenantHost.js';
import { buildResetLink, isEmailConfigured, sendPasswordResetEmail } from '../lib/mailer.js';
import { env } from '../lib/appSettings.js';
import { sendOtpSms } from '../lib/sms.js';
import { sendOtpWhatsApp } from '../lib/whatsapp.js';
import { consumeOtp, issueOtp, last10Digits } from '../lib/parentOtpStore.js';
import { findOrCreateParentByPhone, findStudentsByParentPhone } from '../services/parentOtpService.js';

const RESET_TOKEN_TTL = '15m';
const RESET_TOKEN_TYP = 'pwd_reset';
const GENERIC_RESET_MESSAGE = 'If that email is registered at this school, we sent a password reset link.';

function signPasswordResetToken(user, tenant) {
  return jwt.sign(
    {
      typ: RESET_TOKEN_TYP,
      sub: user.user_id,
      email: user.email,
      tenant: tenant || APEX_TENANT,
    },
    process.env.JWT_SECRET,
    { expiresIn: RESET_TOKEN_TTL }
  );
}

function isLocalRequest(req) {
  const host = String(req.get('host') || '');
  return host.includes('localhost') || process.env.NODE_ENV !== 'production';
}

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const parentPhoneSchema = z.object({
  phone: z.string().min(8).max(20),
});

const parentOtpVerifySchema = z.object({
  phone: z.string().min(8).max(20),
  otp: z.string().regex(/^\d{4,8}$/),
});

function echoOtpEnabled(sendResult) {
  if (sendResult?.skipped) return true;
  const flag = String(env('OTP_RETURN_IN_RESPONSE', '') || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email or password payload', details: parsed.error.flatten() });
  }

  const { email, password, rememberMe } = parsed.data;
  const user = await prisma.tblUsers.findUnique({
    where: { email: email.toLowerCase() },
    include: { tblRoles: true },
  });
  if (!user || user.int_status === 0) {
    logAdminAudit(req, {
      actor: { email: email.toLowerCase() },
      action: 'LOGIN_FAILED',
      category: 'AUTH',
      summary: `Failed login attempt for ${email.toLowerCase()}`,
      details: { reason: 'user_not_found_or_inactive' },
      success: false,
    });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    logAdminAudit(req, {
      actor: { id: user.user_id, name: user.name, email: user.email, role: user.role_id },
      action: 'LOGIN_FAILED',
      category: 'AUTH',
      summary: `Failed login for ${user.email} (bad password)`,
      details: { reason: 'bad_password' },
      success: false,
    });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const publicUser = { ...serializeUser(user), tenant: getRequestTenant() };
  const requiresPasswordChange = await userRequiresPasswordChange(user, publicUser.role);
  const expiresIn = rememberMe ? '30d' : '12h';
  const token = signToken(
    {
      id: publicUser.id,
      email: publicUser.email,
      name: publicUser.name,
      role: publicUser.role,
      tenant: publicUser.tenant,
    },
    { expiresIn }
  );
  logAdminAudit(req, {
    actor: publicUser,
    action: 'LOGIN',
    category: 'AUTH',
    entityType: 'user',
    entityId: publicUser.id,
    summary: `${publicUser.name || publicUser.email} logged in (${publicUser.role})`,
    details: { rememberMe: Boolean(rememberMe), expiresIn, requiresPasswordChange },
  });
  return res.json({ token, user: publicUser, expiresIn, requiresPasswordChange });
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

router.post('/forgot-password', async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const tenant = getRequestTenant() || APEX_TENANT;
  const user = await prisma.tblUsers.findUnique({
    where: { email },
  });

  if (!user || user.int_status === 0) {
    return res.json({ message: GENERIC_RESET_MESSAGE });
  }

  const token = signPasswordResetToken(user, tenant);
  const resetLink = buildResetLink(passwordResetAppOrigin(req), token);

  logAdminAudit(req, {
    actor: { id: user.user_id, name: user.name, email: user.email, role: user.role_id },
    action: 'PASSWORD_RESET_REQUEST',
    category: 'AUTH',
    entityType: 'user',
    entityId: user.user_id,
    summary: `${user.email} requested a password reset`,
  });

  if (!isEmailConfigured()) {
    console.error('[forgot-password] EMAIL_USER / EMAIL_PASS not set. Reset link:', resetLink);
    if (isLocalRequest(req)) {
      return res.json({
        message: 'Email is not configured. Use the resetLink below (local/dev only).',
        resetLink,
      });
    }
    return res.status(503).json({
      error: 'Password reset email is not configured. Please contact the school administrator.',
    });
  }

  try {
    await sendPasswordResetEmail({ to: user.email, resetLink });
    return res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (err) {
    console.error('[forgot-password] email failed', err);
    console.error('[forgot-password] reset link:', err.resetLink || resetLink);
    if (isLocalRequest(req)) {
      return res.json({
        message: 'Email could not be sent. Use the resetLink below (local/dev only).',
        resetLink: err.resetLink || resetLink,
        error: err.message,
      });
    }
    return res.status(500).json({
      error: 'Could not send the reset email. Please try again later or contact the school administrator.',
    });
  }
});

router.post('/reset-password', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const { token, newPassword } = parsed.data;
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  if (payload?.typ !== RESET_TOKEN_TYP || !payload.sub) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  const requestTenant = getRequestTenant() || APEX_TENANT;
  const tokenTenant = payload.tenant || APEX_TENANT;
  if (tokenTenant !== requestTenant) {
    return res.status(400).json({ error: 'Open this reset link from the same school website it was sent for.' });
  }

  const user = await prisma.tblUsers.findUnique({
    where: { user_id: payload.sub },
  });
  if (!user || user.int_status === 0) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }
  if (payload.email && String(payload.email).toLowerCase() !== String(user.email).toLowerCase()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.tblUsers.update({
    where: { user_id: user.user_id },
    data: { password: passwordHash },
  });

  logAdminAudit(req, {
    actor: { id: user.user_id, name: user.name, email: user.email, role: user.role_id },
    action: 'PASSWORD_RESET',
    category: 'AUTH',
    entityType: 'user',
    entityId: user.user_id,
    summary: `${user.name || user.email} reset password`,
  });

  return res.json({ message: 'Password has been reset. You can sign in with your new password.' });
});

router.post('/parent/otp/request', async (req, res) => {
  const parsed = parentPhoneSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter a valid mobile number' });
  }
  const digits10 = last10Digits(parsed.data.phone);
  if (!digits10) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
  }

  const students = await findStudentsByParentPhone(digits10);
  if (!students.length) {
    return res.status(404).json({ error: 'This mobile number is not registered with any student' });
  }

  const issued = issueOtp(digits10);
  if (!issued.ok) {
    return res.status(429).json({
      error: issued.error,
      retryAfterSec: issued.retryAfterSec,
    });
  }

  const send = await sendOtpSms({ to: digits10, otp: issued.otp });
  const wa = await sendOtpWhatsApp({ toPhone: digits10, otp: issued.otp });
  const smsOk = send.ok && !send.skipped;
  const waOk = wa.ok && !wa.skipped;
  const echo = echoOtpEnabled(send) && !waOk;
  if (!smsOk && !waOk && !echo) {
    return res.status(502).json({
      error: wa.error || send.error || 'Could not send OTP',
    });
  }

  const payload = {
    ok: true,
    phoneHint: `xxxxxx${digits10.slice(-4)}`,
    expiresInSec: issued.expiresInSec,
    sent: Boolean(smsOk || waOk),
    channels: { sms: Boolean(smsOk), whatsapp: Boolean(waOk) },
  };
  if (send.warning) payload.warning = send.warning;
  if (echo) payload.devOtp = issued.otp;
  return res.json(payload);
});

router.post('/parent/otp/verify', async (req, res) => {
  const parsed = parentOtpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter the mobile number and 6-digit OTP' });
  }
  const digits10 = last10Digits(parsed.data.phone);
  if (!digits10) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
  }

  const checked = consumeOtp(digits10, parsed.data.otp);
  if (!checked.ok) {
    logAdminAudit(req, {
      actor: { phone: digits10 },
      action: 'LOGIN_FAILED',
      category: 'AUTH',
      summary: `Failed parent OTP for ****${digits10.slice(-4)}`,
      details: { reason: 'bad_or_expired_otp' },
      success: false,
    });
    return res.status(401).json({ error: checked.error });
  }

  const result = await findOrCreateParentByPhone(digits10);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  const publicUser = { ...result.user, tenant: getRequestTenant() };
  const expiresIn = '30d';
  const token = signToken(
    {
      id: publicUser.id,
      email: publicUser.email,
      name: publicUser.name,
      role: publicUser.role,
      tenant: publicUser.tenant,
    },
    { expiresIn }
  );
  logAdminAudit(req, {
    actor: publicUser,
    action: 'LOGIN',
    category: 'AUTH',
    entityType: 'user',
    entityId: publicUser.id,
    summary: `${publicUser.name || publicUser.email} logged in via OTP (${publicUser.role})`,
    details: { method: 'parent_otp', expiresIn, studentCount: result.studentCount },
  });
  return res.json({ token, user: publicUser, expiresIn, requiresPasswordChange: false });
});

router.put('/change-password', requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid password payload', details: parsed.error.flatten() });
  }

  const user = await prisma.tblUsers.findUnique({
    where: { user_id: req.user.sub },
    include: { tblRoles: true },
  });
  if (!user || user.int_status === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { currentPassword, newPassword } = parsed.data;
  const currentOk = await bcrypt.compare(currentPassword, user.password);
  if (!currentOk) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from your current password' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.tblUsers.update({
    where: { user_id: user.user_id },
    data: { password: passwordHash },
  });

  logAdminAudit(req, {
    actor: {
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role_id,
    },
    action: 'PASSWORD_CHANGE',
    category: 'AUTH',
    entityType: 'user',
    entityId: user.user_id,
    summary: `${user.name || user.email} changed password`,
  });

  return res.json({ message: 'Password changed successfully.' });
});

export default router;
