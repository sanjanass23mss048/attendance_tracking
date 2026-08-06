# Attendance Edit Approval — Setup

## What was added

Same-day attendance stays editable. Previous dates are locked until an assigned approver (Incharge / HOD / VP / Principal / Admin) approves via **WhatsApp** or the in-app **Edit Approvals** page. Approved edits last **30 minutes**, then lock again after save (`USED`).

## Database

Run against Attendence Postgres:

```bash
cd server
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260724120000_attendance_edit_approval/migration.sql
npx prisma generate
```

Tables:

- `tblAttendance_Edit_Requests`
- `tblAttendance_Audit_Logs`
- `tblClass_Section_Approver` (maps each class-section to an approver + optional WhatsApp phone)

Assign an approver (example — use your incharge `user_id` and a real class-section id):

```sql
INSERT INTO "tblClass_Section_Approver"
  ("Class_Section_id", "Approver_User_id", "WhatsApp_Phone", "Int_Status")
VALUES
  ('CS-1-A', 'USR-INCHARGE-001', '9198XXXXXXXX', 1)
ON CONFLICT ("Class_Section_id") DO UPDATE
SET "Approver_User_id" = EXCLUDED."Approver_User_id",
    "WhatsApp_Phone" = EXCLUDED."WhatsApp_Phone";
```

If no row exists, the API falls back to the first Incharge/Admin user.

## Backend env (`server/.env`)

```env
SCHOOL_TIMEZONE=Asia/Kolkata
EDIT_PERMISSION_MINUTES=30
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
META_GRAPH_VERSION=v21.0
```

Never put WhatsApp secrets in Vite / React env.

## Meta WhatsApp webhook

Callback URL: `https://YOUR_PUBLIC_HOST/api/webhooks/whatsapp`  
Verify token: same as `WHATSAPP_VERIFY_TOKEN`  
Subscribe to `messages`.

## APIs

| Method | Path |
|--------|------|
| POST | `/api/attendance-edit-requests` |
| GET | `/api/attendance-edit-requests/my-requests` |
| GET | `/api/attendance-edit-requests/pending` |
| GET | `/api/attendance-edit-requests/context?sectionId=&date=` |
| GET | `/api/attendance-edit-requests/:id/status` |
| PATCH | `/api/attendance-edit-requests/:id/approve` |
| PATCH | `/api/attendance-edit-requests/:id/deny` |
| GET/POST | `/api/webhooks/whatsapp` |

`PUT /api/attendance/daily` and `/periods` reject past dates without an active APPROVED permission (`ATTENDANCE_LOCKED`).

## Frontend

- Attendance grid: lock banner + **Request Edit** modal
- Nav: **Edit Approvals** (in-app Approve / Deny)
- Theme: indigo / white / amber (existing)

## Folder map

```
server/prisma/migrations/20260724120000_attendance_edit_approval/
server/src/lib/attendanceEditRules.js
server/src/lib/whatsapp.js
server/src/middleware/roles.js
server/src/services/editRequestRepo.js
server/src/services/attendanceAuditRepo.js
server/src/routes/attendanceEditRequests.js
server/src/routes/whatsappWebhook.js
src/services/attendanceEditRequestService.js
src/components/AttendanceEditRequestModal.jsx
src/components/AttendanceEditStatusBanner.jsx
src/components/EditApprovalsPage.jsx
```
