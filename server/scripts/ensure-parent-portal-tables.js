/**
 * Create parent-portal tables without dropping unrelated VPS tables
 * (e.g. tblStudent_Import_* which are not in schema.prisma).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "tblParent_Student" (
    "Link_id" VARCHAR(50) PRIMARY KEY,
    "user_id" VARCHAR(50) NOT NULL,
    "Student_id" VARCHAR(50) NOT NULL,
    "Int_Status" INTEGER DEFAULT 1,
    "Created_On" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tblParent_Student_user_id_Student_id_key" UNIQUE ("user_id", "Student_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "tblParent_Student_user_id_idx" ON "tblParent_Student"("user_id")`,
  `CREATE INDEX IF NOT EXISTS "tblParent_Student_Student_id_idx" ON "tblParent_Student"("Student_id")`,

  `CREATE TABLE IF NOT EXISTS "tblNotices" (
    "Notice_id" VARCHAR(50) PRIMARY KEY,
    "Title" VARCHAR(255),
    "Body" TEXT NOT NULL,
    "Audience_Type" VARCHAR(20) NOT NULL,
    "Attachment_Name" VARCHAR(255),
    "Attachment_Url" VARCHAR(500),
    "Created_By" VARCHAR(50) NOT NULL,
    "Created_On" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Int_Status" INTEGER DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS "tblNotices_Created_On_idx" ON "tblNotices"("Created_On")`,
  `CREATE INDEX IF NOT EXISTS "tblNotices_Audience_Type_idx" ON "tblNotices"("Audience_Type")`,

  `CREATE TABLE IF NOT EXISTS "tblNotice_Targets" (
    "Target_id" VARCHAR(50) PRIMARY KEY,
    "Notice_id" VARCHAR(50) NOT NULL,
    "Class_Section_id" VARCHAR(50),
    "Student_Class_id" VARCHAR(50)
  )`,
  `CREATE INDEX IF NOT EXISTS "tblNotice_Targets_Notice_id_idx" ON "tblNotice_Targets"("Notice_id")`,
  `CREATE INDEX IF NOT EXISTS "tblNotice_Targets_Class_Section_id_idx" ON "tblNotice_Targets"("Class_Section_id")`,
  `CREATE INDEX IF NOT EXISTS "tblNotice_Targets_Student_Class_id_idx" ON "tblNotice_Targets"("Student_Class_id")`,

  `CREATE TABLE IF NOT EXISTS "tblClass_Diary" (
    "Diary_id" VARCHAR(50) PRIMARY KEY,
    "Class_Section_id" VARCHAR(50) NOT NULL,
    "Entry_Date" DATE NOT NULL,
    "Title" VARCHAR(255) NOT NULL,
    "Body" TEXT NOT NULL,
    "Created_By" VARCHAR(50) NOT NULL,
    "Created_On" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Int_Status" INTEGER DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS "tblClass_Diary_Class_Section_id_Entry_Date_idx" ON "tblClass_Diary"("Class_Section_id", "Entry_Date")`,

  `CREATE TABLE IF NOT EXISTS "tblTimetable" (
    "Timetable_id" VARCHAR(50) PRIMARY KEY,
    "Class_Section_id" VARCHAR(50) NOT NULL,
    "Grid_Json" JSONB NOT NULL,
    "Updated_On" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tblTimetable_Class_Section_id_key" UNIQUE ("Class_Section_id")
  )`,

  `CREATE TABLE IF NOT EXISTS "tblDevice_Tokens" (
    "Token_id" VARCHAR(50) PRIMARY KEY,
    "user_id" VARCHAR(50) NOT NULL,
    "Token" VARCHAR(512) NOT NULL,
    "Platform" VARCHAR(20),
    "Updated_On" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Int_Status" INTEGER DEFAULT 1,
    CONSTRAINT "tblDevice_Tokens_Token_key" UNIQUE ("Token")
  )`,
  `CREATE INDEX IF NOT EXISTS "tblDevice_Tokens_user_id_idx" ON "tblDevice_Tokens"("user_id")`,
];

const fks = [
  `DO $$ BEGIN
    ALTER TABLE "tblParent_Student" ADD CONSTRAINT "tblParent_Student_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "tblUsers"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblParent_Student" ADD CONSTRAINT "tblParent_Student_Student_id_fkey"
      FOREIGN KEY ("Student_id") REFERENCES "tblStudents"("Student_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblNotices" ADD CONSTRAINT "tblNotices_Created_By_fkey"
      FOREIGN KEY ("Created_By") REFERENCES "tblUsers"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblNotice_Targets" ADD CONSTRAINT "tblNotice_Targets_Notice_id_fkey"
      FOREIGN KEY ("Notice_id") REFERENCES "tblNotices"("Notice_id") ON DELETE CASCADE ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblNotice_Targets" ADD CONSTRAINT "tblNotice_Targets_Class_Section_id_fkey"
      FOREIGN KEY ("Class_Section_id") REFERENCES "tblClass_Section"("Class_Section_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblNotice_Targets" ADD CONSTRAINT "tblNotice_Targets_Student_Class_id_fkey"
      FOREIGN KEY ("Student_Class_id") REFERENCES "tblStudent_Class"("student_class_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblClass_Diary" ADD CONSTRAINT "tblClass_Diary_Class_Section_id_fkey"
      FOREIGN KEY ("Class_Section_id") REFERENCES "tblClass_Section"("Class_Section_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblClass_Diary" ADD CONSTRAINT "tblClass_Diary_Created_By_fkey"
      FOREIGN KEY ("Created_By") REFERENCES "tblUsers"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblTimetable" ADD CONSTRAINT "tblTimetable_Class_Section_id_fkey"
      FOREIGN KEY ("Class_Section_id") REFERENCES "tblClass_Section"("Class_Section_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "tblDevice_Tokens" ADD CONSTRAINT "tblDevice_Tokens_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "tblUsers"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function main() {
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  for (const sql of fks) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log('Parent portal tables ensured (no drops).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
