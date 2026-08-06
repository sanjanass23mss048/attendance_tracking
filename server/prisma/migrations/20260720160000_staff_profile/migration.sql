-- Staff profile fields for teachers (subjects, department, role title, etc.)
CREATE TABLE IF NOT EXISTS "tblStaff_Profile" (
    "user_id" VARCHAR(50) NOT NULL,
    "staff_type" VARCHAR(30),
    "job_role" VARCHAR(100),
    "department" VARCHAR(100),
    "subjects" VARCHAR(255),
    "classes_assigned" VARCHAR(255),
    "dob" DATE,
    "gender" VARCHAR(20),
    "address" VARCHAR(500),
    "join_date" DATE,

    CONSTRAINT "tblStaff_Profile_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "tblStaff_Profile_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "tblUsers"("user_id")
      ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "tblStaff_Profile_department_idx" ON "tblStaff_Profile"("department");
CREATE INDEX IF NOT EXISTS "tblStaff_Profile_staff_type_idx" ON "tblStaff_Profile"("staff_type");
