/**
 * Create a notice for Aarav (demo parent child) and push to linked parents.
 * Uses DATABASE_URL + FIREBASE_SERVICE_ACCOUNT from server/.env
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { createNotice } from '../src/services/noticeRepo.js';
import { notifyParentsOfNotice } from '../src/services/parentNotify.js';

async function main() {
  const enrollment = await prisma.tblStudent_Class.findFirst({
    where: {
      Int_Status: { not: 0 },
      OR: [
        { tblStudents: { First_Name: { equals: 'Aarav', mode: 'insensitive' } } },
        { class_section_id: 'CS-1-A', Roll_No: '1' },
      ],
    },
    include: { tblStudents: true },
    orderBy: { Roll_No: 'asc' },
  });

  if (!enrollment) {
    throw new Error('Could not find Aarav / Class 1-A student enrollment');
  }

  const name = [enrollment.tblStudents?.First_Name, enrollment.tblStudents?.Last_Name]
    .filter(Boolean)
    .join(' ');
  console.log('Target student:', name, enrollment.student_class_id, enrollment.class_section_id);

  const author =
    (await prisma.tblUsers.findFirst({ where: { role_id: 'INCHARGE', int_status: { not: 0 } } })) ||
    (await prisma.tblUsers.findFirst({ where: { int_status: { not: 0 } } }));
  if (!author) throw new Error('No staff user to attribute notice');

  const notice = await createNotice({
    title: 'Homework · Assignment',
    body:
      'Test notice for Aarav — please check the Notice Board. If push is configured you should also get a phone notification.',
    audienceType: 'STUDENTS',
    studentClassIds: [enrollment.student_class_id],
    createdBy: author.user_id,
  });
  console.log('Created notice', notice.id, notice.audienceLabel);

  const push = await notifyParentsOfNotice(notice, {
    audienceType: 'STUDENTS',
    studentClassIds: [enrollment.student_class_id],
  });
  console.log('Push result:', JSON.stringify(push, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
