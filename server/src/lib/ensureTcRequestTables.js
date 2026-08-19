import { prisma } from './prisma.js';

export async function ensureTcRequestTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblTc_Requests" (
      "Request_id" VARCHAR(50) NOT NULL,
      "Student_id" VARCHAR(50) NOT NULL,
      "Student_Class_id" VARCHAR(50) NOT NULL,
      "Class_Section_id" VARCHAR(50) NOT NULL,
      "Student_Name" VARCHAR(255) NOT NULL,
      "Class_Label" VARCHAR(100),
      "Reason" TEXT,
      "Status" VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
      "Requested_By" VARCHAR(50) NOT NULL,
      "Forwarded_By" VARCHAR(50),
      "Forwarded_On" TIMESTAMPTZ(6),
      "Reviewed_By" VARCHAR(50),
      "Reviewed_On" TIMESTAMPTZ(6),
      "Review_Note" VARCHAR(500),
      "Created_On" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "Int_Status" INTEGER DEFAULT 1,
      CONSTRAINT "tblTc_Requests_pkey" PRIMARY KEY ("Request_id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTc_Requests_status_idx"
      ON "tblTc_Requests"("Status", "Created_On")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTc_Requests_section_idx"
      ON "tblTc_Requests"("Class_Section_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTc_Requests_student_idx"
      ON "tblTc_Requests"("Student_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTc_Requests_parent_idx"
      ON "tblTc_Requests"("Requested_By")
  `);
}
