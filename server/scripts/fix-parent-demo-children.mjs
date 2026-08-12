/**
 * Parent demo: Aarav (1-A / S1) + one Class 11 student. Removes Class 2-A sibling.
 * Run: node server/scripts/fix-parent-demo-children.mjs
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { newId } from '../src/lib/ids.js';

const PARENT_EMAIL = 'parent@brightfuture.edu.in';
const KEEP_STUDENT_ID = 'STU-1A-1'; // Aarav Sharma — Class 1-A

const parent = await prisma.tblUsers.findFirst({
  where: { email: PARENT_EMAIL, int_status: { not: 0 } },
});
if (!parent) {
  console.error('Parent not found:', PARENT_EMAIL);
  process.exit(1);
}

// Deactivate every link except Aarav
const allLinks = await prisma.tblParent_Student.findMany({
  where: { user_id: parent.user_id, Int_Status: { not: 0 } },
});
for (const link of allLinks) {
  if (link.Student_id !== KEEP_STUDENT_ID) {
    await prisma.tblParent_Student.update({
      where: { Link_id: link.Link_id },
      data: { Int_Status: 0 },
    });
    console.log('Removed link for', link.Student_id);
  }
}

// Ensure Aarav link is active
const aaravLink = await prisma.tblParent_Student.findFirst({
  where: { user_id: parent.user_id, Student_id: KEEP_STUDENT_ID },
});
if (!aaravLink) {
  await prisma.tblParent_Student.create({
    data: {
      Link_id: newId('PS'),
      user_id: parent.user_id,
      Student_id: KEEP_STUDENT_ID,
      Int_Status: 1,
    },
  });
  console.log('Created Aarav link');
} else if (aaravLink.Int_Status === 0) {
  await prisma.tblParent_Student.update({
    where: { Link_id: aaravLink.Link_id },
    data: { Int_Status: 1 },
  });
  console.log('Reactivated Aarav link');
}

// Pick first Class 11 student (any section)
const class11Sections = await prisma.tblClass_Section.findMany({
  where: {
    int_status: 1,
    tblClass: { Class_Name: { in: ['11', 'Class 11', 'XI'] } },
  },
  include: { tblClass: true, tblSection: true },
});

let sectionIds = class11Sections.map((s) => s.Class_Section_id);
if (!sectionIds.length) {
  // Fallback: id prefix CS-11
  const byId = await prisma.tblClass_Section.findMany({
    where: { Class_Section_id: { startsWith: 'CS-11' }, int_status: 1 },
    include: { tblClass: true, tblSection: true },
  });
  sectionIds = byId.map((s) => s.Class_Section_id);
  console.log(
    'Class 11 via id prefix:',
    byId.map((s) => `${s.Class_Section_id} ${s.tblClass?.Class_Name}-${s.tblSection?.Section_Name}`)
  );
} else {
  console.log(
    'Class 11 sections:',
    class11Sections.map((s) => `${s.Class_Section_id} ${s.tblClass?.Class_Name}-${s.tblSection?.Section_Name}`)
  );
}

if (!sectionIds.length) {
  console.error('No Class 11 sections found');
  process.exit(1);
}

const pick = await prisma.tblStudent_Class.findFirst({
  where: {
    class_section_id: { in: sectionIds },
    Int_Status: { not: 0 },
    Student_id: { not: KEEP_STUDENT_ID },
  },
  include: {
    tblStudents: true,
    tblClass_Section: { include: { tblClass: true, tblSection: true } },
  },
  orderBy: [{ class_section_id: 'asc' }, { Roll_No: 'asc' }],
});

if (!pick) {
  console.error('No student found in Class 11');
  process.exit(1);
}

const existing11 = await prisma.tblParent_Student.findFirst({
  where: { user_id: parent.user_id, Student_id: pick.Student_id },
});

if (!existing11) {
  await prisma.tblParent_Student.create({
    data: {
      Link_id: newId('PS'),
      user_id: parent.user_id,
      Student_id: pick.Student_id,
      Int_Status: 1,
    },
  });
} else if (existing11.Int_Status === 0) {
  await prisma.tblParent_Student.update({
    where: { Link_id: existing11.Link_id },
    data: { Int_Status: 1 },
  });
}

const cls = pick.tblClass_Section?.tblClass?.Class_Name;
const sec = pick.tblClass_Section?.tblSection?.Section_Name;
console.log(
  'Linked',
  [pick.tblStudents?.First_Name, pick.tblStudents?.Last_Name].filter(Boolean).join(' '),
  pick.Student_id,
  `Class ${cls}-${sec}`,
  pick.student_class_id
);

const finalLinks = await prisma.tblParent_Student.findMany({
  where: { user_id: parent.user_id, Int_Status: { not: 0 } },
  include: {
    tblStudents: {
      include: {
        tblStudent_Class: {
          where: { Int_Status: { not: 0 } },
          include: {
            tblClass_Section: { include: { tblClass: true, tblSection: true } },
          },
        },
      },
    },
  },
});

for (const l of finalLinks) {
  const st = l.tblStudents;
  const sc = st?.tblStudent_Class?.[0];
  const c = sc?.tblClass_Section?.tblClass?.Class_Name;
  const s = sc?.tblClass_Section?.tblSection?.Section_Name;
  console.log({
    name: [st?.First_Name, st?.Last_Name].filter(Boolean).join(' '),
    class: `Class ${c}-${s}`,
    studentClassId: sc?.student_class_id,
  });
}

await prisma.$disconnect();
