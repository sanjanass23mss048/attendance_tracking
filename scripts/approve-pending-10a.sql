UPDATE "tblAttendance_Edit_Requests"
SET
  "Status" = 'APPROVED',
  "Responded_At" = NOW(),
  "Edit_Expires_At" = NOW() + INTERVAL '30 minutes'
WHERE "Request_id" = 'AER8d600c4f6b95683d9fed6819'
  AND "Status" = 'PENDING';

SELECT "Request_id", "Status", "Responded_At", "Edit_Expires_At"
FROM "tblAttendance_Edit_Requests"
WHERE "Request_id" = 'AER8d600c4f6b95683d9fed6819';
