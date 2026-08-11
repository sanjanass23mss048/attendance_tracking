import { createNotice } from './src/services/noticeRepo.js';
import { prisma } from './src/lib/prisma.js';

const user = await prisma.tblUsers.findFirst({
  where: { int_status: 1 },
  select: { user_id: true },
});
const sc = await prisma.tblStudent_Class.findFirst({
  where: { Int_Status: { not: 0 } },
  select: { student_class_id: true },
});
if (!user || !sc) {
  console.log('missing fixtures');
  process.exit(1);
}
try {
  const n = await createNotice({
    title: 'Mirror test',
    body: 'Parent board visibility check',
    audienceType: 'STUDENTS',
    studentClassIds: [sc.student_class_id],
    createdBy: user.user_id,
  });
  console.log('created', n.id, n.audienceType);
  await prisma.tblNotice_Targets.deleteMany({ where: { Notice_id: n.id } });
  await prisma.tblNotices.delete({ where: { Notice_id: n.id } });
  console.log('cleaned');
} catch (e) {
  console.error('CREATE_FAILED', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
