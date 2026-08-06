import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const users = await p.tblUsers.findMany({
  where: { int_status: { not: 0 } },
  select: { user_id: true, name: true, email: true, phone: true, role_id: true },
  orderBy: { name: 'asc' },
  take: 30,
});
console.log('=== USERS ===');
for (const u of users) {
  console.log(`${u.user_id} | ${u.name} | ${u.email} | role=${u.role_id} | phone=${u.phone || '-'}`);
}

const sections = await p.tblClass_Section.findMany({
  where: { int_status: 1 },
  include: { tblClass: true, tblSection: true },
  take: 20,
});
console.log('\n=== CLASS SECTIONS (sample) ===');
for (const s of sections.sort((a, b) => String(a.Class_Section_id).localeCompare(String(b.Class_Section_id)))) {
  console.log(
    `${s.Class_Section_id} | ${s.tblClass?.Class_Name}-${s.tblSection?.Section_Name}`
  );
}

const approvers = await p.tblClass_Section_Approver.findMany({ take: 20 });
console.log('\n=== EXISTING APPROVERS ===');
if (!approvers.length) console.log('(none yet)');
for (const a of approvers) {
  console.log(`${a.Class_Section_id} → user=${a.Approver_User_id} phone=${a.WhatsApp_Phone || '-'}`);
}

await p.$disconnect();
