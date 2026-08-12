/**
 * Ensure demo parent has 2 linked children so Switch Student is demoable.
 * Run from repo: node server/scripts/link-parent-siblings.mjs
 * Or in container: node scripts/link-parent-siblings.mjs (cwd /app/server)
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { newId } from '../src/lib/ids.js';

const PARENT_EMAIL = 'parent@brightfuture.edu.in';

const parent = await prisma.tblUsers.findFirst({
  where: { email: PARENT_EMAIL, int_status: 1 },
});
if (!parent) {
  console.error('Parent user not found:', PARENT_EMAIL);
  process.exit(1);
}

const existing = await prisma.tblParent_Student.findMany({
  where: { user_id: parent.user_id, Int_Status: { not: 0 } },
});
console.log(
  'existing links',
  existing.map((l) => l.Student_id)
);

const linked = new Set(existing.map((l) => l.Student_id));

async function pickStudent(preferClassName) {
  const rows = await prisma.tblStudent_Class.findMany({
    where: { Int_Status: { not: 0 } },
    include: {
      tblStudents: true,
      tblClass_Section: { include: { tblClass: true, tblSection: true } },
    },
    orderBy: [{ class_section_id: 'asc' }, { Roll_No: 'asc' }],
    take: 200,
  });
  const preferred = rows.find((r) => {
    if (linked.has(r.Student_id)) return false;
    const cn = r.tblClass_Section?.tblClass?.Class_Name?.toString() || '';
    return preferClassName ? cn.includes(preferClassName) : true;
  });
  return preferred || rows.find((r) => !linked.has(r.Student_id)) || null;
}

if (existing.length < 2) {
  const need = 2 - existing.length;
  for (let i = 0; i < need; i++) {
    const pick = await pickStudent(i === 0 && existing.length === 0 ? '1' : '3');
    if (!pick) {
      console.error('No available student to link');
      break;
    }
    const link = await prisma.tblParent_Student.create({
      data: {
        Link_id: newId('PS'),
        user_id: parent.user_id,
        Student_id: pick.Student_id,
        Int_Status: 1,
      },
    });
    linked.add(pick.Student_id);
    const name = [pick.tblStudents?.First_Name, pick.tblStudents?.Last_Name]
      .filter(Boolean)
      .join(' ');
    const cls = pick.tblClass_Section?.tblClass?.Class_Name;
    const sec = pick.tblClass_Section?.tblSection?.Section_Name;
    console.log('linked', link.Link_id, name, `Class ${cls} - ${sec}`, pick.Student_id);
  }
} else {
  console.log('already has', existing.length, 'children');
}

const finalLinks = await prisma.tblParent_Student.findMany({
  where: { user_id: parent.user_id, Int_Status: { not: 0 } },
  include: { tblStudents: true },
});
for (const l of finalLinks) {
  console.log({
    studentId: l.Student_id,
    name: [l.tblStudents?.First_Name, l.tblStudents?.Last_Name].filter(Boolean).join(' '),
  });
}

await prisma.$disconnect();
