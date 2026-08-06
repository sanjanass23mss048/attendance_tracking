import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { ensureAttendanceStatuses } from '../src/lib/statusMap.js';
import { toDateString } from '../src/lib/ids.js';
import {
  dbStudentIds,
  generateSectionRoster,
  splitFullName,
  studentDemoProfile,
  STUDENTS_PER_SECTION,
} from '../../src/data/studentRoster.js';

const prisma = new PrismaClient();

function dateUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function upsertRole(Role_id, Text) {
  return prisma.tblRoles.upsert({
    where: { Role_id },
    create: { Role_id, Text },
    update: { Text },
  });
}

async function main() {
  console.log('Seeding Attendence DB (non-destructive)…');

  await ensureAttendanceStatuses();
  console.log('Ensured attendance statuses P/A/L/H/OH/OF');

  await upsertRole('ADMIN', 'Admin');
  await upsertRole('INCHARGE', 'Incharge');
  await upsertRole('TEACHER', 'Teacher');

  const passwordHash = await bcrypt.hash('password123', 10);
  const inchargeEmail = 'incharge@brightfuture.edu.in';
  const existingUser = await prisma.tblUsers.findUnique({ where: { email: inchargeEmail } });
  if (!existingUser) {
    await prisma.tblUsers.create({
      data: {
        user_id: 'USR-INCHARGE',
        name: 'A. Pune',
        email: inchargeEmail,
        password: passwordHash,
        role_id: 'INCHARGE',
        int_status: 1,
      },
    });
    console.log('Created incharge user');
  } else {
    // Keep password in sync for demo login
    await prisma.tblUsers.update({
      where: { email: inchargeEmail },
      data: { password: passwordHash, role_id: 'INCHARGE', int_status: 1 },
    });
    console.log('Updated incharge user password for demo login');
  }

  // Seed a couple of teacher users only if none exist besides incharge
  const teacherCount = await prisma.tblUsers.count({
    where: { role_id: 'TEACHER' },
  });
  if (teacherCount === 0) {
    await prisma.tblUsers.createMany({
      data: [
        {
          user_id: 'USR-TCH-001',
          name: 'Neha Sharma',
          email: 'neha.sharma@brightfuture.edu.in',
          password: passwordHash,
          role_id: 'TEACHER',
          phone: 'EMP001',
          int_status: 1,
        },
        {
          user_id: 'USR-TCH-002',
          name: 'Rakesh Verma',
          email: 'rakesh.verma@brightfuture.edu.in',
          password: passwordHash,
          role_id: 'TEACHER',
          phone: 'EMP002',
          int_status: 1,
        },
      ],
      skipDuplicates: true,
    });
    console.log('Seeded demo teachers');
  }

  // Ensure staff profiles (subjects / department) exist for known demo teachers
  const staffProfiles = [
    {
      user_id: 'USR-TCH-001',
      staff_type: 'teaching',
      job_role: 'Class Teacher',
      department: 'Primary',
      subjects: 'English',
      classes_assigned: '1-A',
    },
    {
      user_id: 'USR-TCH-002',
      staff_type: 'teaching',
      job_role: 'Subject Teacher',
      department: 'Primary',
      subjects: 'Maths',
    },
  ];
  for (const profile of staffProfiles) {
    const user = await prisma.tblUsers.findUnique({ where: { user_id: profile.user_id } });
    if (!user) continue;
    await prisma.tblStaff_Profile.upsert({
      where: { user_id: profile.user_id },
      create: profile,
      update: {
        staff_type: profile.staff_type,
        job_role: profile.job_role,
        department: profile.department,
        subjects: profile.subjects,
        classes_assigned: profile.classes_assigned ?? null,
      },
    });
  }

  // Always ensure full grade structure (LKG, UKG, 1–12 × A/B/C)
  const { SCHOOL_GRADES, SCHOOL_SECTIONS } = await import('../../src/data/schoolGrades.js');
  for (const name of SCHOOL_SECTIONS) {
    await prisma.tblSection.upsert({
      where: { Section_id: `SEC-${name}` },
      create: { Section_id: `SEC-${name}`, Section_Name: name, Int_Status: 1 },
      update: { Section_Name: name, Int_Status: 1 },
    });
  }
  for (const className of SCHOOL_GRADES) {
    const classId = `CLS-${className}`;
    await prisma.tblClass.upsert({
      where: { Class_id: classId },
      create: {
        Class_id: classId,
        Class_Name: className,
        Academic_Year: '2025-26',
      },
      update: { Class_Name: className },
    });
    for (const sectionName of SCHOOL_SECTIONS) {
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
  console.log(`Ensured grades: ${SCHOOL_GRADES.join(', ')} × sections ${SCHOOL_SECTIONS.join(', ')}`);

  // Demo students only when the DB has no student rows yet (primary grades only)
  const studentCount = await prisma.tblStudents.count();
  if (studentCount > 0) {
    console.log(`tblStudents already has ${studentCount} rows — skipping demo student seed`);
  } else {
    const demoGrades = ['1', '2', '3', '4', '5'];
    for (const className of demoGrades) {
      for (const sectionName of SCHOOL_SECTIONS) {
        const csId = `CS-${className}-${sectionName}`;
        const roster = generateSectionRoster(className, sectionName);

        for (const s of roster) {
          const { first, last } = splitFullName(s.name);
          const profile = studentDemoProfile(className, sectionName, s.rollNo, s.name);
          const { studentId, studentClassId: scId } = dbStudentIds(className, sectionName, s.rollNo);

          await prisma.tblStudents.create({
            data: {
              Student_id: studentId,
              Admission_No: profile.admissionNo,
              Roll_No: String(s.rollNo),
              First_Name: first,
              Last_Name: last,
              Gender: profile.gender,
              DOB: dateUTC(profile.dob),
              Father_Name: profile.fatherName,
              Mother_Name: profile.motherName,
              Father_Number: profile.parentPhone,
              Address_Line_1: profile.address,
              Country: profile.nationality,
              Int_Status: 1,
            },
          });

          await prisma.tblStudent_Class.create({
            data: {
              student_class_id: scId,
              Student_id: studentId,
              class_section_id: csId,
              Roll_No: String(s.rollNo),
              Academic_Year: '2025-26',
              Int_Status: 1,
            },
          });
        }
      }
    }
    console.log(`Seeded demo students for classes 1–5 (${STUDENTS_PER_SECTION} per section)`);
  }

  const holidayCount = await prisma.tblHolidays.count();
  if (holidayCount === 0) {
    await prisma.tblHolidays.createMany({
      data: [
        {
          Holiday_id: 'HOL-RD',
          Date: dateUTC('2026-01-26'),
          Text: 'Republic Day',
          Description: 'govt',
        },
        {
          Holiday_id: 'HOL-ID',
          Date: dateUTC('2026-08-15'),
          Text: 'Independence Day',
          Description: 'govt',
        },
        {
          Holiday_id: 'HOL-GJ',
          Date: dateUTC('2026-10-02'),
          Text: 'Gandhi Jayanti',
          Description: 'govt',
        },
        {
          Holiday_id: 'HOL-SD',
          Date: dateUTC('2026-07-17'),
          Text: 'Staff Development Day',
          Description: 'sudden',
        },
        {
          Holiday_id: 'HOL-WO',
          Date: dateUTC('2026-07-19'),
          Text: 'Weekly Off (Sunday)',
          Description: 'weekly',
        },
      ],
    });
    console.log('Seeded holidays');
  } else {
    console.log(`tblHolidays already has ${holidayCount} rows — skipping`);
  }

  const CURATED_INDIA_2026 = [
    { date: '2026-01-26', title: 'Republic Day' },
    { date: '2026-03-03', title: 'Holi' },
    { date: '2026-03-21', title: 'Id-ul-Fitr' },
    { date: '2026-03-31', title: 'Mahavir Jayanti' },
    { date: '2026-04-03', title: 'Good Friday' },
    { date: '2026-04-14', title: 'Ambedkar Jayanti' },
    { date: '2026-05-01', title: 'Buddha Purnima' },
    { date: '2026-05-28', title: 'Id-ul-Zuha (Bakrid)' },
    { date: '2026-06-26', title: 'Muharram' },
    { date: '2026-08-15', title: 'Independence Day' },
    { date: '2026-09-04', title: 'Janmashtami' },
    { date: '2026-09-26', title: 'Milad-un-Nabi' },
    { date: '2026-10-02', title: 'Gandhi Jayanti' },
    { date: '2026-10-20', title: 'Dussehra' },
    { date: '2026-11-08', title: 'Diwali' },
    { date: '2026-11-24', title: 'Guru Nanak Jayanti' },
    { date: '2026-12-25', title: 'Christmas' },
  ];

  const MAY_2026_EVENTS = [
    { id: 'e1', day: 1, type: 'event', title: 'Lab Activity', subtitle: 'Class 3 - 5' },
    { id: 'e2', day: 8, type: 'exam', title: 'Unit Test - I', subtitle: 'Class 1 - 5' },
    { id: 'e3', day: 15, type: 'holiday', title: 'Summer Break Begins', subtitle: '' },
    { id: 'e4', day: 18, type: 'working', title: 'Book Fair', subtitle: 'All Classes' },
    { id: 'e5', day: 29, type: 'event', title: 'Annual Day Celebration', subtitle: '' },
  ];

  const JULY_2026_DEMO_EVENTS = [
    { id: 'jul-exam-1', date: '2026-07-08', type: 'exam', title: 'Unit Test 1', subtitle: 'All Day' },
    { id: 'jul-event-1', date: '2026-07-17', type: 'event', title: 'Science Expo', subtitle: '10:00 AM' },
    { id: 'jul-important-1', date: '2026-07-28', type: 'important', title: 'PTM Meeting', subtitle: '2:00 PM – 3:30 PM' },
  ];

  const calendarEventCount = await prisma.tblCalendarEvents.count();
  if (calendarEventCount === 0) {
    const rows = [];

    for (const h of CURATED_INDIA_2026) {
      rows.push({
        Event_id: `govt-${h.date}-${h.title}`.slice(0, 50),
        Date: dateUTC(h.date),
        Text: h.title,
        Type: 'holiday',
        Subtitle: 'Government Holiday',
        Applicable_to: 'All Classes',
        Source: 'curated',
      });
    }

    for (const event of MAY_2026_EVENTS) {
      let type = event.type;
      if (type === 'sudden' && event.title.includes('Annual')) type = 'event';
      const iso = `2026-05-${String(event.day).padStart(2, '0')}`;
      rows.push({
        Event_id: event.id,
        Date: dateUTC(iso),
        Text: event.title,
        Type: type,
        Subtitle: event.subtitle || (type === 'holiday' ? 'School Holiday' : ''),
        Applicable_to: event.subtitle || 'All Classes',
        Source: 'school',
      });
    }

    for (const event of JULY_2026_DEMO_EVENTS) {
      rows.push({
        Event_id: event.id,
        Date: dateUTC(event.date),
        Text: event.title,
        Type: event.type,
        Subtitle: event.subtitle || '',
        Applicable_to: 'All Classes',
        Source: 'school',
      });
    }

    const legacyHolidays = await prisma.tblHolidays.findMany();
    for (const h of legacyHolidays) {
      const desc = String(h.Description || 'govt');
      const typeMatch = desc.match(/^(govt|sudden|weekly)/i);
      const legacyType = typeMatch ? typeMatch[1].toLowerCase() : 'govt';
      const calType =
        legacyType === 'weekly' ? 'weekly' : legacyType === 'sudden' ? 'sudden' : 'holiday';
      rows.push({
        Event_id: h.Holiday_id,
        Date: h.Date,
        Text: h.Text,
        Type: calType,
        Subtitle:
          calType === 'sudden'
            ? 'Sudden Holiday'
            : calType === 'weekly'
              ? 'Weekly Holiday'
              : 'Holiday',
        Applicable_to: 'All Classes',
        Source: calType === 'sudden' ? 'sudden' : 'govt',
      });
    }

    const seen = new Set();
    const unique = rows.filter((row) => {
      const key = `${toDateString(row.Date)}|${row.Text}|${row.Type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await prisma.tblCalendarEvents.createMany({ data: unique, skipDuplicates: true });
    console.log(`Seeded ${unique.length} calendar events`);
  } else {
    console.log(`tblCalendarEvents already has ${calendarEventCount} rows — skipping`);
  }

  // Teacher ↔ class-section assignments (source of truth for teacher access)
  const teacherLinks = [
    { id: 'TC-1A-NEHA', userId: 'USR-TCH-001', sectionId: 'CS-1-A' },
    { id: 'TC-2A-RAK', userId: 'USR-TCH-002', sectionId: 'CS-2-A' },
    { id: 'TC-3A-RAK', userId: 'USR-TCH-002', sectionId: 'CS-3-A' },
  ];
  for (const link of teacherLinks) {
    const section = await prisma.tblClass_Section.findUnique({
      where: { Class_Section_id: link.sectionId },
    });
    if (!section) continue;
    await prisma.tblTeacher_Class.upsert({
      where: { teacher_class_id: link.id },
      create: {
        teacher_class_id: link.id,
        user_id: link.userId,
        class_section_id: link.sectionId,
        Int_Status: 1,
      },
      update: {
        user_id: link.userId,
        class_section_id: link.sectionId,
        Int_Status: 1,
      },
    });
  }
  console.log('Teacher class links ensured (Neha → 1-A; Rakesh → 2-A, 3-A)');

  const counts = {
    statuses: await prisma.tblAttendanceStatus.count(),
    users: await prisma.tblUsers.count(),
    classes: await prisma.tblClass.count(),
    classSections: await prisma.tblClass_Section.count(),
    students: await prisma.tblStudents.count(),
    enrollments: await prisma.tblStudent_Class.count(),
    holidays: await prisma.tblHolidays.count(),
    calendarEvents: await prisma.tblCalendarEvents.count(),
  };
  console.log('Done.', counts);
  console.log('Login (full access): incharge@brightfuture.edu.in / password123');
  console.log('Login (Class 1-A only): neha.sharma@brightfuture.edu.in / password123');
  console.log('Login (Classes 2-A & 3-A): rakesh.verma@brightfuture.edu.in / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
