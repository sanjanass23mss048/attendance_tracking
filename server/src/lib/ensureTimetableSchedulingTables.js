import { prisma } from './prisma.js';
import { getRequestTenant } from './tenantContext.js';
import { newId } from './ids.js';

/** Per-tenant DDL once per process. */
const ensuredSlugs = new Set();

const DEFAULT_SUBJECTS = [
  'English',
  'Maths',
  'EVS',
  'Hindi',
  'Computer',
  'Drawing',
  'Games',
  'Library',
  'Science',
  'Social',
];

/**
 * Teacher–subject mappings + school-wide timetable period settings.
 * Prefer ensure-DDL (same pattern as TC / attendance intelligence).
 */
export async function ensureTimetableSchedulingTables() {
  const slug = getRequestTenant() || 'apex';
  if (ensuredSlugs.has(slug)) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblTeacher_Subjects" (
      "Teacher_Subject_id" VARCHAR(50) NOT NULL,
      "Teacher_id"         VARCHAR(50) NOT NULL,
      "Subject_id"         VARCHAR(50) NOT NULL,
      "Academic_Year"      VARCHAR(50),
      "Int_Status"         INTEGER DEFAULT 1,
      "Created_On"         TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "tblTeacher_Subjects_pkey" PRIMARY KEY ("Teacher_Subject_id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "tblTeacher_Subjects_teacher_subject_uidx"
      ON "tblTeacher_Subjects" ("Teacher_id", "Subject_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTeacher_Subjects_teacher_idx"
      ON "tblTeacher_Subjects" ("Teacher_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTeacher_Subjects_subject_idx"
      ON "tblTeacher_Subjects" ("Subject_id")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblTimetable_Settings" (
      "Settings_id"   VARCHAR(50) NOT NULL,
      "Settings_Json" JSONB NOT NULL,
      "Updated_On"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "Updated_By"    VARCHAR(50),
      CONSTRAINT "tblTimetable_Settings_pkey" PRIMARY KEY ("Settings_id")
    )
  `);

  await seedDefaultSubjectsIfEmpty();
  ensuredSlugs.add(slug);
}

async function seedDefaultSubjectsIfEmpty() {
  try {
    const count = await prisma.tblSubjects.count();
    if (count > 0) return;
    await prisma.tblSubjects.createMany({
      data: DEFAULT_SUBJECTS.map((name) => ({
        Subject_id: newId('SUB'),
        Text: name,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.warn('seedDefaultSubjectsIfEmpty', err?.message || err);
  }
}
