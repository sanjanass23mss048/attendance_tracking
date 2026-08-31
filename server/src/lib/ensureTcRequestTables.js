import { prisma } from './prisma.js';

async function addColumnIfMissing(table, column, definition) {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${table}'
          AND column_name = '${column}'
      ) THEN
        ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition};
      END IF;
    END $$;
  `);
}

export async function ensureTcRequestTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblTc_Requests" (
      "Request_id" VARCHAR(50) NOT NULL,
      "Student_id" VARCHAR(50) NOT NULL,
      "Student_Class_id" VARCHAR(50) NOT NULL,
      "Class_Section_id" VARCHAR(50) NOT NULL,
      "Student_Name" VARCHAR(255) NOT NULL,
      "Class_Label" VARCHAR(100),
      "Admission_No" VARCHAR(100),
      "Roll_No" VARCHAR(50),
      "Parent_Name" VARCHAR(255),
      "Parent_Contact" VARCHAR(50),
      "Reason" TEXT,
      "Status" VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
      "Source" VARCHAR(40) DEFAULT 'PARENT',
      "Requested_By" VARCHAR(50) NOT NULL,
      "Forwarded_By" VARCHAR(50),
      "Forwarded_On" TIMESTAMPTZ(6),
      "Reviewed_By" VARCHAR(50),
      "Reviewed_On" TIMESTAMPTZ(6),
      "Review_Note" VARCHAR(500),
      "Issued_By" VARCHAR(50),
      "Issued_On" TIMESTAMPTZ(6),
      "Tc_Html" TEXT,
      "Created_On" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "Int_Status" INTEGER DEFAULT 1,
      CONSTRAINT "tblTc_Requests_pkey" PRIMARY KEY ("Request_id")
    )
  `);

  await addColumnIfMissing('tblTc_Requests', 'Admission_No', 'VARCHAR(100)');
  await addColumnIfMissing('tblTc_Requests', 'Roll_No', 'VARCHAR(50)');
  await addColumnIfMissing('tblTc_Requests', 'Parent_Name', 'VARCHAR(255)');
  await addColumnIfMissing('tblTc_Requests', 'Parent_Contact', 'VARCHAR(50)');
  await addColumnIfMissing('tblTc_Requests', 'Source', "VARCHAR(40) DEFAULT 'PARENT'");
  await addColumnIfMissing('tblTc_Requests', 'Issued_By', 'VARCHAR(50)');
  await addColumnIfMissing('tblTc_Requests', 'Issued_On', 'TIMESTAMPTZ(6)');
  await addColumnIfMissing('tblTc_Requests', 'Tc_Html', 'TEXT');
  await addColumnIfMissing('tblTc_Requests', 'Signer_Name', 'VARCHAR(255)');
  await addColumnIfMissing('tblTc_Requests', 'Signer_Designation', 'VARCHAR(100)');
  await addColumnIfMissing('tblTc_Requests', 'Signature_Image', 'TEXT');
  await addColumnIfMissing('tblTc_Requests', 'Signed_At', 'TIMESTAMPTZ(6)');
  await addColumnIfMissing('tblTc_Requests', 'Tc_File_Key', 'VARCHAR(500)');
  await addColumnIfMissing('tblTc_Requests', 'Tc_Mime_Type', 'VARCHAR(100)');
  await addColumnIfMissing('tblTc_Requests', 'Tc_File_Name', 'VARCHAR(255)');
  await addColumnIfMissing('tblTc_Requests', 'Tc_No', 'VARCHAR(40)');

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "tblTc_Requests_tc_no_uidx"
      ON "tblTc_Requests"("Tc_No")
      WHERE "Tc_No" IS NOT NULL AND length("Tc_No") > 0
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
