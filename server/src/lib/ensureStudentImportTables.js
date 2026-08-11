import { prisma } from './prisma.js';

/** Idempotent DDL so VPS deploys work without interactive migrate. */
export async function ensureStudentImportTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblStudent_Import_History" (
      "import_id" VARCHAR(50) NOT NULL,
      "uploaded_by" VARCHAR(50) NOT NULL,
      "original_file_name" VARCHAR(255) NOT NULL,
      "total_rows" INTEGER NOT NULL DEFAULT 0,
      "successful_rows" INTEGER NOT NULL DEFAULT 0,
      "failed_rows" INTEGER NOT NULL DEFAULT 0,
      "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
      "status" VARCHAR(40) NOT NULL,
      "imported_at" TIMESTAMPTZ(6),
      "completed_at" TIMESTAMPTZ(6),
      "error_report_reference" VARCHAR(500),
      "validation_reference" VARCHAR(500),
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "tblStudent_Import_History_pkey" PRIMARY KEY ("import_id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblStudent_Import_History_user_idx"
      ON "tblStudent_Import_History"("uploaded_by", "created_at")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblStudent_Import_History_status_idx"
      ON "tblStudent_Import_History"("status")
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tblStudent_Import_History_uploaded_by_fkey'
      ) THEN
        ALTER TABLE "tblStudent_Import_History"
          ADD CONSTRAINT "tblStudent_Import_History_uploaded_by_fkey"
          FOREIGN KEY ("uploaded_by") REFERENCES "tblUsers"("user_id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblStudent_Import_Audit" (
      "audit_id" VARCHAR(50) NOT NULL,
      "import_id" VARCHAR(50),
      "event_type" VARCHAR(80) NOT NULL,
      "user_id" VARCHAR(50),
      "student_id" VARCHAR(50),
      "admission_no" VARCHAR(100),
      "class_name" VARCHAR(100),
      "section_name" VARCHAR(50),
      "file_name" VARCHAR(255),
      "total_rows" INTEGER,
      "successful_count" INTEGER,
      "failed_count" INTEGER,
      "duplicate_count" INTEGER,
      "details" TEXT,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "tblStudent_Import_Audit_pkey" PRIMARY KEY ("audit_id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblStudent_Import_Audit_import_idx"
      ON "tblStudent_Import_Audit"("import_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblStudent_Import_Audit_event_idx"
      ON "tblStudent_Import_Audit"("event_type", "created_at")
  `);
}
