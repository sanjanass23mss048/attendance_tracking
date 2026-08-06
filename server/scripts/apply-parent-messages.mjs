import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(
  __dirname,
  '../prisma/migrations/20260804120000_parent_attendance_messages/migration.sql'
);
const sql = fs.readFileSync(sqlPath, 'utf8');
const statements = sql
  .split(';')
  .map((s) =>
    s
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim()
  )
  .filter(Boolean);

const p = new PrismaClient();
for (const stmt of statements) {
  await p.$executeRawUnsafe(stmt);
  console.log('ok:', stmt.slice(0, 60).replace(/\s+/g, ' '), '...');
}
const n = await p.tblParent_Attendance_Messages.count();
console.log('tblParent_Attendance_Messages ready, count=', n);
await p.$disconnect();
