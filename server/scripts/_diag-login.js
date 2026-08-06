import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';
import { serializeUser } from '../src/services/schoolRepo.js';
import { signToken } from '../src/middleware/auth.js';

try {
  const email = 'incharge@brightfuture.edu.in';
  const password = 'password123';
  const user = await prisma.tblUsers.findUnique({
    where: { email: email.toLowerCase() },
    include: { tblRoles: true },
  });
  console.log('user:', user ? { id: user.user_id, email: user.email, role: user.role_id, hasRole: Boolean(user.tblRoles) } : null);
  const ok = await bcrypt.compare(password, user.password);
  console.log('bcrypt ok:', ok);
  const publicUser = serializeUser(user);
  console.log('publicUser:', publicUser);
  const token = signToken({
    id: publicUser.id,
    email: publicUser.email,
    name: publicUser.name,
    role: publicUser.role,
  });
  console.log('token length:', token.length);
} catch (e) {
  console.error('LOGIN_PATH_ERROR:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
