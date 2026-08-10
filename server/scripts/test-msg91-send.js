import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { sendSms, parentContactsForEnrollments, isSmsConfigured } from '../src/lib/sms.js';

console.log('configured', isSmsConfigured(), 'provider', process.env.SMS_PROVIDER);

const SECTION = 'CS-1-A';
const PHONES = ['8072180274', '6374111979', '8610593702', '8508223156'];

const enrollments = await prisma.tblStudent_Class.findMany({
  where: { class_section_id: SECTION, Int_Status: { not: 0 } },
  include: { tblStudents: true },
  orderBy: { Roll_No: 'asc' },
});

const targets = enrollments.filter((e) =>
  PHONES.includes(String(e.tblStudents?.Father_Number || ''))
);

console.log('targets', targets.length);
const contacts = await parentContactsForEnrollments(
  targets.map((t) => t.student_class_id),
  prisma
);

for (const t of targets) {
  const c = contacts.get(t.student_class_id);
  const result = await sendSms({
    to: c.phone,
    body: `Test: ${c.name} marked Absent on 2026-08-06. - Bright Future`,
    vars: {
      studentName: c.name,
      rollNo: String(c.rollNo || t.Roll_No || '-'),
      date: '06 Aug 2026',
    },
  });
  console.log(JSON.stringify({ roll: t.Roll_No, phone: c.phone, result }, null, 2));
}

await prisma.$disconnect();
