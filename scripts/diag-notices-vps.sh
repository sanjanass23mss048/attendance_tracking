#!/bin/bash
set -euo pipefail
echo "=== schema on host ==="
grep -A15 'model tblNotices' /opt/attendance-tracking/server/prisma/schema.prisma || true
echo "=== schema in container ==="
docker exec bright-future-attendance grep -A15 'model tblNotices' /app/server/prisma/schema.prisma || true
echo "=== prisma model fields ==="
docker exec -w /app/server bright-future-attendance node --input-type=module -e '
import { Prisma } from "@prisma/client";
const m = Prisma.dmmf.datamodel.models.find((x) => x.name === "tblNotices");
console.log(m ? m.fields.map((f) => f.name).join(", ") : "NO MODEL tblNotices");
const models = Prisma.dmmf.datamodel.models.map((x) => x.name).filter((n) => /notice|Notice/i.test(n));
console.log("notice models:", models);
'
echo "=== db columns ==="
DBURL=$(grep '^DATABASE_URL=' /opt/attendance-tracking/server/.env | cut -d= -f2- | tr -d '"')
PASS=$(python3 - <<PY
from urllib.parse import urlparse, unquote
u=urlparse('''$DBURL''')
print(unquote(u.password or ''))
PY
)
docker exec -e PGPASSWORD="$PASS" alm_db psql -U postgres -d Attendence -c "\d \"tblNotices\"" 2>&1 | head -40 || \
docker exec -e PGPASSWORD="$PASS" alm_db psql -U postgres -d Attendence -c "\dt *otice*" 2>&1 | head -40
