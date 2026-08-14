import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { fullName } from '../src/lib/ids.js';
import { listChildrenForParent } from '../src/services/schoolRepo.js';

const links = await prisma.tblParent_Student.findMany({
  where: { Int_Status: { not: 0 } },
  include: {
    tblStudents: true,
    tblUsers: { select: { email: true, user_id: true, name: true } },
  },
  take: 20,
});

for (const l of links) {
  const st = l.tblStudents;
  console.log({
    parentEmail: l.tblUsers?.email,
    parentUserName: l.tblUsers?.name,
    Student_id: st?.Student_id,
    First_Name: st?.First_Name,
    Last_Name: st?.Last_Name,
    computed: fullName(st?.First_Name, st?.Last_Name) || 'Unknown',
    Father_Name: st?.Father_Name,
    Mother_Name: st?.Mother_Name,
  });
  if (l.tblUsers?.user_id) {
    const kids = await listChildrenForParent(l.tblUsers.user_id);
    console.log(
      'children API names:',
      kids.map((k) => ({ id: k.id, name: k.name, roll: k.rollNo }))
    );
  }
}

await prisma.$disconnect();
