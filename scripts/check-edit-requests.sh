#!/bin/bash
echo "=== logs ==="
docker logs bright-future-attendance --tail 80 2>&1 | grep -iE 'whatsapp|edit-request|webhook|approv|invalid|deny' || echo "(no webhook lines)"
echo "=== requests ==="
docker exec bright-future-attendance node --input-type=module <<'EOF'
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const rows = await p.tblAttendance_Edit_Requests.findMany({
  orderBy: { Requested_At: 'desc' },
  take: 8,
});
console.log(JSON.stringify(rows.map((r) => ({
  id: r.Request_id,
  status: r.Status,
  date: r.Attendance_Date,
  section: r.Class_Section_id,
  teacher: r.Teacher_id,
  approver: r.Approver_id,
  responded: r.Responded_At,
  expires: r.Edit_Expires_At,
})), null, 2));
await p['$disconnect']();
EOF
