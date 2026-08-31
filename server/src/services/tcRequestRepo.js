import { prisma } from '../lib/prisma.js';
import { newId } from '../lib/ids.js';
import { hasFullClassAccess, listAssignedSectionIds } from './schoolRepo.js';

/**
 * Status pipeline (DB values):
 * REQUESTED → FORWARDED (teacher verified / pending approval)
 * → APPROVED (management approved) → TC_ISSUED (certificate generated)
 * → INACTIVE (terminal soft-close; set with issue when student deactivated)
 * REJECTED at management stage.
 *
 * Legacy: older rows may be APPROVED with student already inactive (approve used to deactivate).
 */
export const TC_STATUS = {
  REQUESTED: 'REQUESTED',
  FORWARDED: 'FORWARDED',
  APPROVED: 'APPROVED',
  TC_ISSUED: 'TC_ISSUED',
  INACTIVE: 'INACTIVE',
  REJECTED: 'REJECTED',
};

/** Statuses that block a new active request for the same student. */
export const TC_OPEN_STATUSES = [
  TC_STATUS.REQUESTED,
  TC_STATUS.FORWARDED,
  TC_STATUS.APPROVED,
  TC_STATUS.TC_ISSUED,
];

function pick(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null) return row[key];
  }
  return null;
}

function serialize(row) {
  if (!row) return null;
  const status = String(pick(row, 'status', 'Status') || '').toUpperCase();
  const issuedOn = pick(row, 'issuedOn', 'Issued_On')
    ? new Date(pick(row, 'issuedOn', 'Issued_On')).toISOString()
    : null;
  const studentInactive =
    pick(row, 'studentInactive', 'student_inactive') === true ||
    pick(row, 'studentInactive', 'student_inactive') === 1 ||
    pick(row, 'studentInactive', 'student_inactive') === '1';

  return {
    id: String(pick(row, 'id', 'Request_id') || ''),
    studentId: pick(row, 'studentId', 'Student_id') || '',
    studentClassId: pick(row, 'studentClassId', 'Student_Class_id') || '',
    classSectionId: pick(row, 'classSectionId', 'Class_Section_id') || '',
    studentName: pick(row, 'studentName', 'Student_Name') || '',
    classLabel: pick(row, 'classLabel', 'Class_Label') || '',
    admissionNo: pick(row, 'admissionNo', 'Admission_No') || '',
    rollNo: pick(row, 'rollNo', 'Roll_No') || '',
    parentName: pick(row, 'parentName', 'Parent_Name') || '',
    parentContact: pick(row, 'parentContact', 'Parent_Contact') || '',
    reason: pick(row, 'reason', 'Reason') || '',
    status,
    source: pick(row, 'source', 'Source') || 'PARENT',
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
    issuedBy: pick(row, 'issuedBy', 'Issued_By') || null,
    issuedOn,
    signerName: pick(row, 'signerName', 'Signer_Name') || null,
    signerDesignation: pick(row, 'signerDesignation', 'Signer_Designation') || null,
    hasSignature: Boolean(pick(row, 'hasSignature', 'has_signature')),
    signedAt: pick(row, 'signedAt', 'Signed_At')
      ? new Date(pick(row, 'signedAt', 'Signed_At')).toISOString()
      : null,
    tcMimeType: pick(row, 'tcMimeType', 'Tc_Mime_Type') || null,
    tcFileName: pick(row, 'tcFileName', 'Tc_File_Name') || null,
    hasUploadedFile: Boolean(pick(row, 'hasUploadedFile', 'has_file')),
    tcNo: pick(row, 'tcNo', 'Tc_No') || null,
    hasTcDocument: Boolean(
      pick(row, 'hasTcDocument', 'has_tc') ||
        pick(row, 'hasUploadedFile', 'has_file') ||
        pick(row, 'tcHtml', 'Tc_Html') ||
        issuedOn
    ),
    studentInactive: Boolean(studentInactive) || status === TC_STATUS.INACTIVE || status === TC_STATUS.TC_ISSUED,
    createdOn: pick(row, 'createdOn', 'Created_On')
      ? new Date(pick(row, 'createdOn', 'Created_On')).toISOString()
      : null,
  };
}

const SELECT = `
  SELECT
    r."Request_id" AS id,
    r."Student_id" AS "studentId",
    r."Student_Class_id" AS "studentClassId",
    r."Class_Section_id" AS "classSectionId",
    r."Student_Name" AS "studentName",
    r."Class_Label" AS "classLabel",
    COALESCE(NULLIF(r."Admission_No", ''), s."Admission_No") AS "admissionNo",
    COALESCE(NULLIF(r."Roll_No", ''), sc."Roll_No", s."Roll_No") AS "rollNo",
    COALESCE(NULLIF(r."Parent_Name", ''), s."Father_Name", s."Mother_Name", s."Guardian_Name") AS "parentName",
    COALESCE(
      NULLIF(r."Parent_Contact", ''),
      s."Father_Number",
      s."Mother_Number",
      s."Guardian_Number"
    ) AS "parentContact",
    r."Reason" AS reason,
    r."Status" AS status,
    r."Source" AS source,
    r."Requested_By" AS "requestedBy",
    r."Forwarded_By" AS "forwardedBy",
    r."Forwarded_On" AS "forwardedOn",
    r."Reviewed_By" AS "reviewedBy",
    r."Reviewed_On" AS "reviewedOn",
    r."Review_Note" AS "reviewNote",
    r."Issued_By" AS "issuedBy",
    r."Issued_On" AS "issuedOn",
    r."Signer_Name" AS "signerName",
    r."Signer_Designation" AS "signerDesignation",
    CASE WHEN r."Signature_Image" IS NOT NULL AND length(r."Signature_Image") > 0 THEN true ELSE false END AS "hasSignature",
    r."Signed_At" AS "signedAt",
    r."Tc_Mime_Type" AS "tcMimeType",
    r."Tc_File_Name" AS "tcFileName",
    r."Tc_No" AS "tcNo",
    CASE WHEN r."Tc_File_Key" IS NOT NULL AND length(r."Tc_File_Key") > 0 THEN true ELSE false END AS "hasUploadedFile",
    CASE
      WHEN (r."Tc_Html" IS NOT NULL AND length(r."Tc_Html") > 0)
        OR (r."Tc_File_Key" IS NOT NULL AND length(r."Tc_File_Key") > 0)
      THEN true ELSE false
    END AS "hasTcDocument",
    CASE WHEN COALESCE(s."Int_Status", 1) = 0 OR COALESCE(sc."Int_Status", 1) = 0 THEN true ELSE false END AS "studentInactive",
    r."Created_On" AS "createdOn"
  FROM "tblTc_Requests" r
  LEFT JOIN "tblStudents" s ON s."Student_id" = r."Student_id"
  LEFT JOIN "tblStudent_Class" sc ON sc."student_class_id" = r."Student_Class_id"
`;

export async function findById(id) {
  const rows = await prisma.$queryRawUnsafe(`${SELECT} WHERE r."Request_id" = $1 LIMIT 1`, id);
  return serialize(rows[0]);
}

export async function getTcHtml(id) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       "Tc_Html" AS html,
       "Student_Name" AS name,
       "Status" AS status,
       "Signer_Name" AS "signerName",
       "Signer_Designation" AS "signerDesignation",
       "Signature_Image" AS "signatureImage",
       "Signed_At" AS "signedAt",
       "Tc_File_Key" AS "fileKey",
       "Tc_Mime_Type" AS "mimeType",
       "Tc_File_Name" AS "fileName"
     FROM "tblTc_Requests" WHERE "Request_id" = $1 LIMIT 1`,
    id
  );
  const row = rows[0];
  if (!row) return null;
  return {
    html: row.html || '',
    name: row.name || 'Student',
    status: String(row.status || '').toUpperCase(),
    signerName: row.signerName || null,
    signerDesignation: row.signerDesignation || null,
    signatureImage: row.signatureImage || null,
    signedAt: row.signedAt ? new Date(row.signedAt).toISOString() : null,
    fileKey: row.fileKey || null,
    mimeType: row.mimeType || null,
    fileName: row.fileName || null,
  };
}

function academicYearLabel(d = new Date()) {
  const y = d.getFullYear();
  const month = d.getMonth() + 1;
  const start = month >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Sequential school TC number, e.g. TC/2026-27/0001. */
export async function ensureTcNumber(id) {
  if (!id) return null;
  return prisma.$transaction(async (tx) => {
    const current = await tx.$queryRawUnsafe(
      `SELECT "Tc_No" AS "tcNo" FROM "tblTc_Requests" WHERE "Request_id" = $1 FOR UPDATE`,
      id
    );
    if (current[0]?.tcNo) return String(current[0].tcNo);

    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('tblTc_Requests.Tc_No'))`);

    const year = academicYearLabel();
    const prefix = `TC/${year}/`;
    const last = await tx.$queryRawUnsafe(
      `SELECT "Tc_No" AS "tcNo" FROM "tblTc_Requests"
       WHERE "Tc_No" LIKE $1
       ORDER BY "Tc_No" DESC
       LIMIT 1`,
      `${prefix}%`
    );
    const parsed = parseInt(String(last[0]?.tcNo || '').slice(prefix.length), 10);
    const next = `${prefix}${String(Number.isFinite(parsed) ? parsed + 1 : 1).padStart(4, '0')}`;
    await tx.$executeRawUnsafe(
      `UPDATE "tblTc_Requests"
       SET "Tc_No" = $2
       WHERE "Request_id" = $1 AND ("Tc_No" IS NULL OR "Tc_No" = '')`,
      id,
      next
    );
    return next;
  });
}

export async function listOpenForStudent(studentId) {
  const rows = await prisma.$queryRawUnsafe(
    `${SELECT}
     WHERE r."Student_id" = $1
       AND r."Int_Status" <> 0
       AND r."Status" IN ('REQUESTED','FORWARDED','APPROVED','TC_ISSUED','INACTIVE')
     ORDER BY r."Created_On" DESC`,
    studentId
  );
  return rows.map(serialize);
}

export async function listForParent(userId) {
  const rows = await prisma.$queryRawUnsafe(
    `${SELECT}
     WHERE r."Requested_By" = $1 AND r."Int_Status" <> 0
     ORDER BY r."Created_On" DESC`,
    userId
  );
  return rows.map(serialize);
}

export async function listForStaff(userId, role, { status, dateFrom, dateTo } = {}) {
  const params = [];
  const where = ['r."Int_Status" <> 0'];

  if (status) {
    const s = String(status).toUpperCase();
    if (s === 'INACTIVE') {
      where.push(`r."Status" IN ('INACTIVE','TC_ISSUED')`);
    } else if (s === 'PENDING_APPROVAL' || s === 'TEACHER_VERIFIED') {
      where.push(`r."Status" = 'FORWARDED'`);
    } else {
      params.push(s);
      where.push(`r."Status" = $${params.length}`);
    }
  }

  if (dateFrom) {
    params.push(dateFrom);
    where.push(`r."Created_On"::date >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(dateTo);
    where.push(`r."Created_On"::date <= $${params.length}::date`);
  }

  if (!hasFullClassAccess(role)) {
    const sections = await listAssignedSectionIds(userId);
    if (!sections.length) return [];
    const start = params.length + 1;
    sections.forEach((id) => params.push(id));
    const placeholders = sections.map((_, i) => `$${start + i}`).join(', ');
    where.push(`r."Class_Section_id" IN (${placeholders})`);
  }

  const rows = await prisma.$queryRawUnsafe(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY r."Created_On" DESC LIMIT 300`,
    ...params
  );
  return rows.map(serialize);
}

function fullName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim();
}

/** Load enrollment + student for staff/parent create. */
export async function loadEnrollmentForTc(studentClassId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       sc."student_class_id" AS "studentClassId",
       sc."Student_id" AS "studentId",
       sc."class_section_id" AS "classSectionId",
       sc."Roll_No" AS "enrollmentRoll",
       sc."Int_Status" AS "enrollmentStatus",
       s."First_Name" AS "firstName",
       s."Last_Name" AS "lastName",
       s."Admission_No" AS "admissionNo",
       s."Roll_No" AS "studentRoll",
       s."Father_Name" AS "fatherName",
       s."Mother_Name" AS "motherName",
       s."Guardian_Name" AS "guardianName",
       s."Father_Number" AS "fatherNumber",
       s."Mother_Number" AS "motherNumber",
       s."Guardian_Number" AS "guardianNumber",
       s."Int_Status" AS "studentStatus",
       c."Class_Name" AS "className",
       sec."Section_Name" AS "sectionName"
     FROM "tblStudent_Class" sc
     JOIN "tblStudents" s ON s."Student_id" = sc."Student_id"
     LEFT JOIN "tblClass_Section" cs ON cs."Class_Section_id" = sc."class_section_id"
     LEFT JOIN "tblClass" c ON c."Class_id" = cs."Class_id"
     LEFT JOIN "tblSection" sec ON sec."Section_id" = cs."Section_id"
     WHERE sc."student_class_id" = $1
     LIMIT 1`,
    studentClassId
  );
  const row = rows[0];
  if (!row) return null;
  const classLabel = [row.className, row.sectionName].filter(Boolean).join(' - ');
  return {
    studentClassId: row.studentClassId,
    studentId: row.studentId,
    classSectionId: row.classSectionId,
    studentName: fullName(row.firstName, row.lastName) || 'Student',
    classLabel,
    admissionNo: row.admissionNo || '',
    rollNo: String(row.enrollmentRoll || row.studentRoll || ''),
    parentName: row.fatherName || row.motherName || row.guardianName || '',
    parentContact: row.fatherNumber || row.motherNumber || row.guardianNumber || '',
    isInactive: row.studentStatus === 0 || row.enrollmentStatus === 0,
  };
}

export async function createRequest({
  studentId,
  studentClassId,
  classSectionId,
  studentName,
  classLabel,
  admissionNo,
  rollNo,
  parentName,
  parentContact,
  reason,
  requestedBy,
  source = 'PARENT',
}) {
  const id = newId('TCR');
  await prisma.$executeRawUnsafe(
    `INSERT INTO "tblTc_Requests"
      ("Request_id","Student_id","Student_Class_id","Class_Section_id",
       "Student_Name","Class_Label","Admission_No","Roll_No","Parent_Name","Parent_Contact",
       "Reason","Status","Source","Requested_By","Created_On","Int_Status")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),1)`,
    id,
    studentId,
    studentClassId,
    classSectionId,
    String(studentName || 'Student').slice(0, 255),
    classLabel ? String(classLabel).slice(0, 100) : null,
    admissionNo ? String(admissionNo).slice(0, 100) : null,
    rollNo ? String(rollNo).slice(0, 50) : null,
    parentName ? String(parentName).slice(0, 255) : null,
    parentContact ? String(parentContact).slice(0, 50) : null,
    reason ? String(reason).slice(0, 2000) : null,
    TC_STATUS.REQUESTED,
    source ? String(source).slice(0, 40) : 'PARENT',
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

/** Skip teacher + management steps when Settings say verification is not required. */
export async function skipToApproved(id, actorUserId, note = 'Verification not required') {
  await prisma.$executeRawUnsafe(
    `UPDATE "tblTc_Requests"
     SET "Status" = $2,
         "Forwarded_By" = COALESCE("Forwarded_By", $3),
         "Forwarded_On" = COALESCE("Forwarded_On", NOW()),
         "Reviewed_By" = $3,
         "Reviewed_On" = NOW(),
         "Review_Note" = $4
     WHERE "Request_id" = $1
       AND "Status" IN ($5, $6)
       AND "Int_Status" <> 0`,
    id,
    TC_STATUS.APPROVED,
    actorUserId,
    note ? String(note).slice(0, 500) : 'Verification not required',
    TC_STATUS.REQUESTED,
    TC_STATUS.FORWARDED
  );
  return findById(id);
}

export async function markIssued(
  id,
  {
    issuerId,
    tcHtml,
    terminalStatus = TC_STATUS.TC_ISSUED,
    signerName = null,
    signerDesignation = null,
    signatureImage = null,
    tcFileKey = null,
    tcMimeType = null,
    tcFileName = null,
  }
) {
  await prisma.$executeRawUnsafe(
    `UPDATE "tblTc_Requests"
     SET "Status" = $2,
         "Issued_By" = $3,
         "Issued_On" = NOW(),
         "Tc_Html" = $4,
         "Signer_Name" = $6,
         "Signer_Designation" = $7,
         "Signature_Image" = $8,
         "Signed_At" = CASE WHEN $8 IS NOT NULL AND length($8) > 0 THEN NOW() ELSE NULL END,
         "Tc_File_Key" = $9,
         "Tc_Mime_Type" = $10,
         "Tc_File_Name" = $11
     WHERE "Request_id" = $1 AND "Status" = $5 AND "Int_Status" <> 0`,
    id,
    terminalStatus,
    issuerId,
    tcHtml || null,
    TC_STATUS.APPROVED,
    signerName ? String(signerName).slice(0, 255) : null,
    signerDesignation ? String(signerDesignation).slice(0, 100) : null,
    signatureImage || null,
    tcFileKey ? String(tcFileKey).slice(0, 500) : null,
    tcMimeType ? String(tcMimeType).slice(0, 100) : null,
    tcFileName ? String(tcFileName).slice(0, 255) : null
  );
  return findById(id);
}

export async function saveGeneratedTcHtml(id, html) {
  if (!id || !html) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "tblTc_Requests"
     SET "Tc_Html" = $2
     WHERE "Request_id" = $1
       AND ("Tc_File_Key" IS NULL OR length("Tc_File_Key") = 0)`,
    id,
    html
  );
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

export function buildTcHtml({
  schoolName,
  studentName,
  admissionNo,
  rollNo,
  classLabel,
  parentName,
  reason,
  issuedOn,
  requestId,
  tcNo = null,
  logoDataUrl = null,
  signerName = null,
  signerDesignation = null,
  signatureDataUrl = null,
  draft = false,
}) {
  const when = issuedOn
    ? new Date(issuedOn).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
  const safe = (v) =>
    String(v || '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const designation = signerDesignation || 'Principal / Headmaster';
  const hasSigImg =
    signatureDataUrl &&
    typeof signatureDataUrl === 'string' &&
    /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(signatureDataUrl) &&
    signatureDataUrl.length < 1.5 * 1024 * 1024;
  const safeSigSrc = hasSigImg ? signatureDataUrl.replace(/"/g, '') : '';
  const authorityBlock = hasSigImg
    ? `<div class="sig auth">
        <img class="sig-img" src="${safeSigSrc}" alt="Authorized signature" />
        <div class="sig-name">${safe(signerName || '')}</div>
        <div class="sig-line">${safe(designation)}</div>
        <div class="sig-role">Authorized Signatory</div>
      </div>`
    : `<div class="sig auth">
        ${signerName ? `<div class="sig-typed">${safe(signerName)}</div>` : ''}
        <div class="sig-line">${safe(designation)}</div>
        <div class="sig-role">Authorized Signatory</div>
      </div>`;

  const draftBanner = draft
    ? `<p class="draft">DRAFT PREVIEW — not issued</p>`
    : '';

  const hasLogo =
    logoDataUrl &&
    typeof logoDataUrl === 'string' &&
    /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(logoDataUrl) &&
    logoDataUrl.length < 2.8 * 1024 * 1024;
  const logoHtml = hasLogo
    ? `<img class="logo" src="${logoDataUrl.replace(/"/g, '')}" alt="${safe(schoolName || 'School')} logo" />`
    : '';

  const tcNumber = String(tcNo || '').trim() || (draft ? 'To be allotted' : '—');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Transfer Certificate — ${safe(studentName)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 0; padding: 32px; background: #f8fafc; }
    .sheet { max-width: 720px; margin: 0 auto; border: 2px solid #312e81; padding: 36px 40px; background: #fff; }
    .header { text-align: center; }
    .logo { height: 96px; width: auto; max-width: 220px; object-fit: contain; display: block; margin: 0 auto 12px; }
    h1 { text-align: center; font-size: 22px; letter-spacing: 0.04em; margin: 0 0 4px; color: #312e81; }
    .school { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 8px; }
    .meta { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; font-size: 13px; color: #333; margin: 18px 0 8px; }
    .sub { text-align: center; font-size: 12px; color: #555; margin-bottom: 28px; }
    .draft { text-align: center; color: #b45309; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { padding: 8px 4px; vertical-align: top; }
    td.k { width: 38%; color: #444; }
    td.v { font-weight: 600; }
    .cert { margin-top: 24px; line-height: 1.55; font-size: 14px; text-align: justify; }
    .foot { margin-top: 48px; display: flex; justify-content: flex-end; align-items: flex-end; font-size: 13px; gap: 24px; }
    .sig { text-align: center; min-width: 160px; }
    .sig.auth { min-width: 200px; }
    .sig-img { max-height: 72px; max-width: 200px; object-fit: contain; display: block; margin: 0 auto 4px; }
    .sig-name { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
    .sig-typed { font-family: "Segoe Script", "Brush Script MT", cursive; font-size: 22px; color: #1e1b4b; margin-bottom: 8px; min-height: 36px; }
    .sig-line { border-top: 1px solid #333; margin-top: 8px; padding-top: 6px; font-weight: 600; }
    .sig-role { font-size: 11px; color: #555; margin-top: 2px; }
    @media print {
      body { padding: 0; background: #fff; }
      .sheet { border-width: 1.5px; }
      .draft { color: #92400e; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${draftBanner}
    <div class="header">
      ${logoHtml}
      <div class="school">${safe(schoolName || 'School')}</div>
      <h1>TRANSFER CERTIFICATE</h1>
    </div>
    <div class="meta">
      <span><strong>TC No.</strong> ${safe(tcNumber)}</span>
      <span>${draft ? 'Preview' : 'Issued'} ${safe(when)}</span>
    </div>
    <table>
      <tr><td class="k">TC No.</td><td class="v">${safe(tcNumber)}</td></tr>
      <tr><td class="k">Student Name</td><td class="v">${safe(studentName)}</td></tr>
      <tr><td class="k">Admission No.</td><td class="v">${safe(admissionNo)}</td></tr>
      <tr><td class="k">Roll No.</td><td class="v">${safe(rollNo)}</td></tr>
      <tr><td class="k">Class &amp; Section</td><td class="v">${safe(classLabel)}</td></tr>
      <tr><td class="k">Parent / Guardian</td><td class="v">${safe(parentName)}</td></tr>
      <tr><td class="k">Reason for leaving</td><td class="v">${safe(reason)}</td></tr>
    </table>
    <p class="cert">
      This is to certify that <strong>${safe(studentName)}</strong> was a bonafide student of
      <strong>${safe(schoolName || 'this school')}</strong> studying in <strong>${safe(classLabel)}</strong>.
      The Transfer Certificate is issued on request. The student's academic and attendance records
      are retained by the school and have not been deleted.
    </p>
    <div class="foot">
      ${authorityBlock}
    </div>
  </div>
</body>
</html>`;
}
