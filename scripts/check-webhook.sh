#!/bin/bash
set -e
echo "=== verify challenge ==="
curl -sk -m 8 "https://attendance.rioassetmanagement.net/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=attendence_wa_verify_2026&hub.challenge=ok_verified"
echo
echo "=== health ==="
curl -sk -m 5 https://attendance.rioassetmanagement.net/health
echo
echo "=== pending requests ==="
docker exec alm_db psql -U postgres -d Attendence -c \
  "SELECT \"Request_id\", \"Status\", \"Class_Section_id\", \"Attendance_Date\", \"Approver_id\" FROM \"tblAttendance_Edit_Requests\" WHERE \"Status\" = 'PENDING' ORDER BY \"Requested_At\" DESC LIMIT 5;"
echo "=== recent webhook/approve logs ==="
docker logs bright-future-attendance --since 45m 2>&1 | grep -iE 'whatsapp|webhook|approved|denied' | tail -30 || echo "(none yet)"
