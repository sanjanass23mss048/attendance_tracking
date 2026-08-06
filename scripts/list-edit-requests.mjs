#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
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
} catch (e) {
  console.error('ERR', e.message);
  process.exitCode = 1;
} finally {
  await p['$disconnect']();
}
