import { STATUS_DEFS } from '../lib/statusMap.js';
import { hashInitialPassword } from '../lib/initialPassword.js';
function dateUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function academicYearLabel(d = new Date()) {
  const y = d.getFullYear();
  const month = d.getMonth() + 1;
  const start = month >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function gradesForTenant({ includeKg = true, maxGrade = 12 } = {}) {
  const grades = [];
  if (includeKg) {
    grades.push('LKG', 'UKG');
  }
  const max = Math.min(12, Math.max(1, Number(maxGrade) || 12));
  for (let n = 1; n <= max; n += 1) grades.push(String(n));
  return grades;
}

/**
 * Seed a brand-new school DB: statuses, 3 roles, classes/section A, holidays, admin user.
 * No students.
 */
export async function seedNewTenant(prisma, {
  schoolName,
  includeKg = true,
  maxGrade = 12,
  admin,
} = {}) {
  for (const row of STATUS_DEFS) {
    await prisma.tblAttendanceStatus.upsert({
      where: { Status_id: row.Status_id },
      create: row,
      update: { Text: row.Text },
    });
  }

  for (const [Role_id, Text] of [
    ['ADMIN', 'Admin'],
    ['TEACHER', 'Teacher'],
    ['PARENT', 'Parent'],
  ]) {
    await prisma.tblRoles.upsert({
      where: { Role_id },
      create: { Role_id, Text },
      update: { Text },
    });
  }

  const year = academicYearLabel();
  const sections = ['A'];
  for (const name of sections) {
    await prisma.tblSection.upsert({
      where: { Section_id: `SEC-${name}` },
      create: { Section_id: `SEC-${name}`, Section_Name: name, Int_Status: 1 },
      update: { Section_Name: name, Int_Status: 1 },
    });
  }

  const grades = gradesForTenant({ includeKg, maxGrade });
  for (const className of grades) {
    const classId = `CLS-${className}`;
    await prisma.tblClass.upsert({
      where: { Class_id: classId },
      create: { Class_id: classId, Class_Name: className, Academic_Year: year },
      update: { Class_Name: className },
    });
    for (const sectionName of sections) {
      const csId = `CS-${className}-${sectionName}`;
      await prisma.tblClass_Section.upsert({
        where: { Class_Section_id: csId },
        create: {
          Class_Section_id: csId,
          Class_id: classId,
          Section_id: `SEC-${sectionName}`,
          int_status: 1,
        },
        update: { int_status: 1 },
      });
    }
  }

  const holidayCount = await prisma.tblHolidays.count();
  if (holidayCount === 0) {
    const y = new Date().getFullYear();
    await prisma.tblHolidays.createMany({
      data: [
        {
          Holiday_id: 'HOL-RD',
          Date: dateUTC(`${y}-01-26`),
          Text: 'Republic Day',
          Description: 'govt',
        },
        {
          Holiday_id: 'HOL-ID',
          Date: dateUTC(`${y}-08-15`),
          Text: 'Independence Day',
          Description: 'govt',
        },
        {
          Holiday_id: 'HOL-GJ',
          Date: dateUTC(`${y}-10-02`),
          Text: 'Gandhi Jayanti',
          Description: 'govt',
        },
      ],
    });
  }

  const email = String(admin.email || '').trim().toLowerCase();
  const name = String(admin.name || 'School Admin').trim() || 'School Admin';
  const passwordHash = await hashInitialPassword();  const userId = 'USR-ADMIN';

  const existing = await prisma.tblUsers.findUnique({ where: { email } });
  if (existing) {
    await prisma.tblUsers.update({
      where: { email },
      data: {
        name,
        password: passwordHash,
        role_id: 'ADMIN',
        int_status: 1,
      },
    });
  } else {
    const idTaken = await prisma.tblUsers.findUnique({ where: { user_id: userId } });
    await prisma.tblUsers.create({
      data: {
        user_id: idTaken ? `USR-ADMIN-${Date.now().toString().slice(-6)}` : userId,
        name,
        email,
        password: passwordHash,
        role_id: 'ADMIN',
        phone: admin.phone?.trim() || null,
        int_status: 1,
      },
    });
  }

  return {
    schoolName: schoolName || null,
    grades,
    sections,
    adminEmail: email,
  };
}
