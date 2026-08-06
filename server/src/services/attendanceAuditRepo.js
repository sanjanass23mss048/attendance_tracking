import { prisma } from '../lib/prisma.js';
import { newId } from '../lib/ids.js';

export async function writeAttendanceAuditLogs(entries) {
  if (!entries?.length) return;
  await prisma.tblAttendance_Audit_Logs.createMany({
    data: entries.map((e) => ({
      Log_id: newId('AAL'),
      Attendance_id: e.attendanceId || null,
      Student_Class_id: e.studentClassId,
      Old_Status: e.oldStatus ?? null,
      New_Status: e.newStatus,
      Changed_By: e.changedBy,
      Approved_By: e.approvedBy || null,
      Request_id: e.requestId || null,
      Reason: e.reason || null,
    })),
  });
}
