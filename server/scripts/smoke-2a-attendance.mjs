/**
 * Smoke: CS-2-A daily save must persist full roster (default P included).
 * Simulates: leave all Present except 1 Absent, then PUT.
 * Usage: node scripts/smoke-2a-attendance.mjs
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const base = process.env.API_BASE || 'http://localhost:4000';
const prisma = new PrismaClient();

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(`${opts.method || 'GET'} ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

const login = await req('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'incharge@brightfuture.edu.in',
    password: 'password123',
  }),
});
const auth = { Authorization: `Bearer ${login.token}` };

const sectionId = 'CS-2-A';
const date = '2026-05-08';
const attId = `ATT-${date.replace(/-/g, '')}-${sectionId}`;

const enrollCount = await prisma.tblStudent_Class.count({
  where: { class_section_id: sectionId, Int_Status: { not: 0 } },
});
console.log('ENROLLMENT_CS_2_A', enrollCount);

const roster = await req(`/api/students?sectionId=${encodeURIComponent(sectionId)}`, {
  headers: auth,
});
if (roster.students.length !== enrollCount) {
  throw new Error(
    `Roster/API mismatch: loaded ${roster.students.length} vs enroll ${enrollCount}`
  );
}

await prisma.tblStudentAtt_list.deleteMany({ where: { Attendance_id: attId } });

// Full roster: all default P except first Absent (as UI Submit would send)
const marks = roster.students.map((s, i) => ({
  studentId: String(s.id),
  status: i === 0 ? 'A' : 'P',
}));
console.log('SENDING_MARKS', marks.length);

const saved = await req('/api/attendance/daily', {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({ sectionId, date, marks }),
});
console.log('SAVE_DAILY', saved);

if (saved.updated !== enrollCount) {
  throw new Error(`Expected updated=${enrollCount}, got ${saved.updated}`);
}

const rows = await prisma.tblStudentAtt_list.findMany({
  where: { Attendance_id: attId, OR: [{ Session: 'D' }, { Session: null }] },
  select: { student_class_id: true, Status_id: true },
  orderBy: { student_class_id: 'asc' },
});
console.log(
  'TBL_ROWS',
  rows.length,
  rows.map((r) => `${r.student_class_id}:${r.Status_id}`)
);

if (rows.length !== enrollCount) {
  throw new Error(`Expected ${enrollCount} att rows, got ${rows.length}`);
}

const present = rows.filter((r) => r.Status_id === 'P').length;
const absent = rows.filter((r) => r.Status_id === 'A').length;
if (absent !== 1 || present !== enrollCount - 1) {
  throw new Error(`Expected 1 A + ${enrollCount - 1} P, got A=${absent} P=${present}`);
}

await prisma.$disconnect();
console.log('SMOKE_2A_OK');
