/**
 * Memory-safe seed for empty (or very low) class-sections.
 * Uses createMany per section. Safe to re-run.
 *
 * Usage: DATABASE_URL=... node scripts/seedMissingStudentsBatched.js
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
import { SCHOOL_GRADES, SCHOOL_SECTIONS } from '../../src/data/schoolGrades.js';

const MIN_STUDENTS = Number(process.env.SEED_MIN_STUDENTS || 15);
const prisma = new PrismaClient();

function dateUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function main() {
  console.log(`Seeding sections with fewer than ${MIN_STUDENTS} students (target ${STUDENTS_PER_SECTION})…`);
  let sectionsFilled = 0;
  let studentsCreated = 0;

  for (const className of SCHOOL_GRADES) {
    for (const sectionName of SCHOOL_SECTIONS) {
      const csId = `CS-${className}-${sectionName}`;
      const link = await prisma.tblClass_Section.findUnique({
        where: { Class_Section_id: csId },
      });
      if (!link) {
        console.warn(`Missing class-section ${csId} — run ensureSchoolGrades first`);
        continue;
      }

      const existing = await prisma.tblStudent_Class.count({
        where: { class_section_id: csId, Int_Status: { not: 0 } },
      });
      if (existing >= MIN_STUDENTS) {
        console.log(`Skip ${csId} (already has ${existing} students)`);
        continue;
      }

      const roster = generateSectionRoster(className, sectionName);
      const studentRows = [];
      const enrollRows = [];

      for (const s of roster) {
        const { first, last } = splitFullName(s.name);
        const profile = studentDemoProfile(className, sectionName, s.rollNo, s.name);
        const { studentId, studentClassId: scId } = dbStudentIds(className, sectionName, s.rollNo);

        studentRows.push({
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
        });

        enrollRows.push({
          student_class_id: scId,
          Student_id: studentId,
          class_section_id: csId,
          Roll_No: String(s.rollNo),
          Academic_Year: '2025-26',
          Int_Status: 1,
        });
      }

      const created = await prisma.tblStudents.createMany({
        data: studentRows,
        skipDuplicates: true,
      });
      await prisma.tblStudent_Class.createMany({
        data: enrollRows,
        skipDuplicates: true,
      });

      studentsCreated += created.count;
      sectionsFilled += 1;
      console.log(`Filled ${csId} (had ${existing}, +${created.count} student rows)`);
    }
  }

  const total = await prisma.tblStudents.count();
  console.log(`Done. Sections touched: ${sectionsFilled}. New student rows: ${studentsCreated}. Total students: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
