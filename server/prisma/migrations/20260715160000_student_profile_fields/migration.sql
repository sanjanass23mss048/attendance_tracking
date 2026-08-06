-- AlterTable
ALTER TABLE "Student" ADD COLUMN "admissionNo" TEXT,
ADD COLUMN "dob" DATE,
ADD COLUMN "gender" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "bloodGroup" TEXT,
ADD COLUMN "nationality" TEXT DEFAULT 'Indian',
ADD COLUMN "motherName" TEXT,
ADD COLUMN "fatherName" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Active';

-- CreateIndex
CREATE INDEX "Student_admissionNo_idx" ON "Student"("admissionNo");
