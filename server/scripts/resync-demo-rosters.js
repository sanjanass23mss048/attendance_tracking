/**
 * Rebuild demo student rosters in an existing DB (40 unique students per section).
 * Idempotent upsert by SC-{grade}{section}-{roll} ids. Removes enrollments above roll 40.
 *
 * Usage: node scripts/resync-demo-rosters.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
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

async function main() {
  const sections = await prisma.tblClass_Section.findMany({
    where: { int_status: { not: 0 } },
    orderBy: { Class_Section_id: 'asc' },
  });

  let upserted = 0;
  let removed = 0;

  for (const section of sections) {
    const match = /^CS-(\d+)-([A-Z])$/.exec(section.Class_Section_id);
    if (!match) continue;
    const [, className, sectionName] = match;
    const csId = section.Class_Section_id;
    const roster = generateSectionRoster(className, sectionName);

    for (const s of roster) {
      const { first, last } = splitFullName(s.name);
      const profile = studentDemoProfile(className, sectionName, s.rollNo, s.name);
      const { studentId, studentClassId } = dbStudentIds(className, sectionName, s.rollNo);

      await prisma.tblStudents.upsert({
        where: { Student_id: studentId },
        create: {
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
        update: {
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

      await prisma.tblStudent_Class.upsert({
        where: { student_class_id: studentClassId },
        create: {
          student_class_id: studentClassId,
          Student_id: studentId,
          class_section_id: csId,
          Roll_No: String(s.rollNo),
          Academic_Year: '2025-26',
          Int_Status: 1,
        },
        update: {
          Student_id: studentId,
          class_section_id: csId,
          Roll_No: String(s.rollNo),
          Academic_Year: '2025-26',
          Int_Status: 1,
        },
      });
      upserted += 1;
    }

    const stale = await prisma.tblStudent_Class.findMany({
      where: {
        class_section_id: csId,
        Roll_No: { notIn: roster.map((r) => String(r.rollNo)) },
      },
    });
    for (const row of stale) {
      await prisma.tblStudent_Class.delete({ where: { student_class_id: row.student_class_id } });
      removed += 1;
    }
  }

  console.log(
    `Resync complete: ${upserted} enrollments upserted (${STUDENTS_PER_SECTION} per section), ${removed} stale enrollments removed`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
