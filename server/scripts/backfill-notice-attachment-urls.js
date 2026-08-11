/**
 * Backfill Attachment_Url on tblNotices from matching teacher notification files.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const notices = await prisma.$queryRaw`
    SELECT "Notice_id", "Attachment_Name"
    FROM "tblNotices"
    WHERE "Int_Status" IS DISTINCT FROM 0
      AND "Attachment_Name" IS NOT NULL
      AND ("Attachment_Url" IS NULL OR "Attachment_Url" = '')
  `;

  let fixed = 0;
  for (const n of notices) {
    const rows = await prisma.$queryRaw`
      SELECT "attachment_key"
      FROM "tblTeacher_Notifications"
      WHERE "attachment_name" = ${n.Attachment_Name}
        AND "attachment_key" IS NOT NULL
      ORDER BY "created_at" DESC
      LIMIT 1
    `;
    const key = rows?.[0]?.attachment_key;
    if (!key) continue;
    await prisma.tblNotices.update({
      where: { Notice_id: n.Notice_id },
      data: { Attachment_Url: key },
    });
    fixed += 1;
    console.log('Fixed', n.Notice_id, '←', key);
  }
  console.log(`Backfilled ${fixed}/${notices.length} notices`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
