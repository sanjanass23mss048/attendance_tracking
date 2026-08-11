import { prisma } from './src/lib/prisma.js';

const links = await prisma.tblParent_Student.findMany({
  where: { Int_Status: { not: 0 } },
  include: {
    tblUsers: { select: { email: true, name: true, user_id: true } },
    tblStudents: { select: { Student_id: true, First_Name: true, Last_Name: true } },
  },
});
console.log('parent_links', links.length);
for (const l of links) {
  console.log({
    email: l.tblUsers?.email,
    student: [l.tblStudents?.First_Name, l.tblStudents?.Last_Name].filter(Boolean).join(' '),
    studentId: l.Student_id,
  });
}

const recipients = await prisma.tblTeacher_Notification_Recipients.findMany({
  orderBy: { created_at: 'desc' },
  take: 10,
});
for (const r of recipients) {
  const sc = await prisma.tblStudent_Class.findUnique({
    where: { student_class_id: r.student_class_id },
    include: { tblStudents: { select: { Student_id: true, First_Name: true, Last_Name: true } } },
  });
  console.log({
    notif: r.notification_id,
    delivery: r.delivery_status,
    studentClassId: r.student_class_id,
    student: sc
      ? [sc.tblStudents?.First_Name, sc.tblStudents?.Last_Name].filter(Boolean).join(' ')
      : null,
    studentId: sc?.Student_id || sc?.tblStudents?.Student_id,
  });
}

await prisma.$disconnect();
