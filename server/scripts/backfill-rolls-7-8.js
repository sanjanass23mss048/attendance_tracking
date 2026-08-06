/**
 * Backfill rolls 7–8 for demo sections that were seeded with only 6 students
 * (legacy seed used A=8, B/C=6). Idempotent: skips existing student_class_ids.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXTRA_NAMES = [
  'Rohit Kapoor',
  'Sneha Reddy',
  'Aditya Menon',
  'Kavya Pillai',
  'Nikhil Banerjee',
  'Tanya Saxena',
  'Harsh Aggarwal',
  'Priya Krishnan',
];

const GENDERS = ['Male', 'Female', 'Male', 'Female', 'Other'];

function dateUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(' ') || null };
}

async function main() {
  const sections = await prisma.tblClass_Section.findMany({
    where: { int_status: { not: 0 } },
    orderBy: { Class_Section_id: 'asc' },
  });

  let created = 0;
  let skipped = 0;

  for (const section of sections) {
    const csId = section.Class_Section_id;
    // CS-1-A, CS-2-B, …
    const match = /^CS-(\d+)-([A-Z])$/.exec(csId);
    if (!match) continue;
    const [, className, sectionName] = match;

    // Class 1-A already has the full 20-student mock roster.
    if (className === '1' && sectionName === 'A') continue;

    for (const rollNo of [7, 8]) {
      const i = rollNo - 1;
      const name = EXTRA_NAMES[i % EXTRA_NAMES.length];
      const { first, last } = splitName(name);
      const studentId = `STU-${className}${sectionName}-${rollNo}`;
      const scId = `SC-${className}${sectionName}-${rollNo}`;

      const existing = await prisma.tblStudent_Class.findUnique({
        where: { student_class_id: scId },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const year = 2014 + (i % 6);
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 27) + 1).padStart(2, '0');

      await prisma.tblStudents.upsert({
        where: { Student_id: studentId },
        create: {
          Student_id: studentId,
          Admission_No: `ADM${className}${sectionName}${String(rollNo).padStart(3, '0')}`,
          Roll_No: String(rollNo),
          First_Name: first,
          Last_Name: last,
          Gender: GENDERS[i % GENDERS.length],
          DOB: dateUTC(`${year}-${month}-${day}`),
          Father_Name: last ? `Mr. ${last}` : null,
          Mother_Name: last ? `Mrs. ${last}` : null,
          Father_Number: `98765${String(10000 + i).slice(-5)}`,
          Address_Line_1: `${10 + i}, Green Park, Pune`,
          Country: 'Indian',
          Int_Status: 1,
        },
        update: { Int_Status: 1 },
      });

      await prisma.tblStudent_Class.create({
        data: {
          student_class_id: scId,
          Student_id: studentId,
          class_section_id: csId,
          Roll_No: String(rollNo),
          Academic_Year: '2025-26',
          Int_Status: 1,
        },
      });
      created += 1;
      console.log(`Added ${scId} → ${csId}`);
    }
  }

  console.log(`Done. created=${created} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
