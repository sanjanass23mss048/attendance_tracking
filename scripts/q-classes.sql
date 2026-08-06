SELECT c."Class_Name", s."Section_Name", cs."Class_Section_id", cs."Class_id"
FROM "tblClass_Section" cs
JOIN "tblClass" c ON c."Class_id" = cs."Class_id"
JOIN "tblSection" s ON s."Section_id" = cs."Section_id"
ORDER BY c."Class_Name", s."Section_Name";
