/**
 * Seed realistic daily attendance for the Bright Future (apex) database.
 *
 * Default window: 2026-06-01 through 2026-08-31.
 * Sundays are treated as non-working days. Re-running this script replaces
 * daily marks only inside the selected window, so the generated report data
 * remains deterministic.
 *
 * Usage:
 *   node scripts/seedThreeMonthsAttendance.js
 *   SEED_ATTENDANCE_FROM=2026-06-01 SEED_ATTENDANCE_TO=2026-08-31 node scripts/seedThreeMonthsAttendance.js
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { attendanceHeaderId, DAILY_SESSION, parseDateOnly } from '../src/lib/ids.js';
import { ensureAttendanceStatuses } from '../src/lib/statusMap.js';

const prisma = new PrismaClient();

const DEFAULT_FROM = '2026-06-01';
const DEFAULT_TO = '2026-08-31';
const MARKED_BY = 'USR-INCHARGE';

function dateUtc(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function formatIso(date) {
  return date.toISOString().slice(0, 10);
}

function weekdaysInRange(from, to) {
  const dates = [];
  const cursor = dateUtc(from);
  const end = dateUtc(to);

  while (cursor <= end) {
    if (cursor.getUTCDay() !== 0) dates.push(formatIso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function addDays(iso, days) {
  const date = dateUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIso(date);
}

function salId(attendanceId, studentId) {
  const raw = `SAL-${attendanceId}-${studentId}`;
  if (raw.length <= 50) return raw;
  return `SAL-${createHash('sha1').update(raw).digest('hex').slice(0, 16)}`.slice(0, 50);
}

function stableNumber(value) {
  return createHash('sha1').update(value).digest().readUInt32BE(0) % 100;
}

function fullName(student) {
  return [student.tblStudents?.First_Name, student.tblStudents?.Last_Name]
    .filter(Boolean)
    .join(' ')
    .trim() || student.student_class_id;
}

function sectionLabel(student) {
  const className = student.tblClass_Section?.tblClass?.Class_Name || '?';
  const sectionName = student.tblClass_Section?.tblSection?.Section_Name || '?';
  return `${className}-${sectionName}`;
}

function studentLabel(student) {
  return `${fullName(student)} (${sectionLabel(student)}, Roll ${student.Roll_No || '—'})`;
}

function statusFor({ student, date, longLeaveId, fridayLeaveId, patternedAbsenceId, longLeaveFrom, longLeaveTo }) {
  const id = student.student_class_id;

  // Explicit report scenarios requested for test data.
  if (id === longLeaveId && date >= longLeaveFrom && date <= longLeaveTo) return 'A';
  if (id === fridayLeaveId && dateUtc(date).getUTCDay() === 5) return 'A';
  if (id === patternedAbsenceId && dateUtc(date).getUTCDay() === 1 && date.slice(-2) % 2 === 0) {
    return 'A';
  }

  // Deterministic variety for the rest of the school.
  const n = stableNumber(`${id}:${date}`);
  if (n < 5) return 'A';
  if (n < 9) return 'L';
  if (n < 11) return 'H';
  if (n < 12) return 'OH';
  if (n < 13) return 'OF';
  return 'P';
}

function sortedStudents(students) {
  return [...students].sort((a, b) => {
    const classA = a.tblClass_Section?.tblClass?.Class_Name || '';
    const classB = b.tblClass_Section?.tblClass?.Class_Name || '';
    const sectionA = a.tblClass_Section?.tblSection?.Section_Name || '';
    const sectionB = b.tblClass_Section?.tblSection?.Section_Name || '';
    return (
      classA.localeCompare(classB, undefined, { numeric: true }) ||
      sectionA.localeCompare(sectionB) ||
      Number(a.Roll_No) - Number(b.Roll_No) ||
      fullName(a).localeCompare(fullName(b))
    );
  });
}

async function main() {
  const from = process.env.SEED_ATTENDANCE_FROM || DEFAULT_FROM;
  const to = process.env.SEED_ATTENDANCE_TO || DEFAULT_TO;
  if (!parseDateOnly(from) || !parseDateOnly(to) || from > to) {
    throw new Error('SEED_ATTENDANCE_FROM and SEED_ATTENDANCE_TO must be valid YYYY-MM-DD dates');
  }

  console.log(`Seeding Bright Future attendance from ${from} through ${to}…`);
  await ensureAttendanceStatuses();

  const sections = await prisma.tblClass_Section.findMany({
    where: { int_status: { not: 0 } },
    include: {
      tblClass: true,
      tblSection: true,
    },
  });
  const sectionIds = sections.map((section) => section.Class_Section_id);
  const students = sortedStudents(
    await prisma.tblStudent_Class.findMany({
      where: {
        class_section_id: { in: sectionIds },
        Int_Status: { not: 0 },
      },
      include: {
        tblStudents: true,
        tblClass_Section: {
          include: {
            tblClass: true,
            tblSection: true,
          },
        },
      },
    })
  );

  if (!students.length) {
    throw new Error('No active Bright Future students found. Seed students first.');
  }

  const dates = weekdaysInRange(from, to);
  const longLeaveFrom = addDays(from, 42);
  const longLeaveTo = addDays(longLeaveFrom, 13);
  const longLeaveStudent = students[0];
  const fridayLeaveStudent = students[1] || students[0];
  const patternedAbsenceStudent = students[2] || students[0];

  let headersUpserted = 0;
  let marksWritten = 0;
  const statusCounts = { P: 0, A: 0, L: 0, H: 0, OH: 0, OF: 0 };

  for (const section of sections) {
    const enrollments = students.filter(
      (student) => student.class_section_id === section.Class_Section_id
    );
    if (!enrollments.length) continue;

    for (const date of dates) {
      const Attendance_id = attendanceHeaderId(section.Class_Section_id, date);
      await prisma.tblAttendance.upsert({
        where: { Attendance_id },
        create: {
          Attendance_id,
          Attendance_Date: dateUtc(date),
          Attendance_Marked_By: MARKED_BY,
        },
        update: {
          Attendance_Marked_By: MARKED_BY,
        },
      });
      headersUpserted += 1;

      // Keep the operation idempotent and ensure exactly one daily mark/student.
      await prisma.tblStudentAtt_list.deleteMany({
        where: {
          Attendance_id,
          OR: [{ Session: DAILY_SESSION }, { Session: null }],
        },
      });

      const rows = enrollments.map((student) => {
        const status = statusFor({
          student,
          date,
          longLeaveId: longLeaveStudent.student_class_id,
          fridayLeaveId: fridayLeaveStudent.student_class_id,
          patternedAbsenceId: patternedAbsenceStudent.student_class_id,
          longLeaveFrom,
          longLeaveTo,
        });
        statusCounts[status] += 1;
        return {
          SAL_id: salId(Attendance_id, student.student_class_id),
          Attendance_id,
          student_class_id: student.student_class_id,
          Status_id: status,
          Session: DAILY_SESSION,
        };
      });

      await prisma.tblStudentAtt_list.createMany({ data: rows });
      marksWritten += rows.length;
    }
  }

  console.log('\nDone.');
  console.log(`  Active sections: ${sections.length}`);
  console.log(`  Active students: ${students.length}`);
  console.log(`  Working days: ${dates.length}`);
  console.log(`  Attendance headers upserted: ${headersUpserted}`);
  console.log(`  Daily marks written: ${marksWritten}`);
  console.log(`  Status totals: ${JSON.stringify(statusCounts)}`);
  console.log(`  Long absence: ${studentLabel(longLeaveStudent)} from ${longLeaveFrom} to ${longLeaveTo}`);
  console.log(`  Friday absence: ${studentLabel(fridayLeaveStudent)} every Friday`);
  console.log(`  Recurring absence: ${studentLabel(patternedAbsenceStudent)} on alternating Mondays`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
