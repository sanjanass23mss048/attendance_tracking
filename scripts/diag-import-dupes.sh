#!/bin/bash
echo "=== st_josephs students ==="
PGPASSWORD='Kovai1252*' psql -h 127.0.0.1 -p 5432 -U postgres -d st_josephs_attdb -c 'SELECT COUNT(*) AS students FROM "tblStudents";'
PGPASSWORD='Kovai1252*' psql -h 127.0.0.1 -p 5432 -U postgres -d st_josephs_attdb -c 'SELECT COUNT(*) AS enrollments FROM "tblStudent_Class" WHERE "Int_Status" <> 0;'
echo "=== Bright Future LKG A ==="
PGPASSWORD='Kovai1252*' psql -h 127.0.0.1 -p 5432 -U postgres -d Attendence -c 'SELECT c."Class_Name", s."Section_Name", COUNT(*) FROM "tblStudent_Class" sc JOIN "tblClass_Section" cs ON cs."Class_Section_id" = sc.class_section_id JOIN "tblClass" c ON c."Class_id" = cs."Class_id" JOIN "tblSection" s ON s."Section_id" = cs."Section_id" WHERE sc."Int_Status" <> 0 AND c."Class_Name" ILIKE '"'"'LKG'"'"' GROUP BY 1,2;'
echo "=== Bright Future sample names ==="
PGPASSWORD='Kovai1252*' psql -h 127.0.0.1 -p 5432 -U postgres -d Attendence -c 'SELECT st."First_Name", st."Last_Name", sc."Roll_No" FROM "tblStudent_Class" sc JOIN "tblStudents" st ON st."Student_id" = sc."Student_id" WHERE sc."Roll_No" IN ('"'"'1'"'"','"'"'2'"'"','"'"'3'"'"') AND sc."Int_Status" <> 0 LIMIT 10;'
