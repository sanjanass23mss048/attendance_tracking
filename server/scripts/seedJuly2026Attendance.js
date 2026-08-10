/**
 * Seed mock daily attendance for July 2026 across all class-sections.
 * Skips Sundays. Present is implied (not stored); only A/L/H/OH/OF are written.
 *
 * Prerequisites:
 *   npm run db:ensure-grades
 *   npm run db:seed-students
 *
 * Usage: node scripts/seedJuly2026Attendance.js
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { SCHOOL_GRADES, SCHOOL_SECTIONS } from '../../src/data/schoolGrades.js';
import { mockDailyStatusForStudent } from '../../src/data/mockData.js';
import { attendanceHeaderId, DAILY_SESSION, parseDateOnly } from '../src/lib/ids.js';
import { ensureAttendanceStatuses, isPresentStatus } from '../src/lib/statusMap.js';

const prisma = new PrismaClient();

const YEAR = 2026;
const MONTH = 7; // July

function julyWeekdays() {
  const out = [];
  const daysInMonth = new Date(YEAR, MONTH, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(`${dateStr}T12:00:00`);
    if (d.getDay() === 0) continue; // Sunday
    out.push(dateStr);
  }
  return out;
}

function salId(attendanceId, studentId) {
  const raw = `SAL-${attendanceId}-${studentId}`;
  if (raw.length <= 50) return raw;
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 16);
  return `SAL-${hash}`.slice(0, 50);
}

async function main() {
  console.log(`Seeding July ${YEAR} mock attendance for all classes…`);
  await ensureAttendanceStatuses();

  const dates = julyWeekdays();
  console.log(`Working days (excl. Sundays): ${dates.length}`);

  let sectionsDone = 0;
  let headersUpserted = 0;
  let marksWritten = 0;
  let emptySections = 0;

  for (const className of SCHOOL_GRADES) {
    for (const sectionName of SCHOOL_SECTIONS) {
      const csId = `CS-${className}-${sectionName}`;
      const link = await prisma.tblClass_Section.findUnique({
        where: { Class_Section_id: csId },
      });
      if (!link) {
        console.warn(`  skip ${csId} — missing class-section (run db:ensure-grades)`);
        continue;
      }

      const enrollments = await prisma.tblStudent_Class.findMany({
        where: { class_section_id: csId, Int_Status: { not: 0 } },
        select: { student_class_id: true, Roll_No: true },
        orderBy: { Roll_No: 'asc' },
      });

      if (!enrollments.length) {
        emptySections += 1;
        console.warn(`  skip ${csId} — no students (run db:seed-students)`);
        continue;
      }

      for (const dateStr of dates) {
        const attendanceDate = parseDateOnly(dateStr);
        const Attendance_id = attendanceHeaderId(csId, dateStr);

        await prisma.tblAttendance.upsert({
          where: { Attendance_id },
          create: {
            Attendance_id,
            Attendance_Date: attendanceDate,
            Attendance_Marked_By: 'USR-INCHARGE',
          },
          update: {
            Attendance_Marked_By: 'USR-INCHARGE',
          },
        });
        headersUpserted += 1;

        // Replace daily (Session D) marks for this header so re-runs are idempotent.
        await prisma.tblStudentAtt_list.deleteMany({
          where: {
            Attendance_id,
            OR: [{ Session: DAILY_SESSION }, { Session: null }],
          },
        });

        const rows = [];
        enrollments.forEach((enr, idx) => {
          const status = mockDailyStatusForStudent(idx, dateStr);
          if (isPresentStatus(status)) return;
          rows.push({
            SAL_id: salId(Attendance_id, enr.student_class_id),
            Attendance_id,
            student_class_id: enr.student_class_id,
            Status_id: status,
            Session: DAILY_SESSION,
          });
        });

        if (rows.length) {
          await prisma.tblStudentAtt_list.createMany({ data: rows });
          marksWritten += rows.length;
        }
      }

      sectionsDone += 1;
      console.log(`  ✓ ${csId} (${enrollments.length} students × ${dates.length} days)`);
    }
  }

  console.log('\nDone.');
  console.log(`  Sections seeded: ${sectionsDone}`);
  console.log(`  Empty sections skipped: ${emptySections}`);
  console.log(`  Attendance headers: ${headersUpserted}`);
  console.log(`  Non-present marks written: ${marksWritten}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
