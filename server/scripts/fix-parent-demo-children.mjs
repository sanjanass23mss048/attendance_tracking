/**
 * Demo parent: Aarav (1-A) + one student from Class 2-A. Removes Isha Gupta link.
 * Run: node server/scripts/fix-parent-demo-children.mjs
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { newId } from '../src/lib/ids.js';

const PARENT_EMAIL = 'parent@brightfuture.edu.in';
const KEEP_STUDENT_ID = 'STU-1A-1'; // Aarav
const REMOVE_STUDENT_ID = 'STU-1A-10'; // Isha Gupta
const CLASS_2A_SECTION = 'CS-2-A';

const parent = await prisma.tblUsers.findFirst({
  where: { email: PARENT_EMAIL, int_status: { not: 0 } },
});
if (!parent) {
  console.error('Parent not found:', PARENT_EMAIL);
  process.exit(1);
}

// Deactivate Isha link
await prisma.tblParent_Student.updateMany({
  where: { user_id: parent.user_id, Student_id: REMOVE_STUDENT_ID },
  data: { Int_Status: 0 },
});
console.log('Removed link for', REMOVE_STUDENT_ID);

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

// Pick first student in Class 2-A (not already linked)
const pick = await prisma.tblStudent_Class.findFirst({
  where: {
    class_section_id: CLASS_2A_SECTION,
    Int_Status: { not: 0 },
    Student_id: { not: KEEP_STUDENT_ID },
  },
  include: { tblStudents: true },
  orderBy: { Roll_No: 'asc' },
});

if (!pick) {
  console.error('No student found in', CLASS_2A_SECTION);
  process.exit(1);
}

const existing2a = await prisma.tblParent_Student.findFirst({
  where: { user_id: parent.user_id, Student_id: pick.Student_id },
});

if (!existing2a) {
  await prisma.tblParent_Student.create({
    data: {
      Link_id: newId('PS'),
      user_id: parent.user_id,
      Student_id: pick.Student_id,
      Int_Status: 1,
    },
  });
  console.log(
    'Linked',
    [pick.tblStudents?.First_Name, pick.tblStudents?.Last_Name].filter(Boolean).join(' '),
    pick.Student_id,
    CLASS_2A_SECTION
  );
} else if (existing2a.Int_Status === 0) {
  await prisma.tblParent_Student.update({
    where: { Link_id: existing2a.Link_id },
    data: { Int_Status: 1 },
  });
  console.log('Reactivated 2-A student link', pick.Student_id);
} else {
  console.log('2-A student already linked', pick.Student_id);
}

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
  const cls = sc?.tblClass_Section?.tblClass?.Class_Name;
  const sec = sc?.tblClass_Section?.tblSection?.Section_Name;
  console.log({
    name: [st?.First_Name, st?.Last_Name].filter(Boolean).join(' '),
    class: `Class ${cls}-${sec}`,
    studentClassId: sc?.student_class_id,
  });
}

await prisma.$disconnect();
