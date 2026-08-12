import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';
import { serializeUser } from '../services/schoolRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
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

  const publicUser = serializeUser(user);
  // Remember me: longer session; otherwise shorter TTL
  const expiresIn = rememberMe ? '30d' : '12h';
  const token = signToken(
    {
      id: publicUser.id,
      email: publicUser.email,
      name: publicUser.name,
      role: publicUser.role,
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
    details: { rememberMe: Boolean(rememberMe), expiresIn },
  });
  return res.json({ token, user: publicUser, expiresIn });
});

export default router;
