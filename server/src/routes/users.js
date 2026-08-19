import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { hashInitialPassword } from '../lib/initialPassword.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { mapRoleToApp } from '../services/schoolRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { newId } from '../lib/ids.js';

const router = Router();

const managers = requireRoles(
  'ADMIN',
  'INCHARGE',
  'HOD',
  'VICE_PRINCIPAL',
  'PRINCIPAL',
  'HEADMASTER'
);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(['TEACHER', 'ADMIN', 'INCHARGE']),
  phone: z.string().optional().nullable(),
});
function serializeAppUser(user) {
  return {
    id: user.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    role: mapRoleToApp(user.role_id, user.tblRoles?.Text),
    status: user.int_status === 0 ? 'Inactive' : 'Active',
  };
}

async function ensureRole(roleId) {
  const id = String(roleId).toUpperCase();
  const labels = { ADMIN: 'Admin', INCHARGE: 'Incharge', TEACHER: 'Teacher', PARENT: 'Parent' };
  const existing = await prisma.tblRoles.findUnique({ where: { Role_id: id } });
  if (existing) return existing;
  return prisma.tblRoles.create({
    data: { Role_id: id, Text: labels[id] || id },
  });
}

router.get('/', requireAuth, managers, async (_req, res) => {
  const rows = await prisma.tblUsers.findMany({
    where: { int_status: { not: 0 } },
    include: { tblRoles: true },
    orderBy: { name: 'asc' },
  });
  return res.json({ users: rows.map(serializeAppUser) });
});

router.post('/', requireAuth, managers, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }
  const body = parsed.data;
  const email = body.email.toLowerCase();
  const clash = await prisma.tblUsers.findUnique({ where: { email } });
  if (clash) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  await ensureRole(body.role);
  const password = body.password ? await bcrypt.hash(body.password, 10) : await hashInitialPassword();  const user = await prisma.tblUsers.create({
    data: {
      user_id: newId('USR'),
      name: body.name.trim(),
      email,
      password,
      role_id: body.role,
      phone: body.phone?.trim() || null,
      int_status: 1,
    },
    include: { tblRoles: true },
  });
  logAdminAudit(req, {
    action: 'USER_CREATE',
    category: 'TEACHER',
    entityType: 'user',
    entityId: user.user_id,
    summary: `Created ${body.role} account ${user.name} (${user.email})`,
    details: { role: body.role },
  });
  return res.status(201).json({ user: serializeAppUser(user) });
});

export default router;
