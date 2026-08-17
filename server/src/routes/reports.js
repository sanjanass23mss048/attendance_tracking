import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { parseDateOnly, toDateString } from '../lib/ids.js';
import { getDailyMarks, getDailyMarksInRange, countAttendanceDaysForSection } from '../services/attendanceRepo.js';
import { loadNonWorkingYmdSet, isNonWorkingDate } from '../lib/nonWorkingDays.js';
import {
  canAccessSection,
  findClassSectionById,
  listClassesForUser,
  listEnrollmentsForSection,
} from '../services/schoolRepo.js';

const router = Router();

async function forbidUnlessSectionAccess(req, res, classSectionId) {
  const ok = await canAccessSection(req.user?.sub, req.user?.role, classSectionId);
  if (!ok) {
    res.status(403).json({ error: 'You do not have access to this class' });
    return false;
  }
  return true;
}

function emptyCounts() {
  return { P: 0, A: 0, L: 0, H: 0, OH: 0, OF: 0 };
}

function tallyStatus(counts, status) {
  const code = status === 'O' ? 'OF' : status;
  if (counts[code] != null) counts[code] += 1;
}

function markedTotal(counts) {
  return counts.P + counts.A + counts.L + counts.H + counts.OH + counts.OF;
}

function attendancePercent(counts) {
  const marked = markedTotal(counts);
  if (!marked) return 0;
  return Math.round((counts.P / marked) * 1000) / 10;
}

/** Present is not stored — fill P from attendance days minus non-present tallies. */
function applyImpliedPresent(counts, attendanceDays, studentCount = 1) {
  const nonPresent = counts.A + counts.L + counts.H + counts.OH + counts.OF;
  const capacity = Math.max(0, Number(attendanceDays) || 0) * Math.max(0, Number(studentCount) || 0);
  counts.P = Math.max(0, capacity - nonPresent);
  return counts;
}

function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end, startStr: toDateString(start), endStr: toDateString(end) };
}

const dailyQuery = z
  .object({
    date: z.string(),
    sectionId: z.string().min(1).optional(),
    className: z.string().min(1).optional(),
    section: z.literal('all').optional(),
  })
  .refine((data) => data.sectionId || data.className, {
    message: 'Provide sectionId or className',
  });

const monthlyQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  sectionId: z.string().min(1).optional(),
});

const comparisonQuery = z.object({
  date: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

function tallyWorkingMarks(marks, nonWorking, onMark) {
  for (const mark of marks) {
    if (mark.date && nonWorking.has(mark.date)) continue;
    onMark(mark);
  }
}

function compareDailyRows(a, b) {
  const classCmp = String(a.className || '').localeCompare(String(b.className || ''));
  if (classCmp) return classCmp;
  const sectionCmp = String(a.sectionName || '').localeCompare(String(b.sectionName || ''));
  if (sectionCmp) return sectionCmp;
  const rollCmp = Number(a.rollNo) - Number(b.rollNo);
  if (rollCmp) return rollCmp;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

/** Present is not stored — missing mark displays and tallies as Present. */
function dailyStatusOrPresent(stored) {
  return stored || 'P';
}

async function buildDailyRowsForSection(classSectionId, date, meta = {}) {
  const students = await listEnrollmentsForSection(classSectionId);
  const byStudent = await getDailyMarks(classSectionId, date);
  const counts = emptyCounts();
  const rows = students.map((s) => {
    const status = dailyStatusOrPresent(byStudent.get(s.id));
    tallyStatus(counts, status);
    return {
      studentId: s.id,
      rollNo: s.rollNo,
      name: s.name,
      status,
      ...(meta.sectionName ? { sectionName: meta.sectionName, sectionId: classSectionId } : {}),
      ...(meta.className ? { className: meta.className } : {}),
    };
  });
  return { rows, counts, studentCount: students.length };
}

router.get('/daily', requireAuth, async (req, res) => {
  const parsed = dailyQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const date = parseDateOnly(parsed.data.date);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  if (await isNonWorkingDate(parsed.data.date, date)) {
    return res.json({
      date: parsed.data.date,
      holiday: true,
      className: parsed.data.className || '',
      sectionName: parsed.data.section || '',
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
    });
  }

  const { sectionId, className, section } = parsed.data;
  const allSections = section === 'all' || (!sectionId && className);

  if (!allSections && sectionId) {
    const sectionRow = await findClassSectionById(sectionId);
    if (!sectionRow) {
      return res.status(404).json({ error: 'Section not found' });
    }
    if (!(await forbidUnlessSectionAccess(req, res, sectionRow.Class_Section_id))) return;

    const { rows, counts, studentCount } = await buildDailyRowsForSection(
      sectionRow.Class_Section_id,
      date
    );
    const resolvedClassName = sectionRow.tblClass?.Class_Name || '';
    const sectionName = sectionRow.tblSection?.Section_Name || '';

    return res.json({
      date: parsed.data.date,
      sectionId: sectionRow.Class_Section_id,
      className: resolvedClassName,
      sectionName,
      label: `Class ${resolvedClassName} - ${sectionName}`,
      showSectionColumn: false,
      showClassColumn: false,
      students: rows,
      summary: {
        total: studentCount,
        marked: studentCount,
        present: counts.P,
        absent: counts.A,
        late: counts.L,
        halfDay: counts.H,
        odHalfDay: counts.OH,
        odFullDay: counts.OF,
        attendancePercent: attendancePercent(counts),
      },
    });
  }

  const classesTree = await listClassesForUser(req.user.sub, req.user.role);
  const targetClasses =
    className === 'all'
      ? classesTree
      : classesTree.filter((c) => String(c.name) === String(className));

  if (!targetClasses.length) {
    return res.status(404).json({ error: className === 'all' ? 'No classes found' : 'Class not found' });
  }

  const showClassColumn = className === 'all';
  const showSectionColumn = true;
  const counts = emptyCounts();
  const rows = [];
  let studentCount = 0;

  for (const klass of targetClasses) {
    for (const sec of klass.sections) {
      const built = await buildDailyRowsForSection(sec.id, date, {
        className: klass.name,
        sectionName: sec.name,
      });
      rows.push(...built.rows);
      studentCount += built.studentCount;
      counts.P += built.counts.P;
      counts.A += built.counts.A;
      counts.L += built.counts.L;
      counts.H += built.counts.H;
      counts.OH += built.counts.OH;
      counts.OF += built.counts.OF;
    }
  }

  rows.sort(compareDailyRows);

  const resolvedClassName = className === 'all' ? 'all' : targetClasses[0].name;
  const label =
    className === 'all'
      ? 'All classes'
      : `Class ${targetClasses[0].name} - All sections`;

  return res.json({
    date: parsed.data.date,
    className: resolvedClassName,
    sectionName: 'all',
    label,
    showSectionColumn,
    showClassColumn,
    students: rows,
    summary: {
      total: studentCount,
      marked: studentCount,
      present: counts.P,
      absent: counts.A,
      late: counts.L,
      halfDay: counts.H,
      odHalfDay: counts.OH,
      odFullDay: counts.OF,
      attendancePercent: attendancePercent(counts),
    },
  });
});

router.get('/monthly', requireAuth, async (req, res) => {
  const parsed = monthlyQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const { year, month, sectionId } = parsed.data;
  const { start, end, startStr, endStr } = monthRange(year, month);

  if (sectionId) {
    const section = await findClassSectionById(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

    const students = await listEnrollmentsForSection(section.Class_Section_id);
    const [marks, nonWorking] = await Promise.all([
      getDailyMarksInRange(
        students.map((s) => s.id),
        start,
        end
      ),
      loadNonWorkingYmdSet(start, end),
    ]);

    const byStudent = Object.fromEntries(students.map((s) => [s.id, emptyCounts()]));
    tallyWorkingMarks(marks, nonWorking, (mark) => {
      const bucket = byStudent[mark.studentId];
      if (bucket) tallyStatus(bucket, mark.status);
    });
    const workingDays = await countAttendanceDaysForSection(
      section.Class_Section_id,
      start,
      end,
      nonWorking,
    );

    const studentsOut = students.map((s) => {
      const counts = applyImpliedPresent(byStudent[s.id], workingDays, 1);
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
    studentsOut.forEach((row) => {
      totals.P += row.present;
      totals.A += row.absent;
      totals.L += row.late;
      totals.H += row.halfDay;
      totals.OH += row.odHalfDay;
      totals.OF += row.odFullDay;
    });

    const className = section.tblClass?.Class_Name || '';
    const sectionName = section.tblSection?.Section_Name || '';

    return res.json({
      year,
      month,
      from: startStr,
      to: endStr,
      sectionId: section.Class_Section_id,
      className,
      sectionName,
      label: `Class ${className} - ${sectionName}`,
      mode: 'students',
      students: studentsOut,
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
    });
  }

  const classesTree = await listClassesForUser(req.user.sub, req.user.role);
  const sectionMeta = [];
  for (const c of classesTree) {
    for (const s of c.sections) {
      const enrollments = await listEnrollmentsForSection(s.id);
      sectionMeta.push({
        sectionId: s.id,
        className: c.name,
        sectionName: s.name,
        students: enrollments,
      });
    }
  }

  const allIds = sectionMeta.flatMap((s) => s.students.map((st) => st.id));
  const [marks, nonWorking] = await Promise.all([
    getDailyMarksInRange(allIds, start, end),
    loadNonWorkingYmdSet(start, end),
  ]);
  const sectionByStudent = {};
  for (const section of sectionMeta) {
    for (const st of section.students) {
      sectionByStudent[st.id] = section.sectionId;
    }
  }

  const countsBySection = Object.fromEntries(sectionMeta.map((s) => [s.sectionId, emptyCounts()]));
  tallyWorkingMarks(marks, nonWorking, (mark) => {
    const sid = sectionByStudent[mark.studentId];
    if (sid && countsBySection[sid]) tallyStatus(countsBySection[sid], mark.status);
  });

  const attendanceDaysBySection = {};
  await Promise.all(
    sectionMeta.map(async (section) => {
      attendanceDaysBySection[section.sectionId] = await countAttendanceDaysForSection(
        section.sectionId,
        start,
        end,
        nonWorking
      );
    })
  );

  const classes = sectionMeta.map((section) => {
    const counts = applyImpliedPresent(
      countsBySection[section.sectionId],
      attendanceDaysBySection[section.sectionId] || 0,
      section.students.length
    );
    return {
      sectionId: section.sectionId,
      className: section.className,
      sectionName: section.sectionName,
      label: `Class ${section.className} - ${section.sectionName}`,
      studentCount: section.students.length,
      present: counts.P,
      absent: counts.A,
      late: counts.L,
      halfDay: counts.H,
      odHalfDay: counts.OH,
      odFullDay: counts.OF,
      marked: markedTotal(counts),
      attendancePercent: attendancePercent(counts),
    };
  });

  const totals = emptyCounts();
  classes.forEach((row) => {
    totals.P += row.present;
    totals.A += row.absent;
    totals.L += row.late;
    totals.H += row.halfDay;
    totals.OH += row.odHalfDay;
    totals.OF += row.odFullDay;
  });

  return res.json({
    year,
    month,
    from: startStr,
    to: endStr,
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
  });
});

router.get('/class-comparison', requireAuth, async (req, res) => {
  const parsed = comparisonQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const { date: dateStr, year, month } = parsed.data;
  let start;
  let end;
  let mode;
  let rangeLabel;

  if (dateStr) {
    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    start = date;
    end = date;
    mode = 'date';
    rangeLabel = dateStr;
  } else if (year != null && month != null) {
    const range = monthRange(year, month);
    start = range.start;
    end = range.end;
    mode = 'month';
    rangeLabel = `${year}-${String(month).padStart(2, '0')}`;
  } else {
    return res.status(400).json({ error: 'Provide date=YYYY-MM-DD or year=&month=' });
  }

  const classesTree = await listClassesForUser(req.user.sub, req.user.role);
  const sectionMeta = [];
  for (const c of classesTree) {
    for (const s of c.sections) {
      const enrollments = await listEnrollmentsForSection(s.id);
      sectionMeta.push({
        sectionId: s.id,
        className: c.name,
        sectionName: s.name,
        students: enrollments,
      });
    }
  }

  const allIds = sectionMeta.flatMap((s) => s.students.map((st) => st.id));
  const [marks, nonWorking] = await Promise.all([
    getDailyMarksInRange(allIds, start, end),
    loadNonWorkingYmdSet(start, end),
  ]);
  const sectionByStudent = {};
  for (const section of sectionMeta) {
    for (const st of section.students) {
      sectionByStudent[st.id] = section.sectionId;
    }
  }

  const countsBySection = Object.fromEntries(sectionMeta.map((s) => [s.sectionId, emptyCounts()]));
  tallyWorkingMarks(marks, nonWorking, (mark) => {
    const sid = sectionByStudent[mark.studentId];
    if (sid && countsBySection[sid]) tallyStatus(countsBySection[sid], mark.status);
  });

  const attendanceDaysBySection = {};
  await Promise.all(
    sectionMeta.map(async (section) => {
      attendanceDaysBySection[section.sectionId] = await countAttendanceDaysForSection(
        section.sectionId,
        start,
        end,
        nonWorking
      );
    })
  );

  const classes = sectionMeta.map((section) => {
    const counts = applyImpliedPresent(
      countsBySection[section.sectionId],
      attendanceDaysBySection[section.sectionId] || 0,
      section.students.length
    );
    return {
      sectionId: section.sectionId,
      className: section.className,
      sectionName: section.sectionName,
      label: `${section.className}-${section.sectionName}`,
      fullLabel: `Class ${section.className} - ${section.sectionName}`,
      studentCount: section.students.length,
      present: counts.P,
      absent: counts.A,
      late: counts.L,
      halfDay: counts.H,
      odHalfDay: counts.OH,
      odFullDay: counts.OF,
      marked: markedTotal(counts),
      attendancePercent: attendancePercent(counts),
    };
  });

  return res.json({
    mode,
    rangeLabel,
    date: mode === 'date' ? dateStr : null,
    year: mode === 'month' ? year : null,
    month: mode === 'month' ? month : null,
    classes,
  });
});

export default router;
