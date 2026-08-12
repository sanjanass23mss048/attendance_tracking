/**
 * Upsert demo ADMIN login for Audit Logs showcase.
 * Password: password123
 *
 * Usage: node scripts/ensure-admin-user.mjs
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';

const EMAIL = 'admin@brightfuture.edu.in';
const USER_ID = 'USR-ADMIN';
const NAME = 'School Admin';
const PASSWORD = 'password123';

async function main() {
  await prisma.tblRoles.upsert({
    where: { Role_id: 'ADMIN' },
    create: { Role_id: 'ADMIN', Text: 'Admin' },
    update: { Text: 'Admin' },
  });

  const password = await bcrypt.hash(PASSWORD, 10);
  const existing = await prisma.tblUsers.findUnique({ where: { email: EMAIL } });

  if (!existing) {
    const idTaken = await prisma.tblUsers.findUnique({ where: { user_id: USER_ID } });
    await prisma.tblUsers.create({
      data: {
        user_id: idTaken ? `${USER_ID}-${Date.now().toString().slice(-6)}` : USER_ID,
        name: NAME,
        email: EMAIL,
        password,
        role_id: 'ADMIN',
        int_status: 1,
      },
    });
    console.log('Created admin user', EMAIL);
  } else {
    await prisma.tblUsers.update({
      where: { email: EMAIL },
      data: {
        name: NAME,
        password,
        role_id: 'ADMIN',
        int_status: 1,
      },
    });
    console.log('Updated admin user', EMAIL, existing.user_id);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
