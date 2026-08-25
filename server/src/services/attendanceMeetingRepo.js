import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { newId, toDateString, parseDateOnly, fullName } from '../lib/ids.js';
import { MEETING_STATUSES } from '../lib/attendanceIntelligenceConfig.js';

function mapMeeting(row) {
  if (!row) return null;
  return {
    id: row.Meeting_id,
    studentClassId: row.student_class_id,
    studentRecordId: row.Student_id || null,
    parentName: row.Parent_Name || '',
    reason: row.Reason || '',
    meetingDate: toDateString(row.Meeting_Date),
    staffName: row.Staff_Name || '',
    staffUserId: row.Staff_User_id || null,
    discussionNotes: row.Discussion_Notes || '',
    outcome: row.Outcome || '',
    followUpDate: toDateString(row.Follow_Up_Date),
    status: row.Status || 'Requested',
    createdBy: row.Created_By || null,
    createdOn: row.Created_On,
    updatedOn: row.Updated_On,
  };
}

export async function listMeetings({ status, studentClassId, followUpOnly } = {}) {
  const clauses = [];
  const params = [];
  if (status) {
    params.push(String(status));
    clauses.push(`"Status" = $${params.length}`);
  }
  if (studentClassId) {
    params.push(String(studentClassId));
    clauses.push(`"student_class_id" = $${params.length}`);
  }
  if (followUpOnly) {
    clauses.push(`("Status" = 'Follow-up Required' OR ("Follow_Up_Date" IS NOT NULL AND "Status" <> 'Closed'))`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM "tblAttendance_Meetings" ${where} ORDER BY "Meeting_Date" DESC, "Created_On" DESC LIMIT 500`,
    ...params
  );
  return (rows || []).map(mapMeeting);
}

export async function getMeeting(id) {
  const rows = await prisma.$queryRaw(
    Prisma.sql`SELECT * FROM "tblAttendance_Meetings" WHERE "Meeting_id" = ${id} LIMIT 1`
  );
  return mapMeeting(rows?.[0]);
}

export async function createMeeting(input, user) {
  const id = newId('MTG-');
  const status = MEETING_STATUSES.includes(input.status) ? input.status : 'Requested';
  const meetingDate = parseDateOnly(input.meetingDate) || new Date();
  const followUp = parseDateOnly(input.followUpDate);
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO "tblAttendance_Meetings" (
      "Meeting_id", "student_class_id", "Student_id", "Parent_Name", "Reason",
      "Meeting_Date", "Staff_Name", "Staff_User_id", "Discussion_Notes", "Outcome",
      "Follow_Up_Date", "Status", "Created_By"
    ) VALUES (
      ${id}, ${input.studentClassId}, ${input.studentRecordId || null}, ${input.parentName || null},
      ${input.reason}, ${meetingDate}, ${input.staffName || user?.name || null},
      ${user?.id || null}, ${input.discussionNotes || null}, ${input.outcome || null},
      ${followUp}, ${status}, ${user?.id || null}
    )`
  );
  return getMeeting(id);
}

export async function updateMeeting(id, input, user) {
  const existing = await getMeeting(id);
  if (!existing) return null;
  const status = MEETING_STATUSES.includes(input.status) ? input.status : existing.status;
  const meetingDate = parseDateOnly(input.meetingDate) || parseDateOnly(existing.meetingDate);
  const followUp =
    input.followUpDate === '' || input.followUpDate === null
      ? null
      : parseDateOnly(input.followUpDate) || parseDateOnly(existing.followUpDate);
  await prisma.$executeRaw(
    Prisma.sql`UPDATE "tblAttendance_Meetings" SET
      "Parent_Name" = ${input.parentName ?? existing.parentName},
      "Reason" = ${input.reason ?? existing.reason},
      "Meeting_Date" = ${meetingDate},
      "Staff_Name" = ${input.staffName ?? existing.staffName},
      "Staff_User_id" = ${user?.id || existing.staffUserId},
      "Discussion_Notes" = ${input.discussionNotes ?? existing.discussionNotes},
      "Outcome" = ${input.outcome ?? existing.outcome},
      "Follow_Up_Date" = ${followUp},
      "Status" = ${status},
      "Updated_On" = NOW()
    WHERE "Meeting_id" = ${id}`
  );
  return getMeeting(id);
}

export async function meetingCounts() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "Status" = 'Scheduled' AND "Meeting_Date" = CURRENT_DATE)::int AS today,
      COUNT(*) FILTER (WHERE "Status" IN ('Requested', 'Scheduled', 'Follow-up Required'))::int AS open,
      COUNT(*) FILTER (WHERE "Status" = 'Follow-up Required'
        OR ("Follow_Up_Date" IS NOT NULL AND "Follow_Up_Date" <= CURRENT_DATE + INTERVAL '7 days'
            AND "Status" <> 'Closed'))::int AS followups
    FROM "tblAttendance_Meetings"
  `);
  return rows?.[0] || { total: 0, today: 0, open: 0, followups: 0 };
}

export async function listNotes(studentClassId) {
  const rows = await prisma.$queryRaw(
    Prisma.sql`SELECT * FROM "tblAttendance_Notes"
      WHERE "student_class_id" = ${studentClassId}
      ORDER BY "Created_On" DESC LIMIT 100`
  );
  return (rows || []).map((r) => ({
    id: r.Note_id,
    studentClassId: r.student_class_id,
    text: r.Note_Text,
    createdBy: r.Created_By,
    createdByName: r.Created_By_Name || '',
    createdOn: r.Created_On,
  }));
}

export async function addNote(studentClassId, text, user) {
  const id = newId('NOTE-');
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO "tblAttendance_Notes"
      ("Note_id", "student_class_id", "Note_Text", "Created_By", "Created_By_Name")
      VALUES (${id}, ${studentClassId}, ${text}, ${user?.id || null}, ${user?.name || null})`
  );
  const notes = await listNotes(studentClassId);
  return notes.find((n) => n.id === id);
}

export async function enrichMeetingsWithStudents(meetings) {
  if (!meetings.length) return [];
  const ids = [...new Set(meetings.map((m) => m.studentClassId))];
  const enrollments = await prisma.tblStudent_Class.findMany({
    where: { student_class_id: { in: ids } },
    include: {
      tblStudents: true,
      tblClass_Section: { include: { tblClass: true, tblSection: true } },
    },
  });
  const byId = new Map(
    enrollments.map((sc) => [
      sc.student_class_id,
      {
        name: fullName(sc.tblStudents?.First_Name, sc.tblStudents?.Last_Name) || 'Student',
        className: sc.tblClass_Section?.tblClass?.Class_Name || '',
        sectionName: sc.tblClass_Section?.tblSection?.Section_Name || '',
        rollNo: sc.Roll_No || '',
        studentRecordId: sc.Student_id,
        fatherName: sc.tblStudents?.Father_Name || '',
        motherName: sc.tblStudents?.Mother_Name || '',
        guardianName: sc.tblStudents?.Guardian_Name || '',
      },
    ])
  );
  return meetings.map((m) => ({
    ...m,
    student: byId.get(m.studentClassId) || null,
  }));
}

/**
 * WhatsApp parent that a meeting was scheduled. Returns send summary.
 * Status stays Scheduled until staff mark the meeting Completed after it happens.
 */
export async function notifyParentOfMeeting(meeting, student = null) {
  const { sendParentMeetingWhatsApp } = await import('../lib/whatsapp.js');
  const { parentContactsForEnrollments, resolveRecipientPhones, normalizePhone } = await import(
    '../lib/sms.js'
  );

  const contacts = await parentContactsForEnrollments([meeting.studentClassId], prisma);
  const contact = contacts.get(meeting.studentClassId) || {};
  const phones = resolveRecipientPhones(contact, 'both');
  const unique = [];
  const seen = new Set();
  for (const raw of phones) {
    const phone = normalizePhone(raw);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    unique.push(phone);
  }

  const studentName = student?.name || contact.name || 'your ward';
  const parentName =
    meeting.parentName ||
    student?.fatherName ||
    student?.motherName ||
    student?.guardianName ||
    'Parent';
  const reason =
    meeting.discussionNotes?.trim() ||
    meeting.reason ||
    'Please meet the school regarding your ward\'s attendance.';
  const title = 'Parent meeting scheduled';
  const message = [
    `Dear ${parentName},`,
    `A meeting has been scheduled regarding ${studentName}.`,
    `Reason: ${reason}.`,
    meeting.meetingDate ? `Meeting date: ${meeting.meetingDate}.` : null,
    meeting.staffName ? `Staff / Principal: ${meeting.staffName}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  if (!unique.length) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      missingPhones: 1,
      title,
      message,
    };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let error = null;
  let reasonCode = null;
  for (const toPhone of unique) {
    const r = await sendParentMeetingWhatsApp({
      toPhone,
      parentName,
      studentName,
      className: student?.className,
      sectionName: student?.sectionName,
      reason,
      meetingDate: meeting.meetingDate,
      staffName: meeting.staffName,
    });
    if (r.skipped) {
      skipped += 1;
      if (!reasonCode && r.reason) reasonCode = r.reason;
    } else if (r.ok) {
      sent += 1;
    } else {
      failed += 1;
      if (!error && r.error) error = r.error;
    }
  }

  return {
    attempted: unique.length,
    sent,
    failed,
    skipped,
    missingPhones: 0,
    error,
    reason: reasonCode,
    title,
    message,
  };
}
