import { prisma } from './prisma.js';

export async function ensureAdminAuditTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tblAdmin_Audit_Logs" (
      "Log_id" VARCHAR(50) NOT NULL,
      "Created_On" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "Actor_User_id" VARCHAR(50),
      "Actor_Name" VARCHAR(255),
      "Actor_Email" VARCHAR(255),
      "Actor_Role" VARCHAR(50),
      "Action" VARCHAR(80) NOT NULL,
      "Category" VARCHAR(40) NOT NULL,
      "Entity_Type" VARCHAR(80),
      "Entity_id" VARCHAR(80),
      "Summary" VARCHAR(500) NOT NULL,
      "Details_Json" JSONB,
      "Ip_Address" VARCHAR(64),
      "User_Agent" VARCHAR(500),
      "Success" BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT "tblAdmin_Audit_Logs_pkey" PRIMARY KEY ("Log_id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblAdmin_Audit_Logs_created_idx"
      ON "tblAdmin_Audit_Logs"("Created_On" DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblAdmin_Audit_Logs_category_idx"
      ON "tblAdmin_Audit_Logs"("Category", "Created_On" DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblAdmin_Audit_Logs_actor_idx"
      ON "tblAdmin_Audit_Logs"("Actor_User_id", "Created_On" DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tblAdmin_Audit_Logs_action_idx"
      ON "tblAdmin_Audit_Logs"("Action", "Created_On" DESC)
  `);
}
