/**
 * Create additional demo teacher logins with class assignments.
 * Safe to re-run (upserts users, profiles, and teacher-class links).
 *
 * Password for all: password123
 *
 * Usage: node scripts/seed-extra-teachers.js
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';

const PASSWORD = 'password123';

const TEACHERS = [
  {
    userId: 'USR-TCH-003',
    name: 'Priya Nair',
    email: 'priya.nair@brightfuture.edu.in',
    empPhone: 'EMP003',
    department: 'Kindergarten',
    subjects: 'EVS',
    jobRole: 'Class Teacher',
    classesAssigned: 'LKG-A',
    sections: ['CS-LKG-A'],
  },
  {
    userId: 'USR-TCH-004',
    name: 'Anil Kumar',
    email: 'anil.kumar@brightfuture.edu.in',
    empPhone: 'EMP004',
    department: 'Kindergarten',
    subjects: 'English',
    jobRole: 'Class Teacher',
    classesAssigned: 'UKG-A',
    sections: ['CS-UKG-A'],
  },
  {
    userId: 'USR-TCH-005',
    name: 'Kavita Reddy',
    email: 'kavita.reddy@brightfuture.edu.in',
    empPhone: 'EMP005',
    department: 'Primary',
    subjects: 'Science',
    jobRole: 'Class Teacher',
    classesAssigned: '4-A, 5-A',
    sections: ['CS-4-A', 'CS-5-A'],
  },
  {
    userId: 'USR-TCH-006',
    name: 'Suresh Iyer',
    email: 'suresh.iyer@brightfuture.edu.in',
    empPhone: 'EMP006',
    department: 'Middle',
    subjects: 'Maths',
    jobRole: 'Class Teacher',
    classesAssigned: '6-A',
    sections: ['CS-6-A'],
  },
  {
    userId: 'USR-TCH-007',
    name: 'Meena Joshi',
    email: 'meena.joshi@brightfuture.edu.in',
    empPhone: 'EMP007',
    department: 'Middle',
    subjects: 'Social Studies',
    jobRole: 'Class Teacher',
    classesAssigned: '7-A, 8-A',
    sections: ['CS-7-A', 'CS-8-A'],
  },
];

async function main() {
  await prisma.tblRoles.upsert({
    where: { Role_id: 'TEACHER' },
    create: { Role_id: 'TEACHER', Text: 'Teacher' },
    update: { Text: 'Teacher' },
  });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  console.log(`Creating ${TEACHERS.length} teacher logins…`);

  for (const t of TEACHERS) {
    await prisma.tblUsers.upsert({
      where: { email: t.email },
      create: {
        user_id: t.userId,
        name: t.name,
        email: t.email,
        password: passwordHash,
        role_id: 'TEACHER',
        phone: t.empPhone,
        int_status: 1,
      },
      update: {
        name: t.name,
        password: passwordHash,
        role_id: 'TEACHER',
        phone: t.empPhone,
        int_status: 1,
      },
    });

    // Ensure stable user_id if email existed with a different id
    const user = await prisma.tblUsers.findUnique({ where: { email: t.email } });
    const userId = user?.user_id || t.userId;

    await prisma.tblStaff_Profile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        staff_type: 'teaching',
        job_role: t.jobRole,
        department: t.department,
        subjects: t.subjects,
        classes_assigned: t.classesAssigned,
      },
      update: {
        staff_type: 'teaching',
        job_role: t.jobRole,
        department: t.department,
        subjects: t.subjects,
        classes_assigned: t.classesAssigned,
      },
    });

    for (const sectionId of t.sections) {
      const section = await prisma.tblClass_Section.findUnique({
        where: { Class_Section_id: sectionId },
      });
      if (!section) {
        console.warn(`  skip missing section ${sectionId}`);
        continue;
      }
      const linkId = `TC-${sectionId.replace(/^CS-/, '')}-${userId.replace(/^USR-TCH-/, 'T')}`;
      const existing = await prisma.tblTeacher_Class.findFirst({
        where: { user_id: userId, class_section_id: sectionId },
      });
      if (existing) {
        await prisma.tblTeacher_Class.update({
          where: { teacher_class_id: existing.teacher_class_id },
          data: { Int_Status: 1 },
        });
      } else {
        await prisma.tblTeacher_Class.create({
          data: {
            teacher_class_id: linkId.slice(0, 50),
            user_id: userId,
            class_section_id: sectionId,
            Int_Status: 1,
          },
        });
      }
    }

    console.log(`  ✓ ${t.name} <${t.email}> → ${t.classesAssigned}`);
  }

  console.log('\nAll passwords: password123');
  console.log('Existing:');
  console.log('  incharge@brightfuture.edu.in → all classes');
  console.log('  neha.sharma@brightfuture.edu.in → 1-A');
  console.log('  rakesh.verma@brightfuture.edu.in → 2-A, 3-A');
  console.log('New:');
  for (const t of TEACHERS) {
    console.log(`  ${t.email} → ${t.classesAssigned}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
