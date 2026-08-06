import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';
import { serializeUser } from '../services/schoolRepo.js';

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
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
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
  return res.json({ token, user: publicUser, expiresIn });
});

export default router;
