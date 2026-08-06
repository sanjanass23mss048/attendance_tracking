import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { mapRoleToApp, syncTeacherClassAssignments } from '../services/schoolRepo.js';

const router = Router();

const staffTypeEnum = z.enum(['teaching', 'non-teaching']);
const statusEnum = z.enum(['Active', 'On Leave', 'Inactive']);

const createSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  staffType: staffTypeEnum.optional(),
  role: z.string().min(1).optional(),
  department: z.string().optional().nullable(),
  subjects: z.string().optional().nullable(),
  classesAssigned: z.string().optional().nullable(),
  status: statusEnum.optional(),
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  joinDate: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial();

function parseOptionalDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function ensureTeacherRole() {
  const existing = await prisma.tblRoles.findFirst({
    where: { OR: [{ Role_id: 'TEACHER' }, { Text: { contains: 'Teacher', mode: 'insensitive' } }] },
  });
  if (existing) return existing;
  return prisma.tblRoles.create({
    data: { Role_id: 'TEACHER', Text: 'Teacher' },
  });
}

async function classesAssignedForUser(userId) {
  const links = await prisma.tblTeacher_Class.findMany({
    where: { user_id: userId, Int_Status: { not: 0 } },
    include: {
      tblClass_Section: { include: { tblClass: true, tblSection: true } },
    },
  });
  if (!links.length) return null;
  return links
    .map((l) => {
      const c = l.tblClass_Section?.tblClass?.Class_Name;
      const s = l.tblClass_Section?.tblSection?.Section_Name;
      return c && s ? `${c}-${s}` : null;
    })
    .filter(Boolean)
    .join(', ');
}

function profileFromBody(body) {
  const data = {};
  if (body.staffType !== undefined) data.staff_type = body.staffType || null;
  if (body.role !== undefined) data.job_role = body.role?.trim() || null;
  if (body.department !== undefined) data.department = body.department?.trim() || null;
  if (body.subjects !== undefined) data.subjects = body.subjects?.trim() || null;
  if (body.classesAssigned !== undefined) data.classes_assigned = body.classesAssigned?.trim() || null;
  if (body.gender !== undefined) data.gender = body.gender?.trim() || null;
  if (body.address !== undefined) data.address = body.address?.trim() || null;
  if (body.dob !== undefined) data.dob = parseOptionalDate(body.dob);
  if (body.joinDate !== undefined) data.join_date = parseOptionalDate(body.joinDate);
  return data;
}

function serializeTeacher(user, classesAssigned) {
  const profile = user.tblStaff_Profile;
  const roleName = profile?.job_role || user.tblRoles?.Text || 'Teacher';
  const appRole = mapRoleToApp(user.role_id, user.tblRoles?.Text);
  const status =
    user.int_status === 0 ? 'Inactive' : user.int_status === 2 ? 'On Leave' : 'Active';
  const linkedClasses = classesAssigned ?? null;
  const profileClasses = profile?.classes_assigned || null;
  return {
    id: user.user_id,
    employeeId: user.phone || user.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    staffType:
      profile?.staff_type ||
      (appRole === 'TEACHER' || linkedClasses ? 'teaching' : 'non-teaching'),
    role: roleName,
    department: profile?.department ?? null,
    subjects: profile?.subjects ?? null,
    classesAssigned: linkedClasses || profileClasses || null,
    status,
    dob: formatDate(profile?.dob),
    gender: profile?.gender ?? null,
    address: profile?.address ?? null,
    joinDate: formatDate(profile?.join_date),
  };
}

const userInclude = { tblRoles: true, tblStaff_Profile: true };

router.get('/', requireAuth, async (_req, res) => {
  const users = await prisma.tblUsers.findMany({
    include: userInclude,
    orderBy: { name: 'asc' },
  });

  const teachers = [];
  for (const user of users) {
    const role = mapRoleToApp(user.role_id, user.tblRoles?.Text);
    const assigned = await classesAssignedForUser(user.user_id);
    if (role === 'TEACHER' || assigned || role === 'ADMIN') {
      if (role === 'INCHARGE' && !assigned) continue;
      teachers.push(serializeTeacher(user, assigned));
    }
  }

  if (!teachers.length) {
    for (const user of users) {
      const role = mapRoleToApp(user.role_id, user.tblRoles?.Text);
      if (role === 'INCHARGE') continue;
      teachers.push(serializeTeacher(user, await classesAssignedForUser(user.user_id)));
    }
  }

  return res.json({ teachers });
});

router.get('/:id', requireAuth, async (req, res) => {
  const user = await prisma.tblUsers.findUnique({
    where: { user_id: req.params.id },
    include: userInclude,
  });
  if (!user) return res.status(404).json({ error: 'Teacher not found' });
  const assigned = await classesAssignedForUser(user.user_id);
  return res.json({ teacher: serializeTeacher(user, assigned) });
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }
  const body = parsed.data;
  const role = await ensureTeacherRole();
  const password = await bcrypt.hash('password123', 10);
  const profileData = profileFromBody({
    staffType: body.staffType || 'teaching',
    role: body.role || 'Subject Teacher',
    department: body.department,
    subjects: body.subjects,
    classesAssigned: body.classesAssigned,
    dob: body.dob,
    gender: body.gender,
    address: body.address,
    joinDate: body.joinDate,
  });

  try {
    const user = await prisma.tblUsers.create({
      data: {
        user_id: body.employeeId.slice(0, 50),
        name: body.name.trim(),
        email: body.email.toLowerCase(),
        password,
        role_id: role.Role_id,
        phone: body.phone?.trim() || body.employeeId,
        int_status: body.status === 'Inactive' ? 0 : body.status === 'On Leave' ? 2 : 1,
        tblStaff_Profile: {
          create: profileData,
        },
      },
      include: userInclude,
    });
    await syncTeacherClassAssignments(user.user_id, body.classesAssigned || null);
    const assigned = await classesAssignedForUser(user.user_id);
    return res.status(201).json({
      teacher: serializeTeacher(user, assigned),
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Email or employee id already exists' });
    }
    throw err;
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const existing = await prisma.tblUsers.findUnique({
    where: { user_id: req.params.id },
    include: { tblStaff_Profile: true },
  });
  if (!existing) return res.status(404).json({ error: 'Teacher not found' });

  const body = parsed.data;
  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.email !== undefined) data.email = body.email.toLowerCase();
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.status !== undefined) {
    data.int_status = body.status === 'Inactive' ? 0 : body.status === 'On Leave' ? 2 : 1;
  }

  const profileData = profileFromBody(body);
  const hasProfileFields = Object.keys(profileData).length > 0;

  try {
    const user = await prisma.tblUsers.update({
      where: { user_id: req.params.id },
      data: {
        ...data,
        ...(hasProfileFields
          ? {
              tblStaff_Profile: existing.tblStaff_Profile
                ? { update: profileData }
                : { create: profileData },
            }
          : {}),
      },
      include: userInclude,
    });
    if (body.classesAssigned !== undefined) {
      await syncTeacherClassAssignments(user.user_id, body.classesAssigned);
    }
    const assigned = await classesAssignedForUser(user.user_id);
    return res.json({ teacher: serializeTeacher(user, assigned) });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw err;
  }
});

export default router;
