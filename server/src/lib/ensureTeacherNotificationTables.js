import { prisma } from './prisma.js';

export async function ensureTeacherNotificationTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblTeacher_Notifications" (
      "notification_id" VARCHAR(50) NOT NULL,
      "created_by" VARCHAR(50) NOT NULL,
      "title" VARCHAR(100) NOT NULL,
      "message" TEXT NOT NULL,
      "category" VARCHAR(40),
      "recipient_type" VARCHAR(40) NOT NULL,
      "recipient_payload" TEXT,
      "recipient_summary" VARCHAR(500),
      "recipient_count" INTEGER NOT NULL DEFAULT 0,
      "status" VARCHAR(30) NOT NULL,
      "scheduled_at" TIMESTAMPTZ(6),
      "sent_at" TIMESTAMPTZ(6),
      "attachment_name" VARCHAR(255),
      "attachment_key" VARCHAR(500),
      "attachment_mime" VARCHAR(100),
      "attachment_size" INTEGER,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "tblTeacher_Notifications_pkey" PRIMARY KEY ("notification_id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTeacher_Notifications_user_idx"
      ON "tblTeacher_Notifications"("created_by", "created_at")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTeacher_Notifications_status_idx"
      ON "tblTeacher_Notifications"("status", "scheduled_at")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblTeacher_Notification_Recipients" (
      "id" VARCHAR(50) NOT NULL,
      "notification_id" VARCHAR(50) NOT NULL,
      "student_class_id" VARCHAR(50) NOT NULL,
      "student_id" VARCHAR(50),
      "delivery_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "tblTeacher_Notification_Recipients_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblTeacher_Notification_Recipients_notif_idx"
      ON "tblTeacher_Notification_Recipients"("notification_id")
  `);
}
