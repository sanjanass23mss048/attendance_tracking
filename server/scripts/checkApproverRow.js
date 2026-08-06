import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rows = await prisma.tblClass_Section_Approver.findMany();
console.log(JSON.stringify(rows, null, 2));
const user = await prisma.tblUsers.findUnique({
  where: { user_id: 'USR-INCHARGE' },
  select: { user_id: true, name: true, phone: true },
});
console.log('Incharge user:', user);
await prisma.$disconnect();
