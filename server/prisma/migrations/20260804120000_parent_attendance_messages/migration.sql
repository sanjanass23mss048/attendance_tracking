-- Parent attendance message log (who was notified, when)

CREATE TABLE IF NOT EXISTS "tblParent_Attendance_Messages" (
  "Message_id" VARCHAR(50) NOT NULL,
  "Attendance_id" VARCHAR(50),
  "Class_Section_id" VARCHAR(50) NOT NULL,
  "Attendance_Date" DATE NOT NULL,
  "Student_Class_id" VARCHAR(50) NOT NULL,
  "Status" VARCHAR(10) NOT NULL,
  "Message_Body" TEXT,
  "Initiated_At" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "Submitted_At" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "Sent_By" VARCHAR(50),
  "Int_Status" INTEGER DEFAULT 1,
  CONSTRAINT "tblParent_Attendance_Messages_pkey" PRIMARY KEY ("Message_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tblParent_Attendance_Messages_dedupe_idx"
  ON "tblParent_Attendance_Messages"("Class_Section_id", "Attendance_Date", "Student_Class_id", "Status");

CREATE INDEX IF NOT EXISTS "tblParent_Attendance_Messages_section_date_idx"
  ON "tblParent_Attendance_Messages"("Class_Section_id", "Attendance_Date");

CREATE INDEX IF NOT EXISTS "tblParent_Attendance_Messages_student_idx"
  ON "tblParent_Attendance_Messages"("Student_Class_id");
