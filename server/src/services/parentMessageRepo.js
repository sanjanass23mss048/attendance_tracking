import { prisma } from '../lib/prisma.js';
import { attendanceHeaderId, newId, toDateString } from '../lib/ids.js';

/**
 * Submitted parent messages for a section + date.
 * Returns [{ studentId, status, initiatedAt, submittedAt }]
 */
export async function listParentMessages(classSectionId, date) {
  const dateStr = toDateString(date);
  const rows = await prisma.tblParent_Attendance_Messages.findMany({
    where: {
      Class_Section_id: classSectionId,
      Attendance_Date: date,
      Int_Status: { not: 0 },
    },
    select: {
      Student_Class_id: true,
      Status: true,
      Initiated_At: true,
      Submitted_At: true,
    },
    orderBy: { Submitted_At: 'asc' },
  });

  return rows.map((r) => ({
    studentId: r.Student_Class_id,
    status: r.Status,
    initiatedAt: r.Initiated_At?.toISOString?.() || r.Initiated_At,
    submittedAt: r.Submitted_At?.toISOString?.() || r.Submitted_At,
    date: dateStr,
  }));
}

/**
 * Upsert parent message rows when messages are submitted.
 * @param {{
 *   classSectionId: string,
 *   date: Date,
 *   dateStr: string,
 *   messages: { studentId: string, status: string, message?: string }[],
 *   sentBy?: string|null,
 *   initiatedAt?: Date|null,
 * }} args
 */
export async function recordParentMessages({
  classSectionId,
  date,
  dateStr,
  messages,
  sentBy = null,
  initiatedAt = null,
}) {
  if (!messages?.length) return [];

  const attendanceId = attendanceHeaderId(classSectionId, dateStr);
  const now = new Date();
  const initiated = initiatedAt instanceof Date && !Number.isNaN(initiatedAt.getTime())
    ? initiatedAt
    : now;
  const results = [];

  for (const msg of messages) {
    const studentId = String(msg.studentId);
    const status = String(msg.status);
    const existing = await prisma.tblParent_Attendance_Messages.findFirst({
      where: {
        Class_Section_id: classSectionId,
        Attendance_Date: date,
        Student_Class_id: studentId,
        Status: status,
      },
    });

    if (existing) {
      results.push(
        await prisma.tblParent_Attendance_Messages.update({
          where: { Message_id: existing.Message_id },
          data: {
            Message_Body: msg.message || existing.Message_Body,
            Submitted_At: now,
            Sent_By: sentBy || existing.Sent_By,
            Int_Status: 1,
            Attendance_id: attendanceId,
          },
        })
      );
    } else {
      results.push(
        await prisma.tblParent_Attendance_Messages.create({
          data: {
            Message_id: newId('PAM'),
            Attendance_id: attendanceId,
            Class_Section_id: classSectionId,
            Attendance_Date: date,
            Student_Class_id: studentId,
            Status: status,
            Message_Body: msg.message || null,
            Initiated_At: initiated,
            Submitted_At: now,
            Sent_By: sentBy,
            Int_Status: 1,
          },
        })
      );
    }
  }

  return results;
}

/** Map studentId → last submitted status for UI dedupe. */
export function sentStatusMapFromMessages(messages) {
  const map = {};
  for (const m of messages || []) {
    map[String(m.studentId)] = m.status;
  }
  return map;
}
