-- Attendance edit approval tables

CREATE TABLE IF NOT EXISTS "tblClass_Section_Approver" (
  "Class_Section_id" VARCHAR(50) NOT NULL,
  "Approver_User_id" VARCHAR(50) NOT NULL,
  "WhatsApp_Phone" VARCHAR(20),
  "Int_Status" INTEGER DEFAULT 1,
  "Created_On" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tblClass_Section_Approver_pkey" PRIMARY KEY ("Class_Section_id"),
  CONSTRAINT "tblClass_Section_Approver_section_fkey"
    FOREIGN KEY ("Class_Section_id") REFERENCES "tblClass_Section"("Class_Section_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "tblClass_Section_Approver_user_fkey"
    FOREIGN KEY ("Approver_User_id") REFERENCES "tblUsers"("user_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "tblClass_Section_Approver_approver_idx"
  ON "tblClass_Section_Approver"("Approver_User_id");

CREATE TABLE IF NOT EXISTS "tblAttendance_Edit_Requests" (
  "Request_id" VARCHAR(50) NOT NULL,
  "Teacher_id" VARCHAR(50) NOT NULL,
  "Class_id" VARCHAR(50) NOT NULL,
  "Section_id" VARCHAR(50) NOT NULL,
  "Class_Section_id" VARCHAR(50) NOT NULL,
  "Attendance_Date" DATE NOT NULL,
  "Reason" TEXT NOT NULL,
  "Approver_id" VARCHAR(50) NOT NULL,
  "Status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "Deny_Reason" TEXT,
  "Requested_At" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "Responded_At" TIMESTAMPTZ(6),
  "Edit_Expires_At" TIMESTAMPTZ(6),
  "Used_At" TIMESTAMPTZ(6),
  "WhatsApp_Message_id" VARCHAR(100),
  "Int_Status" INTEGER DEFAULT 1,
  CONSTRAINT "tblAttendance_Edit_Requests_pkey" PRIMARY KEY ("Request_id"),
  CONSTRAINT "tblAttendance_Edit_Requests_teacher_fkey"
    FOREIGN KEY ("Teacher_id") REFERENCES "tblUsers"("user_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "tblAttendance_Edit_Requests_approver_fkey"
    FOREIGN KEY ("Approver_id") REFERENCES "tblUsers"("user_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "tblAttendance_Edit_Requests_teacher_idx"
  ON "tblAttendance_Edit_Requests"("Teacher_id");
CREATE INDEX IF NOT EXISTS "tblAttendance_Edit_Requests_approver_idx"
  ON "tblAttendance_Edit_Requests"("Approver_id");
CREATE INDEX IF NOT EXISTS "tblAttendance_Edit_Requests_status_idx"
  ON "tblAttendance_Edit_Requests"("Status");
CREATE INDEX IF NOT EXISTS "tblAttendance_Edit_Requests_lookup_idx"
  ON "tblAttendance_Edit_Requests"("Teacher_id", "Class_Section_id", "Attendance_Date", "Status");

CREATE TABLE IF NOT EXISTS "tblAttendance_Audit_Logs" (
  "Log_id" VARCHAR(50) NOT NULL,
  "Attendance_id" VARCHAR(50),
  "Student_Class_id" VARCHAR(50) NOT NULL,
  "Old_Status" VARCHAR(10),
  "New_Status" VARCHAR(10) NOT NULL,
  "Changed_By" VARCHAR(50) NOT NULL,
  "Approved_By" VARCHAR(50),
  "Request_id" VARCHAR(50),
  "Reason" TEXT,
  "Changed_At" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tblAttendance_Audit_Logs_pkey" PRIMARY KEY ("Log_id")
);

CREATE INDEX IF NOT EXISTS "tblAttendance_Audit_Logs_student_idx"
  ON "tblAttendance_Audit_Logs"("Student_Class_id");
CREATE INDEX IF NOT EXISTS "tblAttendance_Audit_Logs_request_idx"
  ON "tblAttendance_Audit_Logs"("Request_id");
CREATE INDEX IF NOT EXISTS "tblAttendance_Audit_Logs_changed_at_idx"
  ON "tblAttendance_Audit_Logs"("Changed_At");
