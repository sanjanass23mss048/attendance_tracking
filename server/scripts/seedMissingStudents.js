/**
 * Seed demo students into class-sections that currently have none.
 * Covers LKG, UKG, and Classes 1–12 × A/B/C.
 *
 * Usage: node scripts/seedMissingStudents.js
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

const prisma = new PrismaClient();

function dateUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function main() {
  console.log('Seeding missing students for empty class-sections…');
  let sectionsFilled = 0;
  let studentsCreated = 0;

  for (const className of SCHOOL_GRADES) {
    for (const sectionName of SCHOOL_SECTIONS) {
      const csId = `CS-${className}-${sectionName}`;
      const link = await prisma.tblClass_Section.findUnique({
        where: { Class_Section_id: csId },
      });
      if (!link) {
        console.warn(`Missing class-section ${csId} — run npm run db:ensure-grades first`);
        continue;
      }

      const existing = await prisma.tblStudent_Class.count({
        where: { class_section_id: csId, Int_Status: { not: 0 } },
      });
      if (existing > 0) {
        console.log(`Skip ${csId} (already has ${existing} students)`);
        continue;
      }

      const roster = generateSectionRoster(className, sectionName);
      for (const s of roster) {
        const { first, last } = splitFullName(s.name);
        const profile = studentDemoProfile(className, sectionName, s.rollNo, s.name);
        const { studentId, studentClassId: scId } = dbStudentIds(className, sectionName, s.rollNo);

        const already = await prisma.tblStudents.findUnique({ where: { Student_id: studentId } });
        if (!already) {
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
          studentsCreated += 1;
        }

        const enroll = await prisma.tblStudent_Class.findUnique({
          where: { student_class_id: scId },
        });
        if (!enroll) {
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

      sectionsFilled += 1;
      console.log(`Filled ${csId} with ${STUDENTS_PER_SECTION} students`);
    }
  }

  console.log(
    `Done. Sections filled: ${sectionsFilled}. New student rows: ${studentsCreated}. Total students: ${await prisma.tblStudents.count()}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
