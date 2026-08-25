import { prisma } from './prisma.js';
import { getRequestTenant } from './tenantContext.js';

/** Per-tenant DDL once per process (apex + each school DB). */
const ensuredSlugs = new Set();

/**
 * Parent–principal meeting tracker + student attendance notes.
 * Must run on the *request* tenant DB — startup only covers apex.
 */
export async function ensureAttendanceIntelligenceTables() {
  const slug = getRequestTenant() || 'apex';
  if (ensuredSlugs.has(slug)) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblAttendance_Meetings" (
      "Meeting_id"       VARCHAR(50) PRIMARY KEY,
      "student_class_id" VARCHAR(50) NOT NULL,
      "Student_id"       VARCHAR(50),
      "Parent_Name"      VARCHAR(255),
      "Reason"           VARCHAR(255) NOT NULL,
      "Meeting_Date"     DATE NOT NULL,
      "Staff_Name"       VARCHAR(255),
      "Staff_User_id"    VARCHAR(50),
      "Discussion_Notes" TEXT,
      "Outcome"          TEXT,
      "Follow_Up_Date"   DATE,
      "Status"           VARCHAR(40) NOT NULL DEFAULT 'Requested',
      "Created_By"       VARCHAR(50),
      "Created_On"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "Updated_On"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblAttendance_Meetings_student_idx"
      ON "tblAttendance_Meetings" ("student_class_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblAttendance_Meetings_status_idx"
      ON "tblAttendance_Meetings" ("Status")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblAttendance_Meetings_followup_idx"
      ON "tblAttendance_Meetings" ("Follow_Up_Date")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblAttendance_Notes" (
      "Note_id"          VARCHAR(50) PRIMARY KEY,
      "student_class_id" VARCHAR(50) NOT NULL,
      "Note_Text"        TEXT NOT NULL,
      "Created_By"       VARCHAR(50),
      "Created_By_Name"  VARCHAR(255),
      "Created_On"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblAttendance_Notes_student_idx"
      ON "tblAttendance_Notes" ("student_class_id")
  `);

  ensuredSlugs.add(slug);
}
