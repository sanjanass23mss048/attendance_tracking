import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
await prisma.tblUsers.update({
  where: { user_id: 'USR-INCHARGE' },
  data: { phone: '918072180274' },
});
const u = await prisma.tblUsers.findUnique({
  where: { user_id: 'USR-INCHARGE' },
  select: { name: true, phone: true },
});
console.log('Updated:', u);
await prisma.$disconnect();
