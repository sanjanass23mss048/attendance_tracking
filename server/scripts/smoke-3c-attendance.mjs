/**
 * Smoke: save full CS-3-C roster and verify tblStudentAtt_list row count.
 * Usage: node scripts/smoke-3c-attendance.mjs
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

const sectionId = 'CS-3-C';
const date = '2026-05-08';

const enrollCount = await prisma.tblStudent_Class.count({
  where: { class_section_id: sectionId, Int_Status: { not: 0 } },
});
console.log('ENROLLMENT_CS_3_C', enrollCount);

const roster = await req(`/api/students?sectionId=${encodeURIComponent(sectionId)}`, {
  headers: auth,
});
console.log('LOAD_STUDENTS', roster.students.length, roster.students.map((s) => s.id));

if (roster.students.length !== enrollCount) {
  throw new Error(
    `Roster/API mismatch: loaded ${roster.students.length} vs enroll ${enrollCount}`
  );
}

const attId = `ATT-${date.replace(/-/g, '')}-${sectionId}`;
// Wipe existing daily rows so we prove a partial PUT still creates the full roster
await prisma.tblStudentAtt_list.deleteMany({ where: { Attendance_id: attId } });
console.log('CLEARED_ATT_ROWS', attId);

// Partial payload on purpose — server must expand to full roster
const partialMarks = roster.students.slice(3).map((s, i) => ({
  studentId: s.id,
  status: i === 2 ? 'A' : 'P',
}));
console.log('SENDING_PARTIAL_MARKS', partialMarks.length);

const saved = await req('/api/attendance/daily', {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({ sectionId, date, marks: partialMarks }),
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

const loaded = await req(
  `/api/attendance/daily?date=${date}&sectionId=${encodeURIComponent(sectionId)}`,
  { headers: auth }
);
const withStatus = loaded.marks.filter((m) => m.status);
console.log('LOAD_DAILY_MARKED', withStatus.length);
if (withStatus.length !== enrollCount) {
  throw new Error(`Expected ${enrollCount} marked on GET, got ${withStatus.length}`);
}

await prisma.$disconnect();
console.log('SMOKE_3C_OK');
