SELECT c."Class_Name", s."Section_Name", cs."Class_Section_id", cs."Class_id"
FROM "tblClass_Section" cs
JOIN "tblClass" c ON c."Class_id" = cs."Class_id"
JOIN "tblSection" s ON s."Section_id" = cs."Section_id"
WHERE COALESCE(cs."Int_Status",1) <> 0
ORDER BY c."Class_Name", s."Section_Name";

SELECT user_id, name, phone, role_id, email
FROM "tblUsers"
WHERE COALESCE(int_status,1) <> 0
ORDER BY name;

SELECT a."Class_Section_id", a."Approver_User_id", a."WhatsApp_Phone", u.name, u.phone
FROM "tblClass_Section_Approver" a
LEFT JOIN "tblUsers" u ON u.user_id = a."Approver_User_id";
