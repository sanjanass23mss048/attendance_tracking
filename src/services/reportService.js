import { createSampleGrid, mockDailyStatusForStudent, STUDENTS_PER_SECTION } from '../data/mockData.js';
import { generateSectionRoster, mockStudentId } from '../data/studentRoster.js';
import { apiFetch, useMock } from './api.js';
import { getClasses, mockSectionId, resolveSectionId } from './classService.js';
import { getDailyAttendance } from './attendanceService.js';
import { getStudents } from './studentService.js';
import { isHolidayDate } from './calendarService.js';
import { attendancePercentFromCounts } from '../utils/attendance.js';

function emptyCounts() {
  return { P: 0, A: 0, L: 0, H: 0, OH: 0, OF: 0 };
}

function tally(counts, status) {
  const code = status === 'O' ? 'OF' : status;
  if (code && counts[code] != null) counts[code] += 1;
}

function markedTotal(counts) {
  return counts.P + counts.A + counts.L + counts.H + counts.OH + counts.OF;
}

function attendancePercent(counts) {
  return attendancePercentFromCounts(counts);
}

function parseYmd(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T12:00:00`);
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function eachDate(fromStr, toStr) {
  const from = parseYmd(fromStr);
  const to = parseYmd(toStr);
  if (!from || !to) return [];
  const out = [];
  const cur = new Date(from.getTime());
  while (cur <= to) {
    out.push(toYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function monthBounds(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { from: toYmd(start), to: toYmd(end) };
}

function statusForMockStudent(studentIndex, dateStr) {
  return mockDailyStatusForStudent(studentIndex, dateStr);
}

function mockRosterForSection(sectionId) {
  const match = String(sectionId).match(/^mock-section-(.+)-(.+)$/);
  const className = match?.[1] || '1';
  const sectionName = match?.[2] || 'A';
  return generateSectionRoster(className, sectionName).map((s) => ({
    id: mockStudentId(sectionId, className, sectionName, s.rollNo),
    rollNo: s.rollNo,
    name: s.name,
  }));
}

function emptyDailyHoliday(date, extra = {}) {
  return {
    date,
    holiday: true,
    className: extra.className || '',
    sectionName: extra.sectionName || extra.section || '',
    label: 'Holiday — excluded from attendance',
    showSectionColumn: false,
    showClassColumn: false,
    students: [],
    summary: {
      total: 0,
      marked: 0,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      odHalfDay: 0,
      odFullDay: 0,
      attendancePercent: 0,
    },
  };
}

async function workingDatesBetween(from, to) {
  const list = eachDate(from, to);
  const flags = await Promise.all(list.map((d) => isHolidayDate(d)));
  return list.filter((_, i) => !flags[i]);
}

async function mockDaily({ date, sectionId, className, section }) {
  if (await isHolidayDate(date)) {
    return emptyDailyHoliday(date, { className, section });
  }
  const allSections = section === 'all' || (!sectionId && className);
  if (allSections) {
    const { classes: classList } = await getClasses();
    const targetClasses =
      className === 'all'
        ? classList || []
        : (classList || []).filter((c) => String(c.name) === String(className));

    if (!targetClasses.length) {
      throw new Error(className === 'all' ? 'No classes found' : 'Class not found');
    }

    const counts = emptyCounts();
    const students = [];
    for (const klass of targetClasses) {
      for (const sec of klass.sections || []) {
        const sid = sec.id || mockSectionId(klass.name, sec.name);
        const daily = await getDailyAttendance({ sectionId: sid, date });
        const roster = await getStudents({ sectionId: sid });
        (roster.students || []).forEach((s) => {
          const mark = (daily.marks || []).find((m) => String(m.studentId) === String(s.id));
          const status = mark?.status || 'P';
          tally(counts, status);
          students.push({
            studentId: String(s.id),
            rollNo: s.roll ?? s.rollNo,
            name: s.name,
            status,
            sectionName: sec.name,
            sectionId: sid,
            className: klass.name,
          });
        });
      }
    }

    students.sort((a, b) => {
      const classCmp = String(a.className || '').localeCompare(String(b.className || ''));
      if (classCmp) return classCmp;
      const sectionCmp = String(a.sectionName || '').localeCompare(String(b.sectionName || ''));
      if (sectionCmp) return sectionCmp;
      return Number(a.rollNo) - Number(b.rollNo);
    });

    const showClassColumn = className === 'all';
    const resolvedClassName = className === 'all' ? 'all' : targetClasses[0].name;
    const label =
      className === 'all'
        ? 'All classes'
        : `Class ${targetClasses[0].name} - All sections`;

    return {
      date,
      className: resolvedClassName,
      sectionName: 'all',
      label,
      showSectionColumn: true,
      showClassColumn,
      students,
      summary: {
        total: students.length,
        marked: students.length,
        present: counts.P,
        absent: counts.A,
        late: counts.L,
        halfDay: counts.H,
        odHalfDay: counts.OH,
        odFullDay: counts.OF,
        attendancePercent: attendancePercent(counts),
      },
    };
  }

  const sid = sectionId || (await resolveSectionId('1', 'A'));
  const daily = await getDailyAttendance({ sectionId: sid, date });
  const roster = await getStudents({ sectionId: sid });
  const students = (roster.students || []).map((s) => {
    const mark = (daily.marks || []).find((m) => String(m.studentId) === String(s.id));
    const status = mark?.status || 'P';
    return {
      studentId: String(s.id),
      rollNo: s.roll ?? s.rollNo,
      name: s.name,
      status,
    };
  });

  const counts = emptyCounts();
  students.forEach((row) => tally(counts, row.status));

  const classes = await getClasses();
  let resolvedClassName = '1';
  let sectionName = 'A';
  for (const klass of classes.classes || []) {
    const sec = (klass.sections || []).find((s) => s.id === sid);
    if (sec) {
      resolvedClassName = klass.name;
      sectionName = sec.name;
      break;
    }
  }

  return {
    date,
    sectionId: sid,
    className: resolvedClassName,
    sectionName,
    label: `Class ${resolvedClassName} - ${sectionName}`,
    showSectionColumn: false,
    showClassColumn: false,
    students,
    summary: {
      total: students.length,
      marked: students.length,
      present: counts.P,
      absent: counts.A,
      late: counts.L,
      halfDay: counts.H,
      odHalfDay: counts.OH,
      odFullDay: counts.OF,
      attendancePercent: attendancePercent(counts),
    },
  };
}

async function mockMonthly({ year, month, sectionId }) {
  const { from, to } = monthBounds(year, month);
  const dates = await workingDatesBetween(from, to);

  if (sectionId) {
    const roster = mockRosterForSection(sectionId);
    const students = roster.map((s, idx) => {
      const counts = emptyCounts();
      dates.forEach((date) => tally(counts, statusForMockStudent(idx, date)));
      const marked = markedTotal(counts);
      return {
        studentId: s.id,
        rollNo: s.rollNo,
        name: s.name,
        present: counts.P,
        absent: counts.A,
        late: counts.L,
        halfDay: counts.H,
        odHalfDay: counts.OH,
        odFullDay: counts.OF,
        marked,
        attendancePercent: attendancePercent(counts),
      };
    });

    const totals = emptyCounts();
    students.forEach((row) => {
      totals.P += row.present;
      totals.A += row.absent;
      totals.L += row.late;
      totals.H += row.halfDay;
      totals.OH += row.odHalfDay;
      totals.OF += row.odFullDay;
    });

    const match = String(sectionId).match(/^mock-section-(.+)-(.+)$/);
    const className = match?.[1] || '1';
    const sectionName = match?.[2] || 'A';

    return {
      year,
      month,
      from,
      to,
      sectionId,
      className,
      sectionName,
      label: `Class ${className} - ${sectionName}`,
      mode: 'students',
      students,
      totals: {
        present: totals.P,
        absent: totals.A,
        late: totals.L,
        halfDay: totals.H,
        odHalfDay: totals.OH,
        odFullDay: totals.OF,
        marked: markedTotal(totals),
        attendancePercent: attendancePercent(totals),
      },
    };
  }

  const { classes: classList } = await getClasses();
  const classes = [];
  for (const klass of classList || []) {
    for (const sec of klass.sections || []) {
      const roster = mockRosterForSection(sec.id);
      const counts = emptyCounts();
      roster.forEach((_, idx) => {
        dates.forEach((date) => tally(counts, statusForMockStudent(idx, date)));
      });
      classes.push({
        sectionId: sec.id,
        className: klass.name,
        sectionName: sec.name,
        label: `Class ${klass.name} - ${sec.name}`,
        studentCount: roster.length,
        present: counts.P,
        absent: counts.A,
        late: counts.L,
        halfDay: counts.H,
        odHalfDay: counts.OH,
        odFullDay: counts.OF,
        marked: markedTotal(counts),
        attendancePercent: attendancePercent(counts),
      });
    }
  }

  const totals = emptyCounts();
  classes.forEach((row) => {
    totals.P += row.present;
    totals.A += row.absent;
    totals.L += row.late;
    totals.H += row.halfDay;
    totals.OH += row.odHalfDay;
    totals.OF += row.odFullDay;
  });

  return {
    year,
    month,
    from,
    to,
    mode: 'classes',
    classes,
    totals: {
      present: totals.P,
      absent: totals.A,
      late: totals.L,
      halfDay: totals.H,
      odHalfDay: totals.OH,
      odFullDay: totals.OF,
      marked: markedTotal(totals),
      attendancePercent: attendancePercent(totals),
    },
  };
}

async function mockClassComparison({ date, year, month }) {
  const mode = date ? 'date' : 'month';
  const rangeLabel = date || `${year}-${String(month).padStart(2, '0')}`;
  const { classes: classList } = await getClasses();
  const classes = [];

  for (const klass of classList || []) {
    for (const sec of klass.sections || []) {
      const roster = mockRosterForSection(sec.id || mockSectionId(klass.name, sec.name));
      const counts = emptyCounts();
      if (date) {
        if (await isHolidayDate(date)) {
          // keep zero counts
        } else {
          roster.forEach((_, idx) => tally(counts, statusForMockStudent(idx, date)));
        }
      } else {
        const { from, to } = monthBounds(year, month);
        const dates = await workingDatesBetween(from, to);
        roster.forEach((_, idx) => {
          dates.forEach((d) => tally(counts, statusForMockStudent(idx, d)));
        });
      }
      classes.push({
        sectionId: sec.id,
        className: klass.name,
        sectionName: sec.name,
        label: `${klass.name}-${sec.name}`,
        fullLabel: `Class ${klass.name} - ${sec.name}`,
        studentCount: roster.length,
        present: counts.P,
        absent: counts.A,
        late: counts.L,
        halfDay: counts.H,
        odHalfDay: counts.OH,
        odFullDay: counts.OF,
        marked: markedTotal(counts),
        attendancePercent: attendancePercent(counts),
      });
    }
  }

  return {
    mode,
    rangeLabel,
    date: date || null,
    year: year ?? null,
    month: month ?? null,
    classes,
  };
}

/**
 * @param {{ date: string, sectionId?: string, className?: string, section?: 'all' }} query
 */
export async function getDailyReport(query) {
  if (useMock()) return mockDaily(query);
  const params = new URLSearchParams({ date: query.date });
  if (query.sectionId) params.set('sectionId', query.sectionId);
  if (query.className) params.set('className', query.className);
  if (query.section) params.set('section', query.section);
  return apiFetch(`/api/reports/daily?${params}`);
}

/**
 * @param {{ year: number, month: number, sectionId?: string }} query
 */
export async function getMonthlyReport(query) {
  if (useMock()) return mockMonthly(query);
  const params = new URLSearchParams({
    year: String(query.year),
    month: String(query.month),
  });
  if (query.sectionId) params.set('sectionId', query.sectionId);
  return apiFetch(`/api/reports/monthly?${params}`);
}

/**
 * @param {{ date?: string, year?: number, month?: number }} query
 */
export async function getClassComparison(query) {
  if (useMock()) return mockClassComparison(query);
  const params = new URLSearchParams();
  if (query.date) params.set('date', query.date);
  if (query.year != null) params.set('year', String(query.year));
  if (query.month != null) params.set('month', String(query.month));
  return apiFetch(`/api/reports/class-comparison?${params}`);
}

/**
 * Trigger a text/binary file save (CSV, ICS, etc.). Mobile-safe (share/clipboard).
 * @returns {Promise<{ method: string }>}
 */
export async function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const text = typeof content === 'string' ? content : String(content ?? '');
  const withBom = mimeType.includes('csv') && !text.startsWith('\uFEFF') ? `\uFEFF${text}` : text;
  const blob = new Blob([withBom], { type: mimeType });
  const isTouchUi =
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''));

  const copyFallback = () => {
    try {
      if (navigator.clipboard?.writeText) {
        // fire-and-forget path handled by caller via await below
        return null;
      }
    } catch {
      // continue
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = withBom;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  };

  if (isTouchUi) {
    if (typeof File !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([blob], filename, { type: mimeType.split(';')[0] || 'text/csv' });
        if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return { method: 'share-file' };
        }
      } catch (err) {
        if (err?.name === 'AbortError') return { method: 'cancelled' };
      }
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: filename, text: withBom });
        return { method: 'share-text' };
      } catch (err) {
        if (err?.name === 'AbortError') return { method: 'cancelled' };
      }
    }

    // Clipboard API
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(withBom);
        return { method: 'clipboard' };
      } catch {
        // fall through to execCommand
      }
    }

    if (copyFallback()) {
      return { method: 'clipboard' };
    }

    // Last resort: data-URI tap (some WebViews still ignore this)
    try {
      const dataUri = `data:${mimeType},${encodeURIComponent(withBom)}`;
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = filename;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return { method: 'anchor-data' };
    } catch {
      // continue
    }

    throw new Error('Could not export file on this device. Try Chrome, or copy from the list manually.');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { method: 'anchor-blob' };
}

/**
 * Trigger a CSV file save. Safe to call after async work (fetch, etc.).
 * @returns {Promise<{ method: string }>}
 */
export async function downloadCsv(filename, rows) {
  return downloadTextFile(filename, rows.join('\n'), 'text/csv;charset=utf-8;');
}

export function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Print HTML without navigating away from the app.
 * Uses a hidden iframe — critical for Capacitor/mobile WebView where window.open
 * replaces the current screen and leaves users stuck.
 */
export function printHtmlDocument(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    return false;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      // ignore
    }
  };

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      cleanup();
      return;
    }
    frameWindow.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 2000);
  };

  setTimeout(triggerPrint, 250);
  return true;
}

export function openPrintWindow(title, tableHtml, subtitle = '') {
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: Georgia, serif; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { color: #555; font-size: 13px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #eef2ff; }
      .muted { color: #666; font-size: 12px; }
    </style></head><body>
    <h1>${title}</h1>
    <p class="muted">${subtitle || 'Choose Save as PDF in the print dialog.'}</p>
    ${tableHtml}
    </body></html>`;
  return printHtmlDocument(html);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadgeHtml(label) {
  const key = String(label || '').toLowerCase();
  let cls = 'badge badge-other';
  let icon = '•';
  if (key.includes('present')) {
    cls = 'badge badge-present';
    icon = '✓';
  } else if (key.includes('absent')) {
    cls = 'badge badge-absent';
    icon = '✕';
  } else if (key.includes('late')) {
    cls = 'badge badge-late';
    icon = '⏰';
  } else if (key.includes('half')) {
    cls = 'badge badge-half';
    icon = '½';
  } else if (key.includes('od')) {
    cls = 'badge badge-od';
    icon = '◎';
  }
  return `<span class="${cls}"><span class="badge-icon">${icon}</span>${escapeHtml(label || '—')}</span>`;
}

let pdfBrandLogoUrl = '';

/** Keep PDF headers in sync with the uploaded school logo. */
export function setPdfBrandLogoUrl(url) {
  pdfBrandLogoUrl = String(url || '').trim();
}

function resolvePdfLogo(logoUrl) {
  if (logoUrl) return logoUrl;
  if (pdfBrandLogoUrl) return pdfBrandLogoUrl;
  return typeof window !== 'undefined'
    ? `${window.location.origin}/attendance-logo-mark.png`
    : '/attendance-logo-mark.png';
}

/**
 * Styled attendance report matching Presence / RIOBizSols PDF mockup.
 * Opens the system print dialog — choose “Save as PDF”.
 *
 * @param {{
 *   classLabel: string,
 *   dateLabel: string,
 *   rows: { roll: string|number, name: string, status: string }[],
 *   logoUrl?: string,
 * }} opts
 */
export function exportAttendanceReportPdf({ classLabel, dateLabel, rows = [], logoUrl }) {
  const logo = resolvePdfLogo(logoUrl);

  const bodyRows = rows
    .map(
      (r, i) => `<tr class="${i % 2 ? 'alt' : ''}">
      <td class="col-roll">${escapeHtml(r.roll)}</td>
      <td class="col-name">${escapeHtml(r.name)}</td>
      <td class="col-status">${statusBadgeHtml(r.status)}</td>
    </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Attendance Report — ${escapeHtml(classLabel)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: #fff;
    }
    .sheet { width: 100%; max-width: 780px; margin: 0 auto; }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 3px solid #1e3a8a;
      position: relative;
    }
    .header::after {
      content: "";
      position: absolute;
      left: 0; bottom: -3px;
      width: 72px; height: 3px;
      background: #c9a227;
    }
    .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .brand-logo {
      width: 52px; height: 52px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .brand-text h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0.04em;
      color: #1e3a8a;
      font-weight: 800;
      line-height: 1.15;
    }
    .class-pill {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 14px;
      border-radius: 999px;
      background: #1e3a8a;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .meta { text-align: right; flex-shrink: 0; padding-top: 2px; }
    .meta-date {
      display: flex; align-items: center; justify-content: flex-end; gap: 6px;
      font-size: 13px; font-weight: 700; color: #0f172a;
    }
    .meta-date .label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      color: #64748b; text-transform: uppercase;
    }
    .meta-page {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 8px;
      padding: 3px 10px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #64748b;
      font-size: 11px; font-weight: 600;
    }
    .table-wrap {
      margin-top: 18px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    thead th {
      background: #1e3a8a;
      color: #fff;
      font-weight: 700;
      padding: 11px 14px;
      text-align: left;
    }
    thead th.col-roll, thead th.col-status { text-align: center; }
    tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid #eef2f7;
      vertical-align: middle;
    }
    tbody tr.alt td { background: #f8fafc; }
    tbody tr:last-child td { border-bottom: none; }
    .col-roll { width: 88px; text-align: center; font-weight: 600; color: #334155; }
    .col-name { font-weight: 600; color: #0f172a; }
    .col-status { width: 150px; text-align: center; }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px; font-weight: 700;
      white-space: nowrap;
    }
    .badge-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 14px; height: 14px; border-radius: 50%;
      font-size: 9px; line-height: 1;
    }
    .badge-present { background: #dcfce7; color: #166534; }
    .badge-present .badge-icon { background: #22c55e; color: #fff; }
    .badge-absent { background: #fee2e2; color: #991b1b; }
    .badge-absent .badge-icon { background: #ef4444; color: #fff; }
    .badge-late { background: #fef3c7; color: #92400e; }
    .badge-late .badge-icon { background: #f59e0b; color: #fff; }
    .badge-half { background: #ede9fe; color: #5b21b6; }
    .badge-half .badge-icon { background: #8b5cf6; color: #fff; }
    .badge-od { background: #cffafe; color: #155e75; }
    .badge-od .badge-icon { background: #06b6d4; color: #fff; }
    .badge-other { background: #f1f5f9; color: #475569; }
    .badge-other .badge-icon { background: #94a3b8; color: #fff; }
    .footer {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; margin-top: 22px; padding-top: 12px;
      border-top: 3px solid #1e3a8a; position: relative;
      font-size: 11px; color: #64748b;
    }
    .footer::after {
      content: "";
      position: absolute; left: 0; top: -3px;
      width: 72px; height: 3px; background: #c9a227;
    }
    .footer-left { display: flex; align-items: center; gap: 8px; }
    .footer-mark {
      width: 18px; height: 18px; border-radius: 4px;
      background: #1e3a8a; color: #c9a227;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800;
    }
    .footer strong { color: #0f172a; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .table-wrap { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      <div class="brand">
        <img class="brand-logo" src="${escapeHtml(logo)}" alt="Presence" />
        <div class="brand-text">
          <h1>ATTENDANCE REPORT</h1>
          <span class="class-pill">${escapeHtml(classLabel)}</span>
        </div>
      </div>
      <div class="meta">
        <div class="meta-date">
          <span class="label">Date</span>
          <span>${escapeHtml(dateLabel)}</span>
        </div>
        <div class="meta-page">🖨 Page 1 of 1</div>
      </div>
    </header>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-roll">Roll No.</th>
            <th class="col-name">Student Name</th>
            <th class="col-status">Status</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows || '<tr><td colspan="3" style="text-align:center;padding:24px;color:#64748b">No students</td></tr>'}
        </tbody>
      </table>
    </div>

    <footer class="footer">
      <div class="footer-left">
        <span class="footer-mark">★</span>
        <span>Thank you for your continued support.</span>
      </div>
      <div>Generated by <strong>RIOBizSols</strong></div>
    </footer>
  </div>
</body>
</html>`;

  return printHtmlDocument(html);
}

/**
 * School nominal roll PDF — Roll, Name, optional Teacher (leadership), Remarks.
 * @param {{
 *   classLabel: string,
 *   sectionLabel?: string,
 *   dateLabel?: string,
 *   rows: { roll: string|number, name: string, teacher?: string, section?: string }[],
 *   showTeacherColumn?: boolean,
 *   logoUrl?: string,
 * }} opts
 */
export function exportNominalRollPdf({
  classLabel,
  sectionLabel = '',
  dateLabel = '',
  rows = [],
  showTeacherColumn = false,
  logoUrl,
}) {
  const logo = resolvePdfLogo(logoUrl);

  const multiSection =
    !sectionLabel &&
    new Set(rows.map((r) => String(r.section || '').trim()).filter(Boolean)).size > 1;

  const colCount = 2 + (multiSection ? 1 : 0) + (showTeacherColumn ? 1 : 0) + 1;

  const head = [
    multiSection ? `<th class="col-sec">Section</th>` : '',
    `<th class="col-roll">Roll No.</th>`,
    `<th class="col-name">Student Name</th>`,
    showTeacherColumn ? `<th class="col-teacher">Teacher</th>` : '',
    `<th class="col-remarks">Remarks / Notes</th>`,
  ].join('');

  const bodyRows = rows
    .map((r, i) => {
      const cells = [
        multiSection ? `<td class="col-sec">${escapeHtml(r.section || '')}</td>` : '',
        `<td class="col-roll">${escapeHtml(r.roll)}</td>`,
        `<td class="col-name">${escapeHtml(r.name)}</td>`,
        showTeacherColumn
          ? `<td class="col-teacher">${escapeHtml(r.teacher || '')}</td>`
          : '',
        `<td class="col-remarks"></td>`,
      ].join('');
      return `<tr class="${i % 2 ? 'alt' : ''}">${cells}</tr>`;
    })
    .join('');

  const sectionPill = sectionLabel
    ? `<span class="pill">Section ${escapeHtml(sectionLabel)}</span>`
    : multiSection
      ? `<span class="pill">All Sections</span>`
      : '';

  let noteText = `This is the nominal roll for Class ${classLabel}.`;
  if (sectionLabel) {
    noteText = `This is the nominal roll for Class ${classLabel} - Section ${sectionLabel}.`;
  } else if (multiSection) {
    noteText = `This is the nominal roll for Class ${classLabel} (all sections).`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>School Nominal Roll — ${escapeHtml(classLabel)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: #fff;
    }
    .sheet { width: 100%; max-width: 780px; margin: 0 auto; }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 3px solid #1e3a8a;
      position: relative;
    }
    .header::after {
      content: "";
      position: absolute;
      left: 0; bottom: -3px;
      width: 72px; height: 3px;
      background: #c9a227;
    }
    .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .brand-logo { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; }
    .brand-text h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0.04em;
      color: #1e3a8a;
      font-weight: 800;
      line-height: 1.15;
    }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .pill {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 999px;
      background: #1e3a8a;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .meta { text-align: right; flex-shrink: 0; padding-top: 2px; }
    .meta-date {
      display: flex; align-items: center; justify-content: flex-end; gap: 6px;
      font-size: 13px; font-weight: 700; color: #0f172a;
    }
    .meta-date .label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      color: #64748b; text-transform: uppercase;
    }
    .table-wrap {
      margin-top: 18px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    thead th {
      background: #1e3a8a;
      color: #fff;
      font-weight: 700;
      padding: 11px 14px;
      text-align: left;
    }
    thead th.col-roll, thead th.col-sec { text-align: center; }
    tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid #eef2f7;
      vertical-align: middle;
    }
    tbody tr.alt td { background: #f0f7ff; }
    tbody tr:last-child td { border-bottom: none; }
    .col-roll { width: 88px; text-align: center; font-weight: 600; color: #334155; }
    .col-sec { width: 72px; text-align: center; color: #475569; }
    .col-name { font-weight: 600; color: #0f172a; }
    .col-teacher { width: 140px; color: #334155; font-size: 12px; }
    .col-remarks { width: 28%; min-height: 28px; }
    .note {
      margin-top: 16px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 12px;
      font-weight: 600;
    }
    .note-icon {
      width: 18px; height: 18px; border-radius: 50%;
      background: #1e3a8a; color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; flex-shrink: 0;
    }
    .footer {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; margin-top: 18px; padding-top: 12px;
      border-top: 3px solid #1e3a8a; position: relative;
      font-size: 11px; color: #64748b;
    }
    .footer::after {
      content: "";
      position: absolute; left: 0; top: -3px;
      width: 72px; height: 3px; background: #c9a227;
    }
    .footer strong { color: #0f172a; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .table-wrap { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      <div class="brand">
        <img class="brand-logo" src="${escapeHtml(logo)}" alt="Presence" />
        <div class="brand-text">
          <h1>SCHOOL NOMINAL ROLL</h1>
          <div class="pills">
            <span class="pill">Class ${escapeHtml(classLabel)}</span>
            ${sectionPill}
          </div>
        </div>
      </div>
      <div class="meta">
        ${
          dateLabel
            ? `<div class="meta-date"><span class="label">Date</span><span>${escapeHtml(dateLabel)}</span></div>`
            : ''
        }
      </div>
    </header>

    <div class="table-wrap">
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>
          ${
            bodyRows ||
            `<tr><td colspan="${colCount}" style="text-align:center;padding:24px;color:#64748b">No students</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <div class="note">
      <span class="note-icon">i</span>
      <span>${escapeHtml(noteText)}</span>
    </div>

    <footer class="footer">
      <span>Thank you for your continued support.</span>
      <span>Generated by <strong>RIOBizSols</strong></span>
    </footer>
  </div>
</body>
</html>`;

  return printHtmlDocument(html);
}

/**
 * Branded multi-column PDF report (print → Save as PDF).
 * @param {{
 *   title: string,
 *   pill?: string,
 *   dateLabel?: string,
 *   headers: string[],
 *   rows: (string|number)[][],
 *   statusColumnIndex?: number,
 * }} opts
 */
export function exportTablePdfReport({
  title,
  pill = '',
  dateLabel = '',
  headers = [],
  rows = [],
  statusColumnIndex = -1,
  logoUrl,
}) {
  const logo = resolvePdfLogo(logoUrl);

  const statusIdx =
    statusColumnIndex >= 0
      ? statusColumnIndex
      : headers.findIndex((h) => /status/i.test(String(h)));

  const headCells = headers
    .map((h, i) => {
      const align =
        i === 0 || /roll|no\.|id|count|%|students/i.test(String(h)) ? 'center' : 'left';
      return `<th style="text-align:${align}">${escapeHtml(h)}</th>`;
    })
    .join('');

  const bodyRows = rows
    .map((row, ri) => {
      const cells = (row || [])
        .map((cell, ci) => {
          const val = cell ?? '';
          const content =
            ci === statusIdx ? statusBadgeHtml(String(val)) : escapeHtml(val);
          const align =
            ci === 0 || ci === statusIdx || typeof val === 'number' ? 'center' : 'left';
          return `<td style="text-align:${align}">${content}</td>`;
        })
        .join('');
      return `<tr class="${ri % 2 ? 'alt' : ''}">${cells}</tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: "Segoe UI", system-ui, sans-serif; background: #fff; }
    .sheet { width: 100%; max-width: 900px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 3px solid #1e3a8a; position: relative; }
    .header::after { content: ""; position: absolute; left: 0; bottom: -3px; width: 72px; height: 3px; background: #c9a227; }
    .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .brand-logo { width: 48px; height: 48px; object-fit: contain; }
    .brand-text h1 { margin: 0; font-size: 20px; letter-spacing: 0.04em; color: #1e3a8a; font-weight: 800; }
    .pill { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 999px; background: #1e3a8a; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .meta { text-align: right; font-size: 13px; font-weight: 700; }
    .meta .label { display: block; font-size: 10px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
    .table-wrap { margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    thead th { background: #1e3a8a; color: #fff; font-weight: 700; padding: 10px 10px; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #eef2f7; vertical-align: middle; }
    tbody tr.alt td { background: #f8fafc; }
    .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .badge-icon { display: inline-flex; width: 13px; height: 13px; border-radius: 50%; align-items: center; justify-content: center; font-size: 8px; }
    .badge-present { background: #dcfce7; color: #166534; } .badge-present .badge-icon { background: #22c55e; color: #fff; }
    .badge-absent { background: #fee2e2; color: #991b1b; } .badge-absent .badge-icon { background: #ef4444; color: #fff; }
    .badge-late { background: #fef3c7; color: #92400e; } .badge-late .badge-icon { background: #f59e0b; color: #fff; }
    .badge-half { background: #ede9fe; color: #5b21b6; } .badge-half .badge-icon { background: #8b5cf6; color: #fff; }
    .badge-od { background: #cffafe; color: #155e75; } .badge-od .badge-icon { background: #06b6d4; color: #fff; }
    .badge-other { background: #f1f5f9; color: #475569; } .badge-other .badge-icon { background: #94a3b8; color: #fff; }
    .footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 10px; border-top: 3px solid #1e3a8a; position: relative; font-size: 11px; color: #64748b; }
    .footer::after { content: ""; position: absolute; left: 0; top: -3px; width: 72px; height: 3px; background: #c9a227; }
    .footer strong { color: #0f172a; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      <div class="brand">
        <img class="brand-logo" src="${escapeHtml(logo)}" alt="Presence" />
        <div class="brand-text">
          <h1>${escapeHtml(title)}</h1>
          ${pill ? `<span class="pill">${escapeHtml(pill)}</span>` : ''}
        </div>
      </div>
      <div class="meta">
        ${dateLabel ? `<span class="label">Date</span><div>${escapeHtml(dateLabel)}</div>` : ''}
      </div>
    </header>
    <div class="table-wrap">
      <table>
        <thead><tr>${headCells}</tr></thead>
        <tbody>
          ${
            bodyRows ||
            `<tr><td colspan="${Math.max(headers.length, 1)}" style="text-align:center;padding:24px;color:#64748b">No data</td></tr>`
          }
        </tbody>
      </table>
    </div>
    <footer class="footer">
      <span>Thank you for your continued support.</span>
      <span>Generated by <strong>RIOBizSols</strong></span>
    </footer>
  </div>
</body>
</html>`;

  return printHtmlDocument(html);
}

const ACAD_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ACAD_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toRoman(num) {
  if (!num || num < 1) return '-';
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = num;
  let out = '';
  for (const [value, symbol] of map) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

function isNonWorkingEvent(event) {
  if (!event) return false;
  if (event.source === 'sunday') return true;
  const type = String(event.type || '').toLowerCase();
  if (type === 'holiday' || type === 'sudden') return true;
  const source = String(event.source || '').toLowerCase();
  return ['calendarific', 'curated', 'govt', 'nager', 'sudden'].includes(source);
}

function academicRowClass(events, isSunday) {
  if (isSunday) return 'row-sunday';
  if (!events.length) return '';
  if (events.some((e) => String(e.type).toLowerCase() === 'exam')) return 'row-exam';
  if (events.some((e) => isNonWorkingEvent(e))) return 'row-holiday';
  if (events.some((e) => String(e.type).toLowerCase() === 'important')) return 'row-important';
  if (events.some((e) => String(e.type).toLowerCase() === 'event')) return 'row-event';
  return 'row-other';
}

function formatDdMmYyyy(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Academic year starts in June: monthIndex >= 5 → that calendar year, else previous.
 */
export function resolveAcademicYearStart(year, monthIndex = 5) {
  const y = Number(year) || new Date().getFullYear();
  const m = Number(monthIndex);
  if (Number.isFinite(m) && m < 5) return y - 1;
  return y;
}

/**
 * Build June(startYear)–April(startYear+1) day grids with cumulative Day Order.
 * @param {number} startYear
 * @param {Array<{ date: string, title?: string, type?: string, source?: string }>} events
 */
export function buildAcademicYearMonths(startYear, events = []) {
  const byDate = {};
  for (const event of events) {
    if (!event?.date) continue;
    if (!byDate[event.date]) byDate[event.date] = [];
    byDate[event.date].push(event);
  }

  const monthSpecs = [
    ...[5, 6, 7, 8, 9, 10].map((month) => ({ year: startYear, month })),
    { year: startYear, month: 11 },
    ...[0, 1, 2, 3].map((month) => ({ year: startYear + 1, month })),
  ];

  let dayOrder = 0;
  const months = [];

  for (const { year, month } of monthSpecs) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dow = new Date(`${iso}T12:00:00`).getDay();
      const dayEvents = (byDate[iso] || []).filter((e) => e.source !== 'sunday');
      const isSunday = dow === 0;
      const holiday = isSunday || dayEvents.some(isNonWorkingEvent);
      const remarks = isSunday
        ? 'Holiday'
        : dayEvents.map((e) => e.title).filter(Boolean).join(', ');
      let doLabel = '-';
      if (!holiday) {
        dayOrder += 1;
        doLabel = toRoman(dayOrder);
      }
      days.push({
        day,
        dayName: ACAD_WEEKDAYS[dow],
        doLabel,
        remarks,
        rowClass: academicRowClass(dayEvents, isSunday),
        iso,
      });
    }
    months.push({
      year,
      month,
      title: `${ACAD_MONTHS[month].toUpperCase()} ${year}`,
      days,
    });
  }

  return { months, totalWorkingDays: dayOrder };
}

function academicMonthTableHtml(month) {
  const rows = month.days
    .map(
      (d) => `<tr class="${d.rowClass}">
      <td class="c-date">${d.day}</td>
      <td class="c-day">${d.dayName}</td>
      <td class="c-do">${escapeHtml(d.doLabel)}</td>
      <td class="c-rem">${escapeHtml(d.remarks || '')}</td>
    </tr>`
    )
    .join('');
  return `<div class="month">
    <div class="month-head">${escapeHtml(month.title)}</div>
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Day</th><th>DO</th><th>Remarks / Events</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function academicSidebarHtml({ startYear, reopening, lastWorking, totalWorkingDays }) {
  const endYear = startYear + 1;
  const reopenLabel = reopening ? formatDdMmYyyy(reopening) : `02.06.${startYear}`;
  const lastLabel = lastWorking ? formatDdMmYyyy(lastWorking) : `30.04.${endYear}`;
  return `<aside class="details">
    <h2>IMPORTANT DETAILS</h2>
    <div class="detail-block">
      <p><strong>Re-opening Day:</strong> ${escapeHtml(reopenLabel)}</p>
      <p><strong>Last Working Day:</strong> ${escapeHtml(lastLabel)}</p>
      <p><strong>Working Days:</strong> ${totalWorkingDays}</p>
    </div>
    <h3>Colour Legend</h3>
    <ul class="legend">
      <li><span class="swatch sw-sunday"></span> Weekly Holiday (Sunday)</li>
      <li><span class="swatch sw-holiday"></span> School / Govt Holiday</li>
      <li><span class="swatch sw-exam"></span> Exam / Assessment</li>
      <li><span class="swatch sw-event"></span> School Event</li>
      <li><span class="swatch sw-important"></span> Important / Meeting</li>
      <li><span class="swatch sw-other"></span> Other</li>
    </ul>
    <h3>Notes</h3>
    <p class="note-text">DO = Day Order (instructional day). Sundays and holidays are marked “-” and do not advance the count.</p>
    <p class="note-text">Exam windows and result dates are as scheduled in the school calendar and may be revised by the office.</p>
  </aside>`;
}

function academicPageHtml({
  logo,
  startYear,
  dateLabel,
  pageIndex,
  pageCount,
  monthBlocks,
  sidebar,
}) {
  const yearLabel = `${startYear} – ${String(startYear + 1).slice(-2)}`;
  return `<section class="page">
    <header class="header">
      <div class="brand">
        <img class="brand-logo" src="${escapeHtml(logo)}" alt="RIOBizSols School" />
        <div>
          <p class="school">RIOBizSols School</p>
          <p class="tag">Presence · Attendance</p>
        </div>
      </div>
      <div class="title-block">
        <div class="title-row">
          <span class="cal-icon" aria-hidden="true">📅</span>
          <h1>ACADEMIC CALENDAR</h1>
        </div>
        <p class="year">${escapeHtml(yearLabel)}</p>
      </div>
      <div class="meta">
        <div class="date-box">
          <span class="label">DATE</span>
          <strong>${escapeHtml(dateLabel || '')}</strong>
        </div>
        <div class="page-pill">Page ${pageIndex} of ${pageCount}</div>
      </div>
    </header>
    <div class="body">
      <div class="months">${monthBlocks}</div>
      ${sidebar}
    </div>
    <footer class="footer">
      <span>Let’s learn, grow and achieve together!</span>
      <span class="footer-brand">
        <img src="${escapeHtml(logo)}" alt="" />
        RIOBizSols School
      </span>
    </footer>
  </section>`;
}

/**
 * Branded 2-page academic calendar (Jun–Nov / Dec–Apr) matching school PDF mockup.
 * Opens print dialog — choose Save as PDF. Prefer landscape A4.
 *
 * @param {{
 *   startYear: number,
 *   events?: Array,
 *   dateLabel?: string,
 *   logoUrl?: string,
 *   reopeningDate?: string,
 *   lastWorkingDate?: string,
 * }} opts
 */
export function exportAcademicCalendarPdf({
  startYear,
  events = [],
  dateLabel = '',
  logoUrl,
  reopeningDate,
  lastWorkingDate,
}) {
  const logo = resolvePdfLogo(logoUrl);

  const year = Number(startYear) || resolveAcademicYearStart(new Date().getFullYear(), 5);
  const { months, totalWorkingDays } = buildAcademicYearMonths(year, events);

  const reopen =
    reopeningDate ||
    events.find((e) => /re-?open/i.test(String(e.title || '')))?.date ||
    null;
  const lastWorking =
    lastWorkingDate ||
    events.find((e) => /last working/i.test(String(e.title || '')))?.date ||
    null;

  const sidebar = academicSidebarHtml({
    startYear: year,
    reopening: reopen,
    lastWorking,
    totalWorkingDays,
  });

  const page1Months = months.slice(0, 6).map(academicMonthTableHtml).join('');
  const page2Months = months.slice(6).map(academicMonthTableHtml).join('');

  const pages = [
    academicPageHtml({
      logo,
      startYear: year,
      dateLabel,
      pageIndex: 1,
      pageCount: 2,
      monthBlocks: page1Months,
      sidebar,
    }),
    academicPageHtml({
      logo,
      startYear: year,
      dateLabel,
      pageIndex: 2,
      pageCount: 2,
      monthBlocks: page2Months,
      sidebar,
    }),
  ].join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Academic Calendar ${year}–${String(year + 1).slice(-2)}</title>
  <style>
    @page { size: A4 landscape; margin: 7mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: #fff;
    }
    .page {
      width: 100%;
      min-height: 190mm;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 3px solid #1e3a8a;
      margin-bottom: 8px;
    }
    .brand { display: flex; align-items: center; gap: 10px; min-width: 160px; }
    .brand-logo { width: 42px; height: 42px; object-fit: contain; }
    .school { margin: 0; font-size: 13px; font-weight: 800; color: #1e3a8a; }
    .tag { margin: 0; font-size: 9px; color: #64748b; font-weight: 600; }
    .title-block { text-align: center; flex: 1; }
    .title-row { display: inline-flex; align-items: center; gap: 8px; }
    .cal-icon { font-size: 18px; line-height: 1; }
    .title-block h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0.06em;
      color: #1e3a8a;
      font-weight: 800;
    }
    .year {
      margin: 2px 0 0;
      font-size: 13px;
      font-weight: 700;
      color: #c2410c;
    }
    .meta { text-align: right; min-width: 150px; }
    .date-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 8px;
      background: #fff;
      display: inline-block;
      text-align: left;
    }
    .date-box .label {
      display: block;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .date-box strong { font-size: 11px; }
    .page-pill {
      margin-top: 4px;
      display: inline-block;
      background: #1e3a8a;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
    }
    .body {
      display: grid;
      grid-template-columns: 1fr 148px;
      gap: 8px;
      flex: 1;
      min-height: 0;
    }
    .months {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 5px;
      align-content: start;
    }
    .page:nth-child(2) .months {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
    .month {
      border: 1px solid #94a3b8;
      border-radius: 4px;
      overflow: hidden;
      background: #fff;
    }
    .month-head {
      background: #1e3a8a;
      color: #fff;
      text-align: center;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 4px 2px;
    }
    .month table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 6.5px;
    }
    .month th {
      background: #e2e8f0;
      color: #334155;
      font-weight: 700;
      padding: 2px 1px;
      border-bottom: 1px solid #94a3b8;
      text-align: center;
    }
    .month td {
      border-bottom: 1px solid #e2e8f0;
      padding: 1px 2px;
      vertical-align: middle;
      line-height: 1.15;
    }
    .c-date { width: 14%; text-align: center; font-weight: 700; }
    .c-day { width: 18%; text-align: center; }
    .c-do { width: 18%; text-align: center; font-weight: 600; color: #1e3a8a; }
    .c-rem { width: 50%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-sunday td { background: #dcfce7; }
    .row-holiday td { background: #fef08a; }
    .row-exam td { background: #fde68a; }
    .row-event td { background: #bae6fd; }
    .row-important td { background: #fdba74; }
    .row-other td { background: #e9d5ff; }
    .details {
      border: 1px solid #1e3a8a;
      border-radius: 6px;
      padding: 8px;
      background: #f8fafc;
      font-size: 8px;
      line-height: 1.35;
    }
    .details h2 {
      margin: 0 0 6px;
      font-size: 10px;
      color: #1e3a8a;
      letter-spacing: 0.04em;
      text-align: center;
      border-bottom: 2px solid #c9a227;
      padding-bottom: 4px;
    }
    .details h3 {
      margin: 8px 0 4px;
      font-size: 9px;
      color: #0f172a;
    }
    .detail-block p { margin: 0 0 3px; }
    .legend { list-style: none; margin: 0; padding: 0; }
    .legend li {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 3px;
    }
    .swatch {
      width: 10px; height: 10px; border-radius: 2px;
      border: 1px solid #94a3b8; flex-shrink: 0;
    }
    .sw-sunday { background: #dcfce7; }
    .sw-holiday { background: #fef08a; }
    .sw-exam { background: #fde68a; }
    .sw-event { background: #bae6fd; }
    .sw-important { background: #fdba74; }
    .sw-other { background: #e9d5ff; }
    .note-text { margin: 0 0 4px; color: #475569; }
    .footer {
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: #1e3a8a;
      color: #fff;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 10px;
      font-weight: 600;
    }
    .footer-brand { display: inline-flex; align-items: center; gap: 6px; }
    .footer-brand img { width: 16px; height: 16px; object-fit: contain; background: #fff; border-radius: 2px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media screen {
      body { background: #e2e8f0; padding: 12px; }
      .page {
        background: #fff;
        max-width: 1100px;
        margin: 0 auto 16px;
        padding: 12px;
        box-shadow: 0 2px 8px rgba(15,23,42,0.12);
        border-radius: 8px;
      }
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;

  return printHtmlDocument(html);
}

/** @deprecated Prefer exportAttendanceReportPdf / exportTablePdfReport. */
export async function downloadPdfTable({ filename, title, subtitle = '', headers, rows }) {
  exportTablePdfReport({
    title,
    pill: subtitle,
    headers,
    rows,
  });
  return { method: 'print' };
}
