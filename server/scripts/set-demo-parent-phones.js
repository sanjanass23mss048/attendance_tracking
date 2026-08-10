/**
 * Assign the three demo parent mobiles to every student (cycles by roll).
 *
 * Usage: node scripts/set-demo-parent-phones.js
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { DEMO_PARENT_PHONES } from '../../src/data/studentRoster.js';

const phones = DEMO_PARENT_PHONES.map((p) => String(p).replace(/\D/g, '')).filter(Boolean);

async function main() {
  console.log(`Assigning parent phones (${phones.join(', ')}) to all students…`);

  const enrollments = await prisma.tblStudent_Class.findMany({
    where: { Int_Status: { not: 0 } },
    select: {
      Student_id: true,
      Roll_No: true,
      class_section_id: true,
    },
    orderBy: [{ class_section_id: 'asc' }, { Roll_No: 'asc' }],
  });

  const byStudent = new Map();
  for (const row of enrollments) {
    if (!byStudent.has(row.Student_id)) {
      byStudent.set(row.Student_id, row);
    }
  }

  let updated = 0;
  let i = 0;
  for (const [studentId, row] of byStudent) {
    const roll = Number(row.Roll_No) || i + 1;
    const phone = phones[(Math.max(1, roll) - 1) % phones.length];
    await prisma.tblStudents.update({
      where: { Student_id: studentId },
      data: {
        Father_Number: phone,
        Mother_Number: phone,
        Guardian_Number: phone,
      },
    });
    updated += 1;
    i += 1;
  }

  console.log(`Updated ${updated} students across all classes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
