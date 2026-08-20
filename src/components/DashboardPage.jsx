import { useEffect, useMemo, useState } from 'react';
import {
  Baby,
  BarChart2,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileText,
  GraduationCap,
  LoaderCircle,
  Megaphone,
  Percent,
  Shield,
  UserCheck,
  Users,
  UserX,
  XCircle,
} from 'lucide-react';
import { formatClassLabel, compareClassNames } from '../data/schoolGrades.js';
import { canApproveEditRequests } from '../data/navItems.js';
import { getScheduledEvents } from '../services/calendarService.js';
import {
  downloadCsv,
  escapeCsv,
  exportTablePdfReport,
  getClassComparison,
  getDailyReport,
} from '../services/reportService.js';
import { resolveSectionId } from '../services/classService.js';
import { attendancePercentFromCounts } from '../utils/attendance.js';
import { STATUS_LABELS } from './reports/attendancePaths.js';
import {
  CircularAttendance,
  KpiCard,
  MobileKpi,
  MobileStandardCard,
  ReportPageHeader,
  attendanceBand,
  formatShortDate,
  pastelAt,
} from './reports/attendanceReportUi.jsx';

const FULL_ACCESS_ROLES = new Set([
  'INCHARGE',
  'ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'HEADMASTER',
  'HOD',
]);

const ROLE_LABELS = {
  INCHARGE: 'Attendance In-charge',
  TEACHER: 'Teacher',
  ADMIN: 'Administrator',
  HOD: 'HOD',
  VICE_PRINCIPAL: 'Vice Principal',
  PRINCIPAL: 'Principal',
};

const CLASS_CARD_STYLES = [
  { wrap: 'bg-violet-50 border-violet-100', icon: 'bg-violet-600', pct: 'text-violet-800 bg-white' },
  { wrap: 'bg-sky-50 border-sky-100', icon: 'bg-sky-600', pct: 'text-sky-800 bg-white' },
  { wrap: 'bg-emerald-50 border-emerald-100', icon: 'bg-emerald-600', pct: 'text-emerald-800 bg-white' },
  { wrap: 'bg-amber-50 border-amber-100', icon: 'bg-amber-500', pct: 'text-amber-800 bg-white' },
  { wrap: 'bg-rose-50 border-rose-100', icon: 'bg-rose-500', pct: 'text-rose-800 bg-white' },
  { wrap: 'bg-indigo-50 border-indigo-100', icon: 'bg-indigo-600', pct: 'text-indigo-800 bg-white' },
];

const EVENT_TAG = {
  holiday: 'bg-amber-100 text-amber-800',
  sudden: 'bg-rose-100 text-rose-800',
  exam: 'bg-violet-100 text-violet-800',
  event: 'bg-sky-100 text-sky-800',
};

function greetingForHour(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function sectionKey(className, sectionName) {
  return `${String(className ?? '').trim().toUpperCase()}-${String(sectionName ?? '').trim().toUpperCase()}`;
}

function classIcon(className) {
  const n = String(className || '').toUpperCase();
  if (n === 'LKG' || n === 'UKG') return Baby;
  if (/^\d+$/.test(n) && Number(n) >= 9) return GraduationCap;
  return BookOpen;
}

function pctOf(part, whole) {
  if (!whole) return 0;
  return Math.round((Number(part || 0) / Number(whole)) * 1000) / 10;
}

function allowedSectionKeys(user, classesData) {
  const role = String(user?.role || '').toUpperCase();
  if (!user || FULL_ACCESS_ROLES.has(role)) return null;
  const keys = new Set();
  for (const klass of classesData || []) {
    for (const sec of klass.sections || []) {
      keys.add(sectionKey(klass.name, sec.name));
    }
  }
  return keys;
}

function eventChip(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { day: '—', month: '—' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
  };
}

function emptyGroup(className) {
  return {
    className,
    classId: className,
    sections: 0,
    marked: 0,
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    odHalfDay: 0,
    odFullDay: 0,
    students: 0,
  };
}

function withPercent(g) {
  return {
    ...g,
    attendancePercent: attendancePercentFromCounts({
      present: g.present,
      absent: g.absent,
      late: g.late,
      halfDay: g.halfDay,
      odHalfDay: g.odHalfDay,
      odFullDay: g.odFullDay,
    }),
  };
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-16 text-sm text-gray-500 shadow-sm">
      <LoaderCircle className="animate-spin text-indigo-500" size={18} />
      Loading attendance…
    </div>
  );
}

function StandardCards({ items, onOpen }) {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        {items.map((std, i) => (
          <MobileStandardCard
            key={std.classId || std.sectionName}
            title={std.title}
            subtitle={std.subtitle}
            present={std.present}
            absent={std.absent}
            percent={std.attendancePercent}
            unmarked={!std.marked}
            tone={pastelAt(i + 2)}
            onClick={() => onOpen(std)}
          />
        ))}
      </div>
      <div className="hidden gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
        {items.map((std, i) => {
          const tone = pastelAt(i);
          const unmarked = !std.marked;
          return (
            <button
              key={std.classId || std.sectionName}
              type="button"
              onClick={() => onOpen(std)}
              className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.bg} ${tone.border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-lg font-bold ${tone.accent}`}>{std.title}</p>
                  <p className="mt-1 text-sm font-medium text-gray-600">{std.subtitle}</p>
                </div>
                <CircularAttendance
                  percent={std.attendancePercent}
                  strokeClass={tone.bar}
                  unmarked={unmarked}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Present</p>
                  <p className="font-bold text-emerald-700">{std.present}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Absent</p>
                  <p className="font-bold text-rose-700">{std.absent}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Attendance</p>
                  <p className="font-bold text-gray-900">{unmarked ? 'Not marked' : `${std.attendancePercent}%`}</p>
                </div>
              </div>
              <p className={`mt-4 text-sm font-semibold ${tone.accent}`}>{std.cta}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ClassesDrillPage({ date, standards, stats, onNavigate }) {
  const kpis = [
    { label: 'Total Classes', value: standards.length, icon: BookOpen, tone: 'indigo' },
    { label: 'Total Students', value: stats.totalStudents ?? '—', icon: Users, tone: 'sky' },
    { label: 'Present Today', value: stats.presentToday ?? 0, icon: CheckCircle2, tone: 'green' },
    { label: 'Absent Today', value: stats.absentToday ?? 0, icon: XCircle, tone: 'red' },
    { label: 'Late Today', value: stats.lateToday ?? 0, icon: Clock, tone: 'amber' },
    { label: 'Attendance %', value: `${stats.attendancePercent ?? 0}%`, icon: Percent, tone: 'violet' },
  ];
  return (
    <div>
      <ReportPageHeader
        title="Attendance by Standard"
        subtitle={`School-wide attendance for ${formatShortDate(date)}. Open a class to view its sections.`}
        breadcrumb={[{ label: 'Dashboard', path: { view: 'home' } }, { label: 'Classes' }]}
        onBack={() => onNavigate({ view: 'home' })}
        onNavigate={onNavigate}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="contents">
            <div className="lg:hidden">
              <MobileKpi label={kpi.label} value={kpi.value} icon={kpi.icon} />
            </div>
            <div className="hidden lg:block">
              <KpiCard label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
            </div>
          </div>
        ))}
      </div>
      <h3 className="mb-1 text-base font-bold text-gray-900">Classes</h3>
      <p className="mb-3 text-sm text-gray-500">Click a class to open its sections page</p>
      <StandardCards
        items={standards.map((std) => ({
          ...std,
          title: formatClassLabel(std.className),
          subtitle: `${std.students} Students · ${std.sections} sections`,
          cta: 'View Sections →',
        }))}
        onOpen={(std) => onNavigate({ view: 'class', classId: std.className })}
      />
    </div>
  );
}

function ClassDrillPage({ classId, date, sections, onNavigate }) {
  const label = formatClassLabel(classId);
  const totals = useMemo(() => withPercent(sections.reduce((t, s) => {
    t.sections += 1;
    t.students += s.studentCount || 0;
    t.present += s.present || 0;
    t.absent += s.absent || 0;
    t.late += s.late || 0;
    t.halfDay += s.halfDay || 0;
    t.odHalfDay += s.odHalfDay || 0;
    t.odFullDay += s.odFullDay || 0;
    t.marked += s.marked || 0;
    return t;
  }, emptyGroup(classId))), [classId, sections]);

  const kpis = [
    { label: 'Total Sections', value: totals.sections, icon: ClipboardList, tone: 'indigo' },
    { label: 'Total Students', value: totals.students, icon: Users, tone: 'sky' },
    { label: 'Present', value: totals.present, icon: CheckCircle2, tone: 'green' },
    { label: 'Absent', value: totals.absent, icon: XCircle, tone: 'red' },
    { label: 'Late / Half Day', value: (totals.late || 0) + (totals.halfDay || 0), icon: Clock, tone: 'amber' },
    { label: 'Attendance', value: `${totals.attendancePercent}%`, icon: Percent, tone: 'violet' },
  ];

  return (
    <div>
      <ReportPageHeader
        title={`${label} Attendance`}
        subtitle={`Section-wise attendance for ${formatShortDate(date)}`}
        breadcrumb={[
          { label: 'Dashboard', path: { view: 'home' } },
          { label: 'Classes', path: { view: 'classes' } },
          { label },
        ]}
        onBack={() => onNavigate({ view: 'classes' })}
        onNavigate={onNavigate}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="contents">
            <div className="lg:hidden">
              <MobileKpi label={kpi.label} value={kpi.value} icon={kpi.icon} />
            </div>
            <div className="hidden lg:block">
              <KpiCard label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
            </div>
          </div>
        ))}
      </div>
      <h3 className="mb-3 text-base font-bold text-gray-900">Sections</h3>
      <StandardCards
        items={sections.map((sec) => ({
          ...sec,
          title: `${label} – ${sec.sectionName}`,
          subtitle: `${sec.studentCount} Students`,
          cta: 'View Section →',
        }))}
        onOpen={(sec) =>
          onNavigate({ view: 'section', classId, sectionId: sec.sectionName })
        }
      />
    </div>
  );
}

function studentSummaryRows(students) {
  return (students || []).map((s) => {
    const code = s.status && s.status !== '' ? s.status : 'P';
    const pct =
      s.attendancePercent != null
        ? s.attendancePercent
        : code === 'P'
          ? 100
          : code === 'A'
            ? 0
            : 85;
    return {
      roll: String(s.rollNo ?? '').padStart(2, '0'),
      name: s.name || '',
      status: STATUS_LABELS[code] || code,
      pct,
      band: attendanceBand(pct).label,
    };
  });
}

function SectionDrillPage({ classId, sectionId, date, report, loading, onNavigate }) {
  const [exporting, setExporting] = useState(null);
  const label = `${formatClassLabel(classId)} – ${sectionId}`;
  const summary = report?.summary || {};
  const students = report?.students || [];
  const exportRows = useMemo(() => studentSummaryRows(students), [students]);
  const dateText = formatShortDate(date);
  const fileStub = `attendance-${String(classId).replace(/\s+/g, '')}-${sectionId}-${date}`;

  const handleDownloadPdf = () => {
    if (!exportRows.length) return;
    setExporting('pdf');
    try {
      exportTablePdfReport({
        title: 'STUDENT ATTENDANCE SUMMARY',
        pill: `${label} · ${dateText}`,
        dateLabel: dateText,
        headers: ['Roll No', 'Student Name', 'Status', 'Attendance %', 'Band'],
        rows: exportRows.map((r) => [r.roll, r.name, r.status, `${r.pct}%`, r.band]),
      });
    } finally {
      setTimeout(() => setExporting(null), 400);
    }
  };

  const handleDownloadCsv = async () => {
    if (!exportRows.length) return;
    setExporting('csv');
    try {
      await downloadCsv(`${fileStub}.csv`, [
        ['Roll No', 'Student Name', 'Status', 'Attendance %', 'Band'].map(escapeCsv).join(','),
        ...exportRows.map((r) => [r.roll, r.name, r.status, `${r.pct}%`, r.band].map(escapeCsv).join(',')),
      ]);
    } finally {
      setExporting(null);
    }
  };

  if (loading || !report) return <LoadingBlock />;

  const downloadButtons = (compact = false) => (
    <>
      <button
        type="button"
        onClick={handleDownloadCsv}
        disabled={!exportRows.length || Boolean(exporting)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
      >
        {exporting === 'csv' ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
        CSV
      </button>
      <button
        type="button"
        onClick={handleDownloadPdf}
        disabled={!exportRows.length || Boolean(exporting)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
      >
        {exporting === 'pdf' ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
        {compact ? 'PDF' : 'Download PDF'}
      </button>
    </>
  );

  return (
    <div>
      <ReportPageHeader
        title={`${label} Attendance`}
        subtitle={`Student attendance for ${dateText}`}
        breadcrumb={[
          { label: 'Dashboard', path: { view: 'home' } },
          { label: 'Classes', path: { view: 'classes' } },
          { label: formatClassLabel(classId), path: { view: 'class', classId } },
          { label: `Section ${sectionId}` },
        ]}
        onBack={() => onNavigate({ view: 'class', classId })}
        onNavigate={onNavigate}
        actions={report?.holiday ? null : downloadButtons()}
      />
      {report?.holiday ? (
        <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          This date is a Sunday or calendar holiday and is excluded from attendance.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Total Students" value={summary.total ?? students.length} icon={Users} tone="sky" />
            <KpiCard label="Present Today" value={summary.present ?? 0} icon={CheckCircle2} tone="green" />
            <KpiCard label="Absent Today" value={summary.absent ?? 0} icon={XCircle} tone="red" />
            <KpiCard label="Late" value={summary.late ?? 0} icon={Clock} tone="amber" />
            <KpiCard label="Half Day" value={summary.halfDay ?? 0} icon={ClipboardList} tone="violet" />
            <KpiCard label="Attendance %" value={`${summary.attendancePercent ?? 0}%`} icon={Percent} tone="indigo" />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">Student Attendance Summary</h3>
              <div className="flex flex-wrap gap-2 lg:hidden">{downloadButtons(true)}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Roll No</th>
                    <th className="px-4 py-3 font-semibold">Student Name</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Attendance %</th>
                    <th className="px-4 py-3 font-semibold">Band</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const code = s.status && s.status !== '' ? s.status : 'P';
                    const pct =
                      s.attendancePercent != null
                        ? s.attendancePercent
                        : code === 'P'
                          ? 100
                          : code === 'A'
                            ? 0
                            : 85;
                    const band = attendanceBand(pct);
                    return (
                      <tr key={s.studentId || s.rollNo} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {String(s.rollNo ?? '').padStart(2, '0')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 text-gray-700">{STATUS_LABELS[code] || code}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{pct}%</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${band.className}`}>
                            {band.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!students.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                        No students found for this section.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, iconWrap, bar, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm ${
        onClick ? 'cursor-pointer hover:border-violet-300 hover:shadow-md' : 'border-gray-200'
      } ${active ? 'border-violet-500 ring-2 ring-violet-200' : 'border-gray-200'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="truncate text-2xl font-bold leading-tight text-gray-900">{value}</p>
          {sub ? <p className="mt-0.5 truncate text-[11px] text-gray-500">{sub}</p> : null}
        </div>
      </div>
      {bar != null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      ) : null}
    </Tag>
  );
}

export default function DashboardPage({
  stats,
  error,
  dateLabel,
  selectedDate,
  onNavigate,
  user = null,
  classesData = [],
}) {
  const allowed = useMemo(() => allowedSectionKeys(user, classesData), [user, classesData]);
  const [classRows, setClassRows] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [drill, setDrill] = useState({ view: 'home' });
  const [sectionReport, setSectionReport] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getClassComparison({ date: selectedDate });
        if (cancelled) return;
        const rows = (data.classes || []).filter((row) => {
          if (!allowed) return true;
          return allowed.has(sectionKey(row.className, row.sectionName));
        });
        setClassRows(rows);
      } catch {
        if (cancelled) return;
        const fallback = (classesData || []).flatMap((klass) =>
          (klass.sections || []).map((sec) => ({
            className: klass.name,
            sectionName: sec.name,
            label: `${klass.name}-${sec.name}`,
            studentCount: sec.studentCount || 0,
            present: 0,
            absent: 0,
            late: 0,
            halfDay: 0,
            odHalfDay: 0,
            odFullDay: 0,
            marked: 0,
            attendancePercent: 0,
          }))
        );
        setClassRows(
          allowed ? fallback.filter((r) => allowed.has(sectionKey(r.className, r.sectionName))) : fallback
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, allowed, classesData]);

  useEffect(() => {
    let cancelled = false;
    getScheduledEvents(6)
      .then((events) => {
        if (!cancelled) setUpcomingEvents(events || []);
      })
      .catch(() => {
        if (!cancelled) setUpcomingEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (drill.view !== 'section' || !drill.classId || !drill.sectionId) {
      setSectionReport(null);
      return undefined;
    }
    let cancelled = false;
    setSectionLoading(true);
    (async () => {
      try {
        const sid = await resolveSectionId(drill.classId, drill.sectionId);
        const report = await getDailyReport({
          date: selectedDate,
          sectionId: sid || undefined,
          className: drill.classId,
          section: drill.sectionId,
        });
        if (!cancelled) setSectionReport(report);
      } catch {
        if (!cancelled) setSectionReport({ students: [], summary: {} });
      } finally {
        if (!cancelled) setSectionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drill, selectedDate]);

  const classOverview = useMemo(() => {
    const map = new Map();
    for (const row of classRows) {
      const cur = map.get(row.className) || emptyGroup(row.className);
      cur.sections += 1;
      cur.marked += Number(row.marked || 0);
      cur.present += Number(row.present || 0);
      cur.absent += Number(row.absent || 0);
      cur.late += Number(row.late || 0);
      cur.halfDay += Number(row.halfDay || 0);
      cur.odHalfDay += Number(row.odHalfDay || 0);
      cur.odFullDay += Number(row.odFullDay || 0);
      cur.students += Number(row.studentCount || 0);
      map.set(row.className, cur);
    }
    return [...map.values()].map(withPercent).sort((a, b) => compareClassNames(a.className, b.className));
  }, [classRows]);

  const classSections = useMemo(
    () =>
      classRows
        .filter((r) => String(r.className) === String(drill.classId))
        .sort((a, b) => String(a.sectionName).localeCompare(String(b.sectionName))),
    [classRows, drill.classId]
  );

  const markedRows = classRows.filter((r) => Number(r.marked || 0) > 0);
  const takenPct = classRows.length ? pctOf(markedRows.length, classRows.length) : 0;
  const overallPct = Number(stats.attendancePercent || 0);
  const totalStudents = Number(stats.totalStudents || 0);
  const present = Number(stats.presentToday || 0);
  const absent = Number(stats.absentToday || 0);
  const late = Number(stats.lateToday || 0);
  const marked = Number(stats.markedToday || 0);

  const firstName = (user?.name || 'Admin').split(/\s+/)[0];
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Teacher';
  const hello = greetingForHour();

  const quickActions = [
    { id: 'attendance', label: 'Mark Attendance', icon: ClipboardCheck, color: 'bg-indigo-50 text-indigo-700' },
    { id: 'students', label: 'Students', icon: Users, color: 'bg-violet-50 text-violet-700' },
    { id: 'leave-letters', label: 'Leave Letters', icon: FileText, color: 'bg-sky-50 text-sky-700' },
    { id: 'edit-approvals', label: 'Edit Approvals', icon: Shield, color: 'bg-amber-50 text-amber-700' },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, color: 'bg-emerald-50 text-emerald-700' },
    { id: 'reports', label: 'Reports', icon: BarChart2, color: 'bg-rose-50 text-rose-700' },
    { id: 'send-notification', label: 'Notify', icon: Megaphone, color: 'bg-orange-50 text-orange-700' },
    { id: 'notifications', label: 'Notices', icon: Bell, color: 'bg-teal-50 text-teal-700' },
  ].filter((a) => a.id !== 'edit-approvals' || canApproveEditRequests(user));

  const goDrill = (next) => setDrill(next || { view: 'home' });

  if (drill.view === 'classes') {
    return (
      <ClassesDrillPage date={selectedDate} standards={classOverview} stats={stats} onNavigate={goDrill} />
    );
  }
  if (drill.view === 'class') {
    return (
      <ClassDrillPage
        classId={drill.classId}
        date={selectedDate}
        sections={classSections}
        onNavigate={goDrill}
      />
    );
  }
  if (drill.view === 'section') {
    return (
      <SectionDrillPage
        classId={drill.classId}
        sectionId={drill.sectionId}
        date={selectedDate}
        report={sectionReport}
        loading={sectionLoading}
        onNavigate={goDrill}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            {hello}, {firstName}! <span aria-hidden="true">👋</span>
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {roleLabel} · Here&apos;s what&apos;s happening with attendance, classes and the calendar today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dateLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
              <CalendarDays size={14} className="text-indigo-600" />
              {dateLabel.replace(/^Today\s*[•·]\s*/i, '')}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onNavigate?.('attendance', 'grid')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
          >
            <ClipboardCheck size={16} />
            Take Attendance
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load live stats: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <MetricCard
          label="Total Students"
          value={totalStudents}
          sub="Open classes, then sections"
          icon={Users}
          iconWrap="bg-violet-100 text-violet-700"
          onClick={() => goDrill({ view: 'classes' })}
          active
        />
        <MetricCard
          label="Present Today"
          value={present}
          sub={`${pctOf(present, marked || totalStudents)}% of marked`}
          icon={UserCheck}
          iconWrap="bg-emerald-100 text-emerald-700"
        />
        <MetricCard
          label="Absent Today"
          value={absent}
          sub={`${pctOf(absent, marked || totalStudents)}% of marked`}
          icon={UserX}
          iconWrap="bg-red-100 text-red-600"
        />
        <MetricCard
          label="Late Today"
          value={late}
          sub={`${pctOf(late, marked || totalStudents)}% of marked`}
          icon={Clock}
          iconWrap="bg-amber-100 text-amber-700"
        />
        <MetricCard
          label="Attendance %"
          value={`${overallPct}%`}
          sub="Of marked today"
          icon={BarChart2}
          iconWrap="bg-sky-100 text-sky-700"
        />
        <MetricCard
          label="Classes marked"
          value={`${markedRows.length}/${classRows.length || stats.totalClasses || 0}`}
          sub={`${takenPct}% attendance taken`}
          icon={ClipboardCheck}
          iconWrap="bg-indigo-100 text-indigo-700"
          bar={takenPct}
          onClick={() => goDrill({ view: 'classes' })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-4 lg:hidden">
        {quickActions.slice(0, 4).map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate?.(action.id)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white px-2 py-3 shadow-sm"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
              <action.icon size={18} />
            </span>
            <span className="text-[10px] font-semibold text-gray-800">{action.label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-gray-900">Attendance marked</h3>
            <button
              type="button"
              onClick={() => goDrill({ view: 'classes' })}
              className="text-xs font-semibold text-violet-700 hover:text-violet-900"
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-2 font-semibold">Class / Section</th>
                  <th className="pb-2 font-semibold">Present</th>
                  <th className="pb-2 font-semibold">Absent</th>
                  <th className="pb-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {markedRows.slice(0, 6).map((row) => (
                  <tr
                    key={`${row.className}-${row.sectionName}`}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      goDrill({
                        view: 'section',
                        classId: row.className,
                        sectionId: row.sectionName,
                      })
                    }
                  >
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2 font-semibold text-gray-900">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                        {row.label || `${row.className}-${row.sectionName}`}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-700">{row.present}</td>
                    <td className="py-2.5 text-gray-700">{row.absent}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-700">{row.attendancePercent}%</td>
                  </tr>
                ))}
                {!markedRows.length ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                      No class attendance submitted yet for this date.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {markedRows.length > 6 ? (
            <p className="mt-3 text-xs font-medium text-gray-500">+ {markedRows.length - 6} more classes marked</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">Classes</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {totalStudents} students · open a class to see its sections
              </p>
            </div>
            <button
              type="button"
              onClick={() => goDrill({ view: 'classes' })}
              className="text-xs font-semibold text-violet-700 hover:text-violet-900"
            >
              View all
            </button>
          </div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {classOverview.map((klass, idx) => {
              const style = CLASS_CARD_STYLES[idx % CLASS_CARD_STYLES.length];
              const Icon = classIcon(klass.className);
              return (
                <button
                  key={klass.className}
                  type="button"
                  onClick={() => goDrill({ view: 'class', classId: klass.className })}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${style.wrap}`}
                >
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white ${style.icon}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">{formatClassLabel(klass.className)}</p>
                    <p className="text-[11px] text-gray-500">
                      {klass.sections} sections · {klass.students} students
                    </p>
                  </div>
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${style.pct}`}>
                    {klass.attendancePercent}%
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              );
            })}
            {!classOverview.length ? (
              <p className="px-2 py-6 text-sm text-gray-500">No classes assigned to your account.</p>
            ) : null}
          </div>
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Overall class attendance</span>
              <span className="font-bold text-gray-900">{overallPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, overallPct)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Upcoming events</h3>
          <button
            type="button"
            onClick={() => onNavigate?.('calendar')}
            className="text-xs font-semibold text-violet-700 hover:text-violet-900"
          >
            View all events
          </button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingEvents.map((event) => {
            const chip = eventChip(event.date);
            const tag = EVENT_TAG[event.type] || EVENT_TAG.event;
            return (
              <li key={event.id || `${event.date}-${event.title}`} className="flex gap-3">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-800">
                  <span className="text-[10px] font-semibold leading-none">{chip.month}</span>
                  <span className="text-sm font-bold leading-tight">{chip.day}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.source === 'school' ? 'School' : 'Calendar'}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tag}`}>
                    {event.type || 'event'}
                  </span>
                </div>
              </li>
            );
          })}
          {!upcomingEvents.length ? <li className="text-sm text-gray-500">No upcoming events scheduled.</li> : null}
        </ul>
      </div>

      <div className="hidden gap-3 lg:grid lg:grid-cols-8">
        {quickActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate?.(action.id)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-3 text-center shadow-sm hover:border-violet-200 hover:shadow-md"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
              <action.icon size={18} />
            </span>
            <span className="text-[11px] font-semibold text-gray-800">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
