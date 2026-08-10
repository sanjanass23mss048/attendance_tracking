import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const rows = await prisma.tblStudents.findMany({
  take: 10,
  select: {
    Student_id: true,
    First_Name: true,
    Last_Name: true,
    Father_Number: true,
    Mother_Number: true,
  },
  orderBy: { First_Name: 'asc' },
});

const total = await prisma.tblStudents.count();
const withPhone = await prisma.tblStudents.count({
  where: {
    OR: [
      { Father_Number: { not: null } },
      { Mother_Number: { not: null } },
      { Guardian_Number: { not: null } },
    ],
  },
});

console.log('total', total, 'withAnyParentPhone', withPhone);
for (const r of rows) {
  console.log(
    `${r.First_Name} ${r.Last_Name} | father=${r.Father_Number || '-'} | mother=${r.Mother_Number || '-'}`
  );
}

await prisma.$disconnect();
