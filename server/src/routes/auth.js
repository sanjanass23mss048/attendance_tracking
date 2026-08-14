import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeUser } from '../services/schoolRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { getRequestTenant } from '../lib/tenantContext.js';
import { userRequiresPasswordChange } from '../lib/initialPassword.js';

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
