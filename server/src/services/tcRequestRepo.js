import { prisma } from '../lib/prisma.js';
import { newId } from '../lib/ids.js';
import { hasFullClassAccess, listAssignedSectionIds } from './schoolRepo.js';

export const TC_STATUS = {
  REQUESTED: 'REQUESTED',
  FORWARDED: 'FORWARDED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

function pick(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null) return row[key];
  }
  return null;
}

function serialize(row) {
  if (!row) return null;
  return {
    id: String(pick(row, 'id', 'Request_id') || ''),
    studentId: pick(row, 'studentId', 'Student_id') || '',
    studentClassId: pick(row, 'studentClassId', 'Student_Class_id') || '',
    classSectionId: pick(row, 'classSectionId', 'Class_Section_id') || '',
    studentName: pick(row, 'studentName', 'Student_Name') || '',
    classLabel: pick(row, 'classLabel', 'Class_Label') || '',
    reason: pick(row, 'reason', 'Reason') || '',
    status: String(pick(row, 'status', 'Status') || '').toUpperCase(),
    requestedBy: pick(row, 'requestedBy', 'Requested_By') || '',
    forwardedBy: pick(row, 'forwardedBy', 'Forwarded_By') || null,
    forwardedOn: pick(row, 'forwardedOn', 'Forwarded_On')
      ? new Date(pick(row, 'forwardedOn', 'Forwarded_On')).toISOString()
      : null,
    reviewedBy: pick(row, 'reviewedBy', 'Reviewed_By') || null,
    reviewedOn: pick(row, 'reviewedOn', 'Reviewed_On')
      ? new Date(pick(row, 'reviewedOn', 'Reviewed_On')).toISOString()
      : null,
    reviewNote: pick(row, 'reviewNote', 'Review_Note') || '',
    createdOn: pick(row, 'createdOn', 'Created_On')
      ? new Date(pick(row, 'createdOn', 'Created_On')).toISOString()
      : null,
  };
}

const SELECT = `
  SELECT
    "Request_id" AS id,
    "Student_id" AS "studentId",
    "Student_Class_id" AS "studentClassId",
    "Class_Section_id" AS "classSectionId",
    "Student_Name" AS "studentName",
    "Class_Label" AS "classLabel",
    "Reason" AS reason,
    "Status" AS status,
    "Requested_By" AS "requestedBy",
    "Forwarded_By" AS "forwardedBy",
    "Forwarded_On" AS "forwardedOn",
    "Reviewed_By" AS "reviewedBy",
    "Reviewed_On" AS "reviewedOn",
    "Review_Note" AS "reviewNote",
    "Created_On" AS "createdOn"
  FROM "tblTc_Requests"
`;

export async function findById(id) {
  const rows = await prisma.$queryRawUnsafe(`${SELECT} WHERE "Request_id" = $1 LIMIT 1`, id);
  return serialize(rows[0]);
}

export async function listOpenForStudent(studentId) {
  const rows = await prisma.$queryRawUnsafe(
    `${SELECT}
     WHERE "Student_id" = $1
       AND "Int_Status" <> 0
       AND "Status" IN ('REQUESTED','FORWARDED')
     ORDER BY "Created_On" DESC`,
    studentId
  );
  return rows.map(serialize);
}

export async function listForParent(userId) {
  const rows = await prisma.$queryRawUnsafe(
    `${SELECT}
     WHERE "Requested_By" = $1 AND "Int_Status" <> 0
     ORDER BY "Created_On" DESC`,
    userId
  );
  return rows.map(serialize);
}

export async function listForStaff(userId, role, { status } = {}) {
  const params = [];
  const where = ['"Int_Status" <> 0'];
  if (status) {
    params.push(String(status).toUpperCase());
    where.push(`"Status" = $${params.length}`);
  }
  if (!hasFullClassAccess(role)) {
    const sections = await listAssignedSectionIds(userId);
    if (!sections.length) return [];
    const start = params.length + 1;
    sections.forEach((id) => params.push(id));
    const placeholders = sections.map((_, i) => `$${start + i}`).join(', ');
    where.push(`"Class_Section_id" IN (${placeholders})`);
  }
  const rows = await prisma.$queryRawUnsafe(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY "Created_On" DESC LIMIT 200`,
    ...params
  );
  return rows.map(serialize);
}

export async function createRequest({
  studentId,
  studentClassId,
  classSectionId,
  studentName,
  classLabel,
  reason,
  requestedBy,
}) {
  const id = newId('TCR');
  await prisma.$executeRawUnsafe(
    `INSERT INTO "tblTc_Requests"
      ("Request_id","Student_id","Student_Class_id","Class_Section_id",
       "Student_Name","Class_Label","Reason","Status","Requested_By","Created_On","Int_Status")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),1)`,
    id,
    studentId,
    studentClassId,
    classSectionId,
    String(studentName || 'Student').slice(0, 255),
    classLabel ? String(classLabel).slice(0, 100) : null,
    reason ? String(reason).slice(0, 2000) : null,
    TC_STATUS.REQUESTED,
    requestedBy
  );
  return findById(id);
}

export async function markForwarded(id, teacherUserId) {
  await prisma.$executeRawUnsafe(
    `UPDATE "tblTc_Requests"
     SET "Status" = $2, "Forwarded_By" = $3, "Forwarded_On" = NOW()
     WHERE "Request_id" = $1 AND "Status" = $4 AND "Int_Status" <> 0`,
    id,
    TC_STATUS.FORWARDED,
    teacherUserId,
    TC_STATUS.REQUESTED
  );
  return findById(id);
}

export async function markReviewed(id, { status, reviewerId, note }) {
  await prisma.$executeRawUnsafe(
    `UPDATE "tblTc_Requests"
     SET "Status" = $2, "Reviewed_By" = $3, "Reviewed_On" = NOW(), "Review_Note" = $4
     WHERE "Request_id" = $1 AND "Status" = $5 AND "Int_Status" <> 0`,
    id,
    status,
    reviewerId,
    note ? String(note).slice(0, 500) : null,
    TC_STATUS.FORWARDED
  );
  return findById(id);
}

/** Soft-deactivate: keep the student row, mark inactive. Never deletes. */
export async function deactivateStudentKeepRecord(studentId, actorUserId) {
  await prisma.$transaction([
    prisma.tblStudents.update({
      where: { Student_id: studentId },
      data: {
        Int_Status: 0,
        Changed_By: actorUserId || null,
        Changed_On: new Date(),
      },
    }),
    prisma.tblStudent_Class.updateMany({
      where: { Student_id: studentId },
      data: { Int_Status: 0 },
    }),
  ]);
}
