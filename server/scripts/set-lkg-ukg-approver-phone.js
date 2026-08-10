import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const PHONE = '9677898085';

const existing = await prisma.tblClass_Section_Approver.findMany({
  where: {
    OR: [
      { Class_Section_id: { startsWith: 'CS-LKG-' } },
      { Class_Section_id: { startsWith: 'CS-UKG-' } },
    ],
  },
  orderBy: { Class_Section_id: 'asc' },
});

console.log('Before:', existing.map((r) => `${r.Class_Section_id} → ${r.WhatsApp_Phone || '-'} / user=${r.Approver_User_id}`));

if (!existing.length) {
  // Create approver rows if missing — reuse incharge or first existing approver user
  const template = await prisma.tblClass_Section_Approver.findFirst({
    where: { Int_Status: { not: 0 } },
  });
  const incharge = await prisma.tblUsers.findFirst({
    where: { OR: [{ user_id: 'USR-INCHARGE' }, { email: 'incharge@brightfuture.edu.in' }] },
  });
  const approverUserId = template?.Approver_User_id || incharge?.user_id;
  if (!approverUserId) {
    console.error('No approver user found to assign. Seed approvers first.');
    process.exit(1);
  }

  const sections = await prisma.tblClass_Section.findMany({
    where: {
      OR: [
        { Class_Section_id: { startsWith: 'CS-LKG-' } },
        { Class_Section_id: { startsWith: 'CS-UKG-' } },
      ],
      int_status: 1,
    },
  });

  for (const sec of sections) {
    await prisma.tblClass_Section_Approver.upsert({
      where: { Class_Section_id: sec.Class_Section_id },
      create: {
        Class_Section_id: sec.Class_Section_id,
        Approver_User_id: approverUserId,
        WhatsApp_Phone: PHONE,
        Int_Status: 1,
      },
      update: {
        WhatsApp_Phone: PHONE,
        Int_Status: 1,
      },
    });
    console.log(`Upserted ${sec.Class_Section_id} → ${PHONE}`);
  }
} else {
  const result = await prisma.tblClass_Section_Approver.updateMany({
    where: {
      OR: [
        { Class_Section_id: { startsWith: 'CS-LKG-' } },
        { Class_Section_id: { startsWith: 'CS-UKG-' } },
      ],
    },
    data: { WhatsApp_Phone: PHONE },
  });
  console.log(`Updated ${result.count} LKG/UKG approver rows → ${PHONE}`);
}

const after = await prisma.tblClass_Section_Approver.findMany({
  where: {
    OR: [
      { Class_Section_id: { startsWith: 'CS-LKG-' } },
      { Class_Section_id: { startsWith: 'CS-UKG-' } },
    ],
  },
  orderBy: { Class_Section_id: 'asc' },
});
console.log('After:', after.map((r) => `${r.Class_Section_id} → ${r.WhatsApp_Phone}`));

await prisma.$disconnect();
