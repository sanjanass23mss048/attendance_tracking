import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

/** @deprecated Prefer `npm run db:set-parent-phones` (all classes). */
const PHONES = ['8072180274', '8610593702', '9677898085'];
const SECTION_ID = process.argv[2] || 'CS-2-A';

const enrollments = await prisma.tblStudent_Class.findMany({
  where: { class_section_id: SECTION_ID, Int_Status: { not: 0 } },
  include: { tblStudents: true },
  orderBy: { Roll_No: 'asc' },
});

if (!enrollments.length) {
  console.error(`No students in ${SECTION_ID}`);
  process.exit(1);
}

for (let i = 0; i < enrollments.length; i += 1) {
  const row = enrollments[i];
  const phone = PHONES[i % PHONES.length];
  await prisma.tblStudents.update({
    where: { Student_id: row.Student_id },
    data: { Father_Number: phone, Mother_Number: phone, Guardian_Number: phone },
  });
  const name = [row.tblStudents?.First_Name, row.tblStudents?.Last_Name].filter(Boolean).join(' ');
  console.log(`Roll ${row.Roll_No} ${name} → ${phone}`);
}

await prisma.$disconnect();
console.log(`Done for ${SECTION_ID}. Prefer: npm run db:set-parent-phones for all classes.`);
