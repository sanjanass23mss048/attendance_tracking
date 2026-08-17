import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { newId } from '../lib/ids.js';
import { last10Digits } from '../lib/parentOtpStore.js';
import { serializeUser } from './schoolRepo.js';

async function randomPasswordHash() {
  const raw = crypto.randomBytes(24).toString('hex');
  return bcrypt.hash(raw, 10);
}

async function ensureParentRole() {
  const existing = await prisma.tblRoles.findUnique({ where: { Role_id: 'PARENT' } });
  if (existing) return existing;
  return prisma.tblRoles.create({
    data: { Role_id: 'PARENT', Text: 'Parent' },
  });
}

function parentDisplayName(student, digits10) {
  const match = (raw) => last10Digits(raw) === digits10;
  if (match(student.Father_Number) && student.Father_Name) return String(student.Father_Name).trim();
  if (match(student.Mother_Number) && student.Mother_Name) return String(student.Mother_Name).trim();
  if (match(student.Guardian_Number) && student.Guardian_Name) {
    return String(student.Guardian_Name).trim();
  }
  return (
    student.Father_Name ||
    student.Mother_Name ||
    student.Guardian_Name ||
    'Parent'
  );
}

export async function findStudentsByParentPhone(digits10) {
  if (!digits10) return [];
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT "Student_id", "First_Name", "Last_Name",
           "Father_Name", "Mother_Name", "Guardian_Name",
           "Father_Number", "Mother_Number", "Guardian_Number", "Alternative_Number"
    FROM "tblStudents"
    WHERE COALESCE("Int_Status", 1) <> 0
      AND (
        RIGHT(regexp_replace(COALESCE("Father_Number", ''), '[^0-9]', '', 'g'), 10) = ${digits10}
        OR RIGHT(regexp_replace(COALESCE("Mother_Number", ''), '[^0-9]', '', 'g'), 10) = ${digits10}
        OR RIGHT(regexp_replace(COALESCE("Guardian_Number", ''), '[^0-9]', '', 'g'), 10) = ${digits10}
        OR RIGHT(regexp_replace(COALESCE("Alternative_Number", ''), '[^0-9]', '', 'g'), 10) = ${digits10}
      )
  `);
  return rows || [];
}

async function findParentUserByPhone(digits10) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT u.user_id
    FROM "tblUsers" u
    WHERE COALESCE(u.int_status, 1) <> 0
      AND u.role_id = 'PARENT'
      AND RIGHT(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 10) = ${digits10}
    LIMIT 1
  `);
  const id = rows?.[0]?.user_id;
  if (!id) return null;
  return prisma.tblUsers.findUnique({
    where: { user_id: id },
    include: { tblRoles: true },
  });
}

async function linkParentToStudents(userId, students) {
  for (const student of students) {
    const studentId = student.Student_id;
    if (!studentId) continue;
    const existing = await prisma.tblParent_Student.findFirst({
      where: { user_id: userId, Student_id: studentId },
    });
    if (existing) {
      if (existing.Int_Status === 0) {
        await prisma.tblParent_Student.update({
          where: { Link_id: existing.Link_id },
          data: { Int_Status: 1 },
        });
      }
      continue;
    }
    await prisma.tblParent_Student.create({
      data: {
        Link_id: newId('PS'),
        user_id: userId,
        Student_id: studentId,
        Int_Status: 1,
      },
    });
  }
}

/**
 * Locate (or create) a PARENT user for this registered phone and link all matching children.
 */
export async function findOrCreateParentByPhone(digits10) {
  const students = await findStudentsByParentPhone(digits10);
  if (!students.length) {
    return { ok: false, error: 'This mobile number is not registered with any student' };
  }

  await ensureParentRole();
  let user = await findParentUserByPhone(digits10);

  if (!user) {
    const email = `p${digits10}@parent.presence.local`;
    const clash = await prisma.tblUsers.findUnique({ where: { email } });
    if (clash && String(clash.role_id || '').toUpperCase() === 'PARENT') {
      user = await prisma.tblUsers.findUnique({
        where: { user_id: clash.user_id },
        include: { tblRoles: true },
      });
    } else if (!clash) {
      const password = await randomPasswordHash();
      user = await prisma.tblUsers.create({
        data: {
          user_id: newId('USR'),
          name: parentDisplayName(students[0], digits10),
          email,
          password,
          role_id: 'PARENT',
          phone: digits10,
          int_status: 1,
        },
        include: { tblRoles: true },
      });
    } else {
      return { ok: false, error: 'This number cannot be used for parent login' };
    }
  } else if (!user.phone) {
    user = await prisma.tblUsers.update({
      where: { user_id: user.user_id },
      data: { phone: digits10 },
      include: { tblRoles: true },
    });
  }

  await linkParentToStudents(user.user_id, students);
  return { ok: true, user: serializeUser(user), studentCount: students.length };
}
