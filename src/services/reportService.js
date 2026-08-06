import { createSampleGrid, STUDENTS_PER_SECTION } from '../data/mockData.js';
import { generateSectionRoster, mockStudentId } from '../data/studentRoster.js';
import { apiFetch, useMock } from './api.js';
import { getClasses, mockSectionId, resolveSectionId } from './classService.js';
import { getDailyAttendance } from './attendanceService.js';
import { getStudents } from './studentService.js';

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
  const marked = markedTotal(counts);
  if (!marked) return 0;
  return Math.round((counts.P / marked) * 1000) / 10;
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
  const grid = createSampleGrid();
  const day = Number(dateStr.slice(-2)) || 1;
  const col = Math.min(grid[0].length - 1, (day + studentIndex) % grid[0].length);
  return grid[studentIndex % grid.length]?.[col] ?? 'P';
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

async function mockDaily({ date, sectionId, className, section }) {
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
  const dates = eachDate(from, to).filter((d) => {
    const day = new Date(`${d}T12:00:00`).getDay();
    return day !== 0;
  });

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
        roster.forEach((_, idx) => tally(counts, statusForMockStudent(idx, date)));
      } else {
        const { from, to } = monthBounds(year, month);
        const dates = eachDate(from, to).filter((d) => new Date(`${d}T12:00:00`).getDay() !== 0);
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

export function downloadCsv(filename, rows) {
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
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
    <p class="muted">${subtitle || 'Print this page or use your browser’s “Save as PDF”.'}</p>
    ${tableHtml}
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
