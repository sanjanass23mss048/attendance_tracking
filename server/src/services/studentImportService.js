import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { newId, parseDateOnly, splitFullName, toDateString } from '../lib/ids.js';
import { saveFile, readFile, absolutePath } from '../lib/storage.js';

export const IMPORT_STATUSES = {
  VALIDATING: 'VALIDATING',
  VALIDATED: 'VALIDATED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
  FAILED: 'FAILED',
};

export const TEMPLATE_HEADERS = [
  'Class',
  'Section',
  'Roll Number',
  'Student Name',
  "Father's Name",
  "Mother's Name",
  'Email-Id',
  'Blood Group',
  "Father's No",
  "Mother's No",
];

/** Accept common school spreadsheet header names (any column order). */
const HEADER_ALIASES = {
  className: ['class', 'class name', 'std', 'standard', 'grade', 'class/std'],
  sectionName: ['section', 'sec', 'section name'],
  rollNo: ['roll number', 'roll no', 'roll no.', 'roll', 'r.no', 'r no', 'rollnum'],
  name: ['student name', 'name', 'student', 'pupil name', 'child name'],
  fatherName: ["father's name", 'father name', 'father'],
  motherName: ["mother's name", 'mother name', 'mother'],
  parentEmail: [
    'email-id',
    'email id',
    'emailid',
    'parent email',
    'email',
    'parent e-mail',
    'e-mail',
    'e mail',
  ],
  bloodGroup: ['blood group', 'blood grp', 'bloodgroup', 'bld grp', 'b.g', 'bg'],
  fatherMobile: [
    "father's no",
    "father's no.",
    'father no',
    'father no.',
    'father number',
    "father's number",
    'father mobile',
    'father phone',
  ],
  motherMobile: [
    "mother's no",
    "mother's no.",
    'mother no',
    'mother no.',
    'mother number',
    "mother's number",
    'mother mobile',
    'mother phone',
  ],
  admissionNo: [
    'admission number',
    'admission no',
    'admission no.',
    'adm no',
    'adm. no',
    'admission',
    'admn',
  ],
  gender: ['gender', 'sex'],
  dob: ['date of birth', 'dob', 'd.o.b', 'birth date', 'birthday'],
  parentName: ['parent name', 'guardian name', 'parent / guardian'],
  parentMobile: [
    'parent mobile number',
    'parent mobile',
    'parent phone',
    'mobile',
    'mobile number',
    'phone',
    'phone number',
    'contact',
  ],
  address: ['address', 'residential address', 'home address'],
};

const REQUIRED_FIELD_KEYS = ['className', 'sectionName', 'rollNo', 'name'];

function resolveHeaderField(headerText) {
  const key = normalizeKey(headerText);
  if (!key) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => normalizeKey(a) === key)) return field;
  }
  return null;
}

/**
 * Map row-1 headers to field keys by name (order does not matter).
 * Requires Class, Section, Roll Number, Student Name.
 */
function mapHeaderColumns(headerRow) {
  const columnMap = {}; // fieldKey -> 1-based column index
  const maxCol = Math.max(headerRow.cellCount || 0, TEMPLATE_HEADERS.length, 30);
  for (let c = 1; c <= maxCol; c += 1) {
    const label = normalizeText(cellToString(headerRow.getCell(c).value));
    if (!label) continue;
    const field = resolveHeaderField(label);
    if (field && columnMap[field] == null) columnMap[field] = c;
  }
  const missing = REQUIRED_FIELD_KEYS.filter((k) => columnMap[k] == null);
  return { columnMap, missing };
}

function rowPayloadFromMappedColumns(excelRow, columnMap) {
  const payload = {
    className: '',
    sectionName: '',
    rollNo: '',
    name: '',
    fatherName: '',
    motherName: '',
    parentEmail: '',
    bloodGroup: '',
    fatherMobile: '',
    motherMobile: '',
    admissionNo: '',
    gender: '',
    dob: '',
    parentName: '',
    parentMobile: '',
    address: '',
  };
  for (const [field, col] of Object.entries(columnMap)) {
    payload[field] = normalizeText(cellToString(excelRow.getCell(col).value));
  }
  return payload;
}

function rowValuesInTemplateOrder(r) {
  return [
    r.className || '',
    r.sectionName || '',
    r.rollNo || '',
    r.name || '',
    r.fatherName || r.parentName || '',
    r.motherName || '',
    r.parentEmail || '',
    r.bloodGroup || '',
    r.fatherMobile || r.parentMobile || '',
    r.motherMobile || '',
  ];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeClassName(value) {
  let t = normalizeText(value);
  t = t.replace(/^class\s+/i, '').trim();
  return t;
}

function normalizeSectionName(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeGender(value) {
  const t = normalizeKey(value);
  if (!t) return null;
  if (['male', 'm', 'boy'].includes(t)) return 'Male';
  if (['female', 'f', 'girl'].includes(t)) return 'Female';
  if (['other', 'o', 'non-binary', 'nonbinary'].includes(t)) return 'Other';
  return null;
}

function normalizePhone(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  digits = digits.replace(/\D/g, '');
  return digits;
}

function isValidPhone(digits) {
  return /^\d{10}$/.test(digits);
}

function cellToString(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    if (value.richText) return value.richText.map((p) => p.text || '').join('');
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function parseDobValue(value) {
  if (value == null || value === '') return { ok: true, date: null, display: '' };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString().slice(0, 10);
    return { ok: true, date: parseDateOnly(iso), display: iso };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    if (Number.isNaN(d.getTime())) return { ok: false, date: null, display: String(value) };
    const iso = d.toISOString().slice(0, 10);
    return { ok: true, date: parseDateOnly(iso), display: iso };
  }
  const text = normalizeText(cellToString(value));
  if (!text) return { ok: true, date: null, display: '' };

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = parseDateOnly(text);
    return date ? { ok: true, date, display: text } : { ok: false, date: null, display: text };
  }

  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const date = parseDateOnly(iso);
    return date ? { ok: true, date, display: iso } : { ok: false, date: null, display: text };
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const iso = parsed.toISOString().slice(0, 10);
    return { ok: true, date: parseDateOnly(iso), display: iso };
  }
  return { ok: false, date: null, display: text };
}

export async function writeImportAudit(event) {
  await prisma.tblStudent_Import_Audit.create({
    data: {
      audit_id: newId('SIA'),
      import_id: event.importId || null,
      event_type: event.eventType,
      user_id: event.userId || null,
      student_id: event.studentId || null,
      admission_no: event.admissionNo || null,
      class_name: event.className || null,
      section_name: event.sectionName || null,
      file_name: event.fileName || null,
      total_rows: event.totalRows ?? null,
      successful_count: event.successfulCount ?? null,
      failed_count: event.failedCount ?? null,
      duplicate_count: event.duplicateCount ?? null,
      details: event.details || null,
    },
  });
}

export async function buildTemplateBuffer() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Presence';
  const ws = wb.addWorksheet('Students');
  ws.columns = TEMPLATE_HEADERS.map((h) => ({
    header: h,
    width: Math.max(14, h.length + 2),
  }));
  ws.getRow(1).font = { bold: true };
  // Minimal class-register sample
  ws.addRow(['LKG', 'A', '1', 'Diya Sharma']);
  ws.addRow(['LKG', 'A', '2', 'Aarav Kumar']);
  ws.addRow(['LKG', 'A', '3', 'Ananya Iyer']);
  const notes = wb.addWorksheet('Notes');
  notes.getCell('A1').value =
    'Required: Class, Section, Roll Number, Student Name.';
  notes.getCell('A2').value =
    "Optional: Father's Name, Mother's Name, Email-Id, Blood Group, Father's No, Mother's No.";
  notes.getCell('A3').value =
    'Column order can vary. Common headers like Roll No / Std / Sec are accepted.';
  notes.getCell('A4').value =
    'Do not invent new Class/Section names — they must already exist in Presence.';
  notes.getCell('A5').value =
    "Phone numbers should be 10 digits. Email-Id is the parent/guardian email.";
  notes.getColumn(1).width = 100;
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Build a template-compatible workbook from draft row objects (chit OCR / manual). */
export async function buildWorkbookFromRows(rows = []) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Presence';
  const ws = wb.addWorksheet('Students');
  ws.columns = TEMPLATE_HEADERS.map((h) => ({ header: h, width: Math.max(14, h.length + 2) }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow(rowValuesInTemplateOrder(r));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function loadSectionIndex() {
  const rows = await prisma.tblClass_Section.findMany({
    where: { int_status: 1 },
    include: { tblClass: true, tblSection: true },
  });
  const byKey = new Map();
  for (const cs of rows) {
    const className = normalizeClassName(cs.tblClass?.Class_Name || '');
    const sectionName = normalizeSectionName(cs.tblSection?.Section_Name || '');
    if (!className || !sectionName) continue;
    byKey.set(`${normalizeKey(className)}|${normalizeKey(sectionName)}`, cs);
  }
  return byKey;
}

function resolveSection(index, className, sectionName) {
  const ck = normalizeKey(normalizeClassName(className));
  const sk = normalizeKey(normalizeSectionName(sectionName));
  return index.get(`${ck}|${sk}`) || null;
}

async function loadExistingDuplicateSets() {
  const students = await prisma.tblStudents.findMany({
    where: { Int_Status: { not: 0 } },
    select: {
      Student_id: true,
      Admission_No: true,
      tblStudent_Class: {
        where: { Int_Status: { not: 0 } },
        select: { class_section_id: true, Roll_No: true },
      },
    },
  });
  const admissions = new Set();
  const rollSection = new Set();
  for (const st of students) {
    const adm = normalizeKey(st.Admission_No || '');
    if (adm) admissions.add(adm);
    for (const en of st.tblStudent_Class) {
      const roll = normalizeKey(en.Roll_No || '');
      if (roll && en.class_section_id) {
        rollSection.add(`${en.class_section_id}|${roll}`);
      }
    }
  }
  return { admissions, rollSection };
}

/**
 * Validate workbook buffer. Does not create students.
 * @returns {{ rows, summary, error }}
 */
export async function validateWorkbookBuffer(buffer) {
  let workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
  } catch {
    return { error: 'Invalid workbook. Please upload a valid .xlsx file.' };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { error: 'Empty Excel file.' };
  }

  const headerRow = sheet.getRow(1);
  const { columnMap, missing } = mapHeaderColumns(headerRow);
  if (missing.length) {
    const labels = {
      className: 'Class',
      sectionName: 'Section',
      rollNo: 'Roll Number',
      name: 'Student Name',
    };
    return {
      error: `Invalid Excel template. Missing required columns: ${missing
        .map((k) => labels[k] || k)
        .join(', ')}. Use Class, Section, Roll Number and Student Name (any order).`,
    };
  }

  const sectionIndex = await loadSectionIndex();
  const existing = await loadExistingDuplicateSets();
  const seenAdmissions = new Set();
  const seenRollSection = new Set();

  const rows = [];
  let valid = 0;
  let failed = 0;
  let duplicate = 0;

  const usedCols = Object.values(columnMap);
  const lastCol = usedCols.length ? Math.max(...usedCols) : TEMPLATE_HEADERS.length;
  const lastRow = sheet.actualRowCount || sheet.rowCount || 1;
  for (let r = 2; r <= lastRow; r += 1) {
    const excelRow = sheet.getRow(r);
    let empty = true;
    for (let c = 1; c <= lastCol; c += 1) {
      if (normalizeText(cellToString(excelRow.getCell(c).value))) {
        empty = false;
        break;
      }
    }
    if (empty) continue;

    const raw = rowPayloadFromMappedColumns(excelRow, columnMap);
    const errors = [];
    const dobCell = columnMap.dob ? excelRow.getCell(columnMap.dob).value : null;
    const dobParsed = parseDobValue(dobCell != null && dobCell !== '' ? dobCell : raw.dob);

    if (!raw.className) errors.push('Class is required.');
    if (!raw.sectionName) errors.push('Section is required.');
    if (!raw.rollNo) errors.push('Roll number is required.');
    const rollNum = Number.parseInt(String(raw.rollNo).replace(/[^\d]/g, ''), 10);
    if (raw.rollNo && (!Number.isInteger(rollNum) || rollNum <= 0)) {
      errors.push('Roll number must be a positive integer.');
    }
    if (!raw.name) errors.push('Student name is required.');

    if (raw.gender && !normalizeGender(raw.gender)) {
      errors.push('Invalid gender. Use Male, Female, or Other.');
    }
    if (raw.dob || (dobCell != null && dobCell !== '')) {
      if (!dobParsed.ok || (raw.dob && !dobParsed.date && normalizeText(raw.dob))) {
        errors.push('Invalid date of birth.');
      }
    }
    if (raw.parentEmail && !EMAIL_RE.test(raw.parentEmail)) {
      errors.push('Invalid email.');
    }
    const fatherPhone = normalizePhone(raw.fatherMobile || raw.parentMobile);
    const motherPhone = normalizePhone(raw.motherMobile);
    if ((raw.fatherMobile || raw.parentMobile) && !isValidPhone(fatherPhone)) {
      errors.push("Invalid father's number.");
    }
    if (raw.motherMobile && !isValidPhone(motherPhone)) {
      errors.push("Invalid mother's number.");
    }

    let section = null;
    if (raw.className && raw.sectionName) {
      section = resolveSection(sectionIndex, raw.className, raw.sectionName);
      if (!section) {
        const classOnly = [...sectionIndex.keys()].some((k) =>
          k.startsWith(`${normalizeKey(normalizeClassName(raw.className))}|`)
        );
        if (!classOnly) errors.push('Class does not exist.');
        else errors.push('Section does not belong to the selected class.');
      }
    }

    const admissionKey = normalizeKey(raw.admissionNo);
    const rollKey = rollNum ? String(rollNum) : '';
    const sectionId = section?.Class_Section_id || null;
    const rollSectionKey = sectionId && rollKey ? `${sectionId}|${normalizeKey(rollKey)}` : null;

    let category = 'valid';
    let errorReason = '';

    if (errors.length) {
      category = 'failed';
      errorReason = errors.join(' ');
      failed += 1;
    } else {
      const dupReasons = [];
      if (admissionKey && (existing.admissions.has(admissionKey) || seenAdmissions.has(admissionKey))) {
        dupReasons.push('Duplicate admission number.');
      }
      if (
        rollSectionKey &&
        (existing.rollSection.has(rollSectionKey) || seenRollSection.has(rollSectionKey))
      ) {
        dupReasons.push('Duplicate roll number in class/section.');
      }
      if (dupReasons.length) {
        category = 'duplicate';
        errorReason = dupReasons.join(' ');
        duplicate += 1;
      } else {
        valid += 1;
        if (admissionKey) seenAdmissions.add(admissionKey);
        if (rollSectionKey) seenRollSection.add(rollSectionKey);
      }
    }

    rows.push({
      excelRow: r,
      category,
      errorReason,
      admissionNo: raw.admissionNo,
      rollNo: rollKey || raw.rollNo,
      name: raw.name,
      gender: normalizeGender(raw.gender),
      dob: dobParsed.display || '',
      className: normalizeClassName(raw.className),
      sectionName: normalizeSectionName(raw.sectionName),
      fatherName: raw.fatherName || raw.parentName,
      motherName: raw.motherName,
      parentName: raw.fatherName || raw.parentName,
      fatherMobile: fatherPhone || raw.fatherMobile || raw.parentMobile,
      motherMobile: motherPhone || raw.motherMobile,
      parentMobile: fatherPhone || motherPhone || raw.fatherMobile || raw.parentMobile,
      parentEmail: raw.parentEmail.toLowerCase(),
      bloodGroup: raw.bloodGroup,
      address: raw.address,
      sectionId,
      academicYear: section?.tblClass?.Academic_Year || null,
    });
  }

  if (!rows.length) {
    return { error: 'Empty Excel file. No student rows found.' };
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows: valid,
      failedRows: failed,
      duplicateRows: duplicate,
    },
  };
}

export async function buildErrorReportBuffer(rows) {
  const failed = rows.filter((r) => r.category === 'failed' || r.category === 'duplicate');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Errors');
  const headers = [
    'Original Excel Row Number',
    ...TEMPLATE_HEADERS,
    'Error Reason',
    'Result Category',
  ];
  ws.columns = headers.map((h) => ({ header: h, width: Math.max(14, h.length + 1) }));
  ws.getRow(1).font = { bold: true };
  for (const r of failed) {
    ws.addRow([
      r.excelRow,
      ...rowValuesInTemplateOrder(r),
      r.errorReason,
      r.category === 'duplicate' ? 'Duplicate / Skipped' : 'Failed',
    ]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function validationStorageKey(importId) {
  return `student-imports/${importId}/validation.json`;
}

function errorStorageKey(importId) {
  return `student-imports/${importId}/errors.xlsx`;
}

export async function createValidatedImport({ userId, fileName, buffer }) {
  const importId = newId('SIM');
  const history = await prisma.tblStudent_Import_History.create({
    data: {
      import_id: importId,
      uploaded_by: userId,
      original_file_name: fileName.slice(0, 255),
      status: IMPORT_STATUSES.VALIDATING,
      total_rows: 0,
    },
  });

  await writeImportAudit({
    eventType: 'STUDENT_BULK_IMPORT_STARTED',
    importId,
    userId,
    fileName,
  });

  const result = await validateWorkbookBuffer(buffer);
  if (result.error) {
    await prisma.tblStudent_Import_History.update({
      where: { import_id: importId },
      data: {
        status: IMPORT_STATUSES.FAILED,
        completed_at: new Date(),
        updated_at: new Date(),
      },
    });
    await writeImportAudit({
      eventType: 'STUDENT_BULK_IMPORT_COMPLETED',
      importId,
      userId,
      fileName,
      details: result.error,
      failedCount: 0,
    });
    const err = new Error(result.error);
    err.status = 400;
    throw err;
  }

  const validationKey = validationStorageKey(importId);
  await saveFile(validationKey, Buffer.from(JSON.stringify({ rows: result.rows }), 'utf8'));

  let errorKey = null;
  if (result.summary.failedRows > 0 || result.summary.duplicateRows > 0) {
    errorKey = errorStorageKey(importId);
    const errBuf = await buildErrorReportBuffer(result.rows);
    await saveFile(errorKey, errBuf);
  }

  const updated = await prisma.tblStudent_Import_History.update({
    where: { import_id: importId },
    data: {
      status: IMPORT_STATUSES.VALIDATED,
      total_rows: result.summary.totalRows,
      successful_rows: 0,
      failed_rows: result.summary.failedRows,
      duplicate_rows: result.summary.duplicateRows,
      validation_reference: validationKey,
      error_report_reference: errorKey,
      updated_at: new Date(),
    },
  });

  return {
    import: serializeHistory(updated),
    summary: {
      totalRows: result.summary.totalRows,
      validRows: result.summary.validRows,
      failedRows: result.summary.failedRows,
      duplicateRows: result.summary.duplicateRows,
    },
    rows: {
      successful: result.rows.filter((r) => r.category === 'valid'),
      failed: result.rows.filter((r) => r.category === 'failed'),
      duplicate: result.rows.filter((r) => r.category === 'duplicate'),
    },
  };
}

async function insertStudentRow(row, userId) {
  const { first, last } = splitFullName(row.name);
  const rollStr = String(row.rollNo);
  const dob = row.dob ? parseDateOnly(row.dob) : null;
  const Student_id = newId('STU');
  const student_class_id = newId('SC');

  await prisma.$transaction(async (tx) => {
    // Re-check duplicates inside transaction
    if (row.admissionNo) {
      const adm = await tx.tblStudents.findFirst({
        where: {
          Admission_No: { equals: row.admissionNo, mode: 'insensitive' },
          Int_Status: { not: 0 },
        },
      });
      if (adm) {
        const e = new Error('Duplicate admission number.');
        e.code = 'DUPLICATE';
        throw e;
      }
    }
    const clash = await tx.tblStudent_Class.findFirst({
      where: {
        class_section_id: row.sectionId,
        Roll_No: rollStr,
        Int_Status: { not: 0 },
      },
    });
    if (clash) {
      const e = new Error('Duplicate roll number in class/section.');
      e.code = 'DUPLICATE';
      throw e;
    }

    await tx.tblStudents.create({
      data: {
        Student_id,
        Admission_No: row.admissionNo || null,
        Roll_No: rollStr,
        First_Name: first,
        Last_Name: last,
        Gender: row.gender || null,
        DOB: dob,
        Father_Name: row.fatherName || row.parentName || null,
        Mother_Name: row.motherName || null,
        Father_Number: row.fatherMobile || row.parentMobile || null,
        Mother_Number: row.motherMobile || null,
        Address_Line_1: row.address || null,
        Country: 'Indian',
        Int_Status: 1,
        Created_By: userId,
      },
    });

    await tx.tblStudent_Class.create({
      data: {
        student_class_id,
        Student_id,
        class_section_id: row.sectionId,
        Roll_No: rollStr,
        Academic_Year: row.academicYear || null,
        Int_Status: 1,
      },
    });
  });

  return { Student_id, student_class_id };
}

export async function processImport(importId, userId) {
  const history = await prisma.tblStudent_Import_History.findUnique({
    where: { import_id: importId },
  });
  if (!history) {
    const err = new Error('Import not found');
    err.status = 404;
    throw err;
  }
  if (history.uploaded_by !== userId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (
    [IMPORT_STATUSES.COMPLETED, IMPORT_STATUSES.PARTIALLY_COMPLETED, IMPORT_STATUSES.PROCESSING].includes(
      history.status
    )
  ) {
    const err = new Error(
      history.status === IMPORT_STATUSES.PROCESSING
        ? 'Import is already processing'
        : 'This import has already been processed'
    );
    err.status = 409;
    throw err;
  }
  if (history.status !== IMPORT_STATUSES.VALIDATED || !history.validation_reference) {
    const err = new Error('Import must be validated before importing');
    err.status = 400;
    throw err;
  }

  // Claim lock
  const claimed = await prisma.tblStudent_Import_History.updateMany({
    where: { import_id: importId, status: IMPORT_STATUSES.VALIDATED },
    data: {
      status: IMPORT_STATUSES.PROCESSING,
      imported_at: new Date(),
      updated_at: new Date(),
    },
  });
  if (claimed.count !== 1) {
    const err = new Error('This import has already been processed');
    err.status = 409;
    throw err;
  }

  let payload;
  try {
    const raw = await readFile(history.validation_reference);
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    await prisma.tblStudent_Import_History.update({
      where: { import_id: importId },
      data: { status: IMPORT_STATUSES.FAILED, completed_at: new Date(), updated_at: new Date() },
    });
    const err = new Error('Could not load validation data');
    err.status = 500;
    throw err;
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  let imported = 0;
  const importedRows = [];
  const newlyFailed = [];

  for (const row of rows) {
    if (row.category !== 'valid') continue;
    try {
      const created = await insertStudentRow(row, userId);
      imported += 1;
      importedRows.push({ ...row, studentId: created.Student_id, enrollmentId: created.student_class_id });
      await writeImportAudit({
        eventType: 'STUDENT_CREATED_BULK_IMPORT',
        importId,
        userId,
        studentId: created.Student_id,
        admissionNo: row.admissionNo,
        className: row.className,
        sectionName: row.sectionName,
        fileName: history.original_file_name,
      });
    } catch (e) {
      if (e.code === 'DUPLICATE') {
        newlyFailed.push({
          ...row,
          category: 'duplicate',
          errorReason: e.message || 'Duplicate student.',
        });
      } else {
        console.error('student import row failed', e);
        newlyFailed.push({
          ...row,
          category: 'failed',
          errorReason: 'Could not save this student. Please try again.',
        });
      }
    }
  }

  // Refresh error report if new failures during import
  const allForReport = [
    ...rows.filter((r) => r.category === 'failed' || r.category === 'duplicate'),
    ...newlyFailed,
  ];
  let errorKey = history.error_report_reference;
  if (allForReport.length) {
    errorKey = errorStorageKey(importId);
    await saveFile(errorKey, await buildErrorReportBuffer(allForReport));
  }

  const finalFailed =
    rows.filter((r) => r.category === 'failed').length +
    newlyFailed.filter((r) => r.category === 'failed').length;
  const finalDup =
    rows.filter((r) => r.category === 'duplicate').length +
    newlyFailed.filter((r) => r.category === 'duplicate').length;

  const status =
    imported === 0 && finalFailed + finalDup >= history.total_rows
      ? IMPORT_STATUSES.FAILED
      : finalFailed > 0 || newlyFailed.some((r) => r.category === 'failed')
        ? IMPORT_STATUSES.PARTIALLY_COMPLETED
        : IMPORT_STATUSES.COMPLETED;

  const updated = await prisma.tblStudent_Import_History.update({
    where: { import_id: importId },
    data: {
      status,
      successful_rows: imported,
      failed_rows: finalFailed,
      duplicate_rows: finalDup,
      error_report_reference: errorKey,
      completed_at: new Date(),
      updated_at: new Date(),
    },
    include: { tblUsers: { select: { user_id: true, name: true, email: true } } },
  });

  await writeImportAudit({
    eventType: 'STUDENT_BULK_IMPORT_COMPLETED',
    importId,
    userId,
    fileName: history.original_file_name,
    totalRows: history.total_rows,
    successfulCount: imported,
    failedCount: finalFailed,
    duplicateCount: finalDup,
  });

  return {
    import: serializeHistory(updated),
    summary: {
      totalRows: history.total_rows,
      successfullyImported: imported,
      failed: finalFailed,
      duplicateSkipped: finalDup,
      uploadedBy: updated.tblUsers?.name || userId,
      fileName: history.original_file_name,
      processingDateTime: updated.completed_at,
      status: updated.status,
    },
    importedRows,
  };
}

export function serializeHistory(row) {
  if (!row) return null;
  return {
    id: row.import_id,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.tblUsers?.name || null,
    originalFileName: row.original_file_name,
    totalRows: row.total_rows,
    successfulRows: row.successful_rows,
    failedRows: row.failed_rows,
    duplicateRows: row.duplicate_rows,
    status: row.status,
    importedAt: row.imported_at,
    completedAt: row.completed_at,
    hasErrorReport: Boolean(row.error_report_reference),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listImportHistory(limit = 50) {
  const rows = await prisma.tblStudent_Import_History.findMany({
    orderBy: { created_at: 'desc' },
    take: Math.min(100, Math.max(1, limit)),
    include: { tblUsers: { select: { name: true, email: true } } },
  });
  return rows.map(serializeHistory);
}

export async function getErrorReportPath(importId) {
  const history = await prisma.tblStudent_Import_History.findUnique({
    where: { import_id: importId },
  });
  if (!history) return null;
  if (!history.error_report_reference) return { missing: true, history };
  return {
    history,
    path: absolutePath(history.error_report_reference),
    fileName: `student-import-errors-${importId}.xlsx`,
  };
}

export { toDateString };
