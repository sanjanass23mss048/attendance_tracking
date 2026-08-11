#!/bin/bash
set -euo pipefail
DBURL=$(grep '^DATABASE_URL=' /opt/attendance-tracking/server/.env | cut -d= -f2- | tr -d '"')
PASS=$(python3 - <<PY
from urllib.parse import urlparse, unquote
u=urlparse('''$DBURL''')
print(unquote(u.password or ''))
PY
)
export PGPASSWORD="$PASS"

echo "=== recent teacher notifications ==="
docker exec -e PGPASSWORD="$PASS" alm_db psql -U postgres -d Attendence -c \
  "SELECT notification_id, title, recipient_type, recipient_count, status, sent_at FROM \"tblTeacher_Notifications\" ORDER BY created_at DESC LIMIT 5;"

echo "=== recent notices ==="
docker exec -e PGPASSWORD="$PASS" alm_db psql -U postgres -d Attendence -c \
  "SELECT \"Notice_id\", \"Title\", \"Audience_Type\", \"Created_On\" FROM \"tblNotices\" ORDER BY \"Created_On\" DESC LIMIT 5;"

echo "=== parent links sample ==="
docker exec -e PGPASSWORD="$PASS" alm_db psql -U postgres -d Attendence -c \
  "SELECT COUNT(*) AS parent_links FROM \"tblParent_Student\" WHERE COALESCE(\"Int_Status\",1) <> 0;"

echo "=== test nested create via node ==="
docker exec -w /app/server bright-future-attendance node --input-type=module -e '
import { createNotice } from "./src/services/noticeRepo.js";
import { prisma } from "./src/lib/prisma.js";
const user = await prisma.tblUsers.findFirst({ where: { int_status: 1 }, select: { user_id: true } });
const sc = await prisma.tblStudent_Class.findFirst({ where: { Int_Status: { not: 0 } }, select: { student_class_id: true } });
if (!user || !sc) { console.log("missing fixtures"); process.exit(1); }
try {
  const n = await createNotice({
    title: "Mirror test",
    body: "Parent board visibility check",
    audienceType: "STUDENTS",
    studentClassIds: [sc.student_class_id],
    createdBy: user.user_id,
  });
  console.log("created", n.id, n.audienceType);
  await prisma.tblNotice_Targets.deleteMany({ where: { Notice_id: n.id } });
  await prisma.tblNotices.delete({ where: { Notice_id: n.id } });
  console.log("cleaned");
} catch (e) {
  console.error("CREATE_FAILED", e.message);
  process.exitCode = 1;
} finally {
  await prisma['$disconnect']();
}
'
