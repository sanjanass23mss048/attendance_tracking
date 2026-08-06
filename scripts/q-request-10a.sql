SELECT r."Request_id", r."Status", r."Teacher_id", r."Approver_id", r."Class_Section_id",
       r."Attendance_Date", r."Reason", r."Requested_At", r."Responded_At",
       r."Edit_Expires_At", r."WhatsApp_Message_id",
       t.name AS teacher, a.name AS approver, a.phone AS approver_phone
FROM "tblAttendance_Edit_Requests" r
LEFT JOIN "tblUsers" t ON t.user_id = r."Teacher_id"
LEFT JOIN "tblUsers" a ON a.user_id = r."Approver_id"
WHERE r."Class_Section_id" = 'CS-10-A'
ORDER BY r."Requested_At" DESC
LIMIT 10;

SELECT "Class_Section_id", "Approver_User_id", "WhatsApp_Phone"
FROM "tblClass_Section_Approver"
WHERE "Class_Section_id" = 'CS-10-A';
