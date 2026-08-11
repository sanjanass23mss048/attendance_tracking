import Tesseract from 'tesseract.js';
import { newId } from '../lib/ids.js';
import { saveFile } from '../lib/storage.js';
import { writeImportAudit, normalizeText } from './studentImportService.js';

const PHONE_RE = /(?:\+?91[\s-]*)?([6-9]\d{9})\b/;
const ADM_RE = /\b((?:ADM|ADMISSION|ADMN)[-:\s]*[A-Z0-9\-/]+)\b/i;
const ADM_TOKEN_RE = /\b(ADM[A-Z0-9\-/]{3,})\b/i;
const DATE_RE =
  /\b(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4}|\d{4}-\d{2}-\d{2})\b/;
const GENDER_RE = /\b(male|female|other|boy|girl|m|f)\b/i;
const CLASS_HINT_RE = /\b(?:class|std|standard|grade)\s*[:\-]?\s*(lkg|ukg|\d{1,2})\b/i;
const SECTION_HINT_RE = /\b(?:sec(?:tion)?)\s*[:\-]?\s*([a-d])\b/i;
const ROLL_LEAD_RE = /^\s*(?:roll\s*(?:no\.?|number)?\s*[:\-]?\s*)?(\d{1,3})(?:[.)\-\s]+|$)/i;

function normalizeDateDisplay(raw) {
  const text = normalizeText(raw);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2,4})$/);
  if (!m) return text;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

function normalizeGenderToken(value) {
  const t = String(value || '').toLowerCase();
  if (['male', 'm', 'boy'].includes(t)) return 'Male';
  if (['female', 'f', 'girl'].includes(t)) return 'Female';
  if (['other', 'o'].includes(t)) return 'Other';
  return '';
}

function looksLikeHeader(line) {
  const l = line.toLowerCase();
  return (
    (l.includes('roll') && l.includes('name')) ||
    (l.includes('admission') && l.includes('name')) ||
    l.includes('student name')
  );
}

/**
 * Parse one OCR line into a draft student row.
 * Typical chit lines: "1 Diya Sharma 9876543210" or "2. Aarav Male 15/06/2015 ADMLKG001"
 */
export function parseChitLine(line, defaults = {}) {
  let text = normalizeText(line);
  if (!text || text.length < 2) return null;
  if (looksLikeHeader(text)) return null;

  const row = {
    admissionNo: '',
    rollNo: '',
    name: '',
    gender: '',
    dob: '',
    className: defaults.className || '',
    sectionName: defaults.sectionName || '',
    parentName: '',
    parentMobile: '',
    parentEmail: '',
    address: '',
    sourceLine: text,
    confidence: 'medium',
  };

  const classHint = text.match(CLASS_HINT_RE);
  if (classHint) {
    row.className = classHint[1].toUpperCase() === 'LKG' || classHint[1].toUpperCase() === 'UKG'
      ? classHint[1].toUpperCase()
      : String(Number(classHint[1]) || classHint[1]);
    text = normalizeText(text.replace(classHint[0], ' '));
  }
  const sectionHint = text.match(SECTION_HINT_RE);
  if (sectionHint) {
    row.sectionName = sectionHint[1].toUpperCase();
    text = normalizeText(text.replace(sectionHint[0], ' '));
  }

  const phone = text.match(PHONE_RE);
  if (phone) {
    row.parentMobile = phone[1];
    text = normalizeText(text.replace(phone[0], ' '));
  }

  let adm = text.match(ADM_TOKEN_RE) || text.match(ADM_RE);
  if (adm) {
    row.admissionNo = normalizeText(adm[1] || adm[0] || '')
      .replace(/^(admission|admn)\s*[:\-]?\s*/i, 'ADM')
      .replace(/\s+/g, '')
      .toUpperCase();
    text = normalizeText(text.replace(adm[0], ' '));
  }

  const dob = text.match(DATE_RE);
  if (dob) {
    row.dob = normalizeDateDisplay(dob[1]);
    text = normalizeText(text.replace(dob[0], ' '));
  }

  const gender = text.match(GENDER_RE);
  if (gender) {
    row.gender = normalizeGenderToken(gender[1]);
    text = normalizeText(text.replace(gender[0], ' '));
  }

  const roll = text.match(ROLL_LEAD_RE);
  if (roll) {
    row.rollNo = String(Number(roll[1]));
    text = normalizeText(text.replace(roll[0], ' '));
  }

  // Remaining tokens ≈ name (+ optional parent name after separator)
  text = text.replace(/[|,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    if (!row.rollNo && !row.name && !row.parentMobile && !row.admissionNo) return null;
  }

  const parts = text.split(/\s+/).filter(Boolean);
  // If still starts with a small integer, treat as roll
  if (!row.rollNo && parts.length && /^\d{1,3}$/.test(parts[0])) {
    row.rollNo = String(Number(parts.shift()));
  }

  // Heuristic: if many tokens, last 2 may be parent name when phone present
  if (parts.length >= 4 && row.parentMobile) {
    row.parentName = parts.slice(-2).join(' ');
    row.name = parts.slice(0, -2).join(' ');
  } else {
    row.name = parts.join(' ');
  }

  row.name = normalizeText(row.name);
  row.parentName = normalizeText(row.parentName);

  if (!row.name && !row.rollNo && !row.admissionNo) return null;

  // Confidence: need at least name or admission + something identifiable
  if (row.name && (row.rollNo || row.admissionNo || row.parentMobile)) {
    row.confidence = 'high';
  } else if (row.name || row.admissionNo) {
    row.confidence = 'low';
  }

  return row;
}

export function parseChitText(rawText, defaults = {}) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => normalizeText(l))
    .filter(Boolean);

  const rows = [];
  for (const line of lines) {
    const parsed = parseChitLine(line, defaults);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

async function ocrImageBuffer(buffer, fileName) {
  const result = await Tesseract.recognize(buffer, 'eng', {
    logger: () => {},
  });
  return {
    fileName,
    text: result?.data?.text || '',
    confidence: result?.data?.confidence ?? null,
  };
}

/**
 * OCR one or more chit photos and parse into draft student rows.
 */
export async function extractStudentsFromChits({
  files,
  userId,
  className = '',
  sectionName = '',
}) {
  if (!files?.length) {
    const err = new Error('No chit photo selected');
    err.status = 400;
    throw err;
  }

  const defaults = {
    className: normalizeText(className),
    sectionName: normalizeText(sectionName).toUpperCase(),
  };

  const scanId = newId('CHT');
  const pages = [];
  const allRows = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const safeName = String(file.originalname || `chit-${i + 1}.jpg`).slice(0, 200);
    const storageKey = `student-chits/${scanId}/${i + 1}-${safeName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await saveFile(storageKey, file.buffer);

    let ocr;
    try {
      ocr = await ocrImageBuffer(file.buffer, safeName);
    } catch (e) {
      console.error('chit OCR failed', e);
      pages.push({
        fileName: safeName,
        storageKey,
        error: 'Could not read text from this photo. Try a clearer image.',
        rawText: '',
        rowCount: 0,
      });
      continue;
    }

    const rows = parseChitText(ocr.text, defaults).map((r, idx) => ({
      ...r,
      tempId: `${scanId}-${i + 1}-${idx + 1}`,
      sourceFile: safeName,
      sourcePage: i + 1,
    }));
    allRows.push(...rows);
    pages.push({
      fileName: safeName,
      storageKey,
      rawText: ocr.text,
      ocrConfidence: ocr.confidence,
      rowCount: rows.length,
    });
  }

  await writeImportAudit({
    eventType: 'STUDENT_CHIT_SCAN_COMPLETED',
    userId,
    fileName: files.map((f) => f.originalname).join(', ').slice(0, 250),
    totalRows: allRows.length,
    details: JSON.stringify({
      scanId,
      pageCount: pages.length,
      className: defaults.className,
      sectionName: defaults.sectionName,
    }),
  });

  if (!allRows.length && pages.every((p) => !p.rawText)) {
    const err = new Error(
      'Could not read any text from the chit photos. Use brighter lighting and hold the camera steady.'
    );
    err.status = 400;
    throw err;
  }

  return {
    scanId,
    defaults,
    pages,
    rows: allRows,
    warning:
      allRows.length === 0
        ? 'Text was found but no student lines could be parsed. Edit the draft table manually or re-photograph the chit.'
        : 'OCR from paper chits can miss fields. Review and correct every row before validating.',
  };
}
