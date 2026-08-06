import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const url = process.env.DATABASE_URL || '';
const redacted = url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
console.log('DATABASE_URL (redacted):', redacted);
console.log('JWT_SECRET set:', Boolean(process.env.JWT_SECRET));

try {
  const n = await prisma.tblUsers.count();
  console.log('tblUsers.count:', n);
  const u = await prisma.tblUsers.findUnique({
    where: { email: 'incharge@brightfuture.edu.in' },
    include: { tblRoles: true },
  });
  console.log('incharge found:', Boolean(u), 'role_id:', u?.role_id, 'status:', u?.int_status);
} catch (e) {
  console.error('PRISMA_ERROR:', e.message);
  console.error('CODE:', e.code);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
