-- Band approvers:
-- LKG+UKG  -> USR-APPROVER-KG   918508223156
-- 1-6      -> USR-INCHARGE      918072180274
-- 7-12     -> USR-APPROVER-HS   918610593702

-- Ensure phones on users (copy password from existing incharge for login capability)
INSERT INTO "tblUsers" (user_id, name, email, password, role_id, phone, int_status)
SELECT
  'USR-APPROVER-KG',
  'KG Band Approver',
  'approver.kg@brightfuture.edu.in',
  password,
  'INCHARGE',
  '918508223156',
  1
FROM "tblUsers" WHERE user_id = 'USR-INCHARGE'
ON CONFLICT (user_id) DO UPDATE
SET phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    role_id = EXCLUDED.role_id,
    int_status = 1;

INSERT INTO "tblUsers" (user_id, name, email, password, role_id, phone, int_status)
SELECT
  'USR-APPROVER-HS',
  'High School Band Approver',
  'approver.hs@brightfuture.edu.in',
  password,
  'INCHARGE',
  '918610593702',
  1
FROM "tblUsers" WHERE user_id = 'USR-INCHARGE'
ON CONFLICT (user_id) DO UPDATE
SET phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    role_id = EXCLUDED.role_id,
    int_status = 1;

UPDATE "tblUsers"
SET phone = '918072180274', int_status = 1
WHERE user_id = 'USR-INCHARGE';

-- Clear and reassign all section approvers by band
DELETE FROM "tblClass_Section_Approver";

INSERT INTO "tblClass_Section_Approver"
  ("Class_Section_id", "Approver_User_id", "WhatsApp_Phone", "Int_Status", "Created_On")
SELECT cs."Class_Section_id",
       CASE
         WHEN c."Class_Name" IN ('LKG', 'UKG') THEN 'USR-APPROVER-KG'
         WHEN c."Class_Name" IN ('1','2','3','4','5','6') THEN 'USR-INCHARGE'
         WHEN c."Class_Name" IN ('7','8','9','10','11','12') THEN 'USR-APPROVER-HS'
       END,
       CASE
         WHEN c."Class_Name" IN ('LKG', 'UKG') THEN '918508223156'
         WHEN c."Class_Name" IN ('1','2','3','4','5','6') THEN '918072180274'
         WHEN c."Class_Name" IN ('7','8','9','10','11','12') THEN '918610593702'
       END,
       1,
       NOW()
FROM "tblClass_Section" cs
JOIN "tblClass" c ON c."Class_id" = cs."Class_id"
WHERE c."Class_Name" IN ('LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12');

-- Verify
SELECT
  CASE
    WHEN a."Approver_User_id" = 'USR-APPROVER-KG' THEN 'LKG+UKG'
    WHEN a."Approver_User_id" = 'USR-INCHARGE' THEN '1-6'
    WHEN a."Approver_User_id" = 'USR-APPROVER-HS' THEN '7-12'
  END AS band,
  a."WhatsApp_Phone",
  u.name,
  COUNT(*) AS sections
FROM "tblClass_Section_Approver" a
JOIN "tblUsers" u ON u.user_id = a."Approver_User_id"
GROUP BY 1, 2, 3
ORDER BY 1;
