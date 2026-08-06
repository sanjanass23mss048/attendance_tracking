-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "staffType" TEXT NOT NULL DEFAULT 'teaching',
    "role" TEXT NOT NULL DEFAULT 'Subject Teacher',
    "department" TEXT,
    "subjects" TEXT,
    "classesAssigned" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "dob" DATE,
    "gender" TEXT,
    "address" TEXT,
    "joinDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_employeeId_key" ON "Teacher"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE INDEX "Teacher_staffType_idx" ON "Teacher"("staffType");

-- CreateIndex
CREATE INDEX "Teacher_status_idx" ON "Teacher"("status");

-- CreateIndex
CREATE INDEX "Teacher_department_idx" ON "Teacher"("department");
