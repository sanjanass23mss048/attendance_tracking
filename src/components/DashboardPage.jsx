import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart2,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileText,
  LoaderCircle,
  Megaphone,
  Pencil,
  Percent,
  ScrollText,
  Shield,
  UserCheck,
  Users,
  UserX,
  XCircle,
} from 'lucide-react';
import { formatClassLabel, compareClassNames } from '../data/schoolGrades.js';
import {
  canApproveEditRequests,
  canViewAuditLogs,
  usesCompactSchoolNav,
} from '../data/navItems.js';
import { IntelligenceDashboardCards } from './AttendanceIntelligencePage.jsx';
import {
  downloadCsv,
  escapeCsv,
  exportTablePdfReport,
  getClassComparison,
  getDailyReport,
} from '../services/reportService.js';
import { resolveSectionId } from '../services/classService.js';
import {
  attendancePercentFromCounts,
  getTodayAttendanceDate,
  shiftAttendanceDate,
  snapToWorkingAttendanceDate,
} from '../utils/attendance.js';
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

function sectionKey(className, sectionName) {
  return `${String(className ?? '').trim().toUpperCase()}-${String(sectionName ?? '').trim().toUpperCase()}`;
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

/** School year runs Apr → Mar (month index >= 3 is April). */
function academicYearStartFromDate(isoDate) {
  const d = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  return m >= 3 ? y : y - 1;
}

function formatAcademicYearKey(startYear) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function academicYearLabel(isoDate) {
  return `Academic Year ${formatAcademicYearKey(academicYearStartFromDate(isoDate))}`;
}

function academicYearRange(startYear) {
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

/** Current year plus the previous two (newest first). */
function academicYearOptions(todayIso) {
  const currentStart = academicYearStartFromDate(todayIso);
  return [0, 1, 2].map((offset) => {
    const startYear = currentStart - offset;
    return {
      startYear,
      key: formatAcademicYearKey(startYear),
      label: `Academic Year ${formatAcademicYearKey(startYear)}`,
    };
  });
}

function dateForAcademicYear(startYear, preferredIso, todayIso) {
  const { start, end } = academicYearRange(startYear);
  if (preferredIso && preferredIso >= start && preferredIso <= end) {
    return preferredIso > todayIso ? todayIso : preferredIso;
  }
  if (todayIso >= start && todayIso <= end) return todayIso;
  if (end < todayIso) return end;
  return start;
}

function formatHeaderDate(isoDate, dateLabel) {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const d = new Date(`${isoDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  if (dateLabel) return dateLabel.replace(/^Today\s*[•·]\s*/i, '');
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const FULL_QUICK_ACTION_DEFS = [
  {
    id: 'attendance',
    label: 'Mark Attendance',
    description: 'Take daily or period attendance quickly.',
    icon: ClipboardCheck,
    iconBg: 'bg-violet-600',
    arrowBg: 'bg-violet-600 hover:bg-violet-700',
  },
  {
    id: 'students',
    label: 'Students',
    description: 'View and manage student information.',
    icon: Users,
    iconBg: 'bg-sky-600',
    arrowBg: 'bg-sky-600 hover:bg-sky-700',
  },
  {
    id: 'leave-letters',
    label: 'Leave Letters',
    description: 'Generate and manage leave letters.',
    icon: FileText,
    iconBg: 'bg-emerald-600',
    arrowBg: 'bg-emerald-600 hover:bg-emerald-700',
  },
  {
    id: 'edit-approvals',
    label: 'Edit Approvals',
    description: 'Review and approve attendance edits.',
    icon: Shield,
    iconBg: 'bg-amber-500',
    arrowBg: 'bg-amber-500 hover:bg-amber-600',
    roles: true,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'View academic and holiday calendar.',
    icon: CalendarDays,
    iconBg: 'bg-pink-500',
    arrowBg: 'bg-pink-500 hover:bg-pink-600',
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Explore attendance reports and analytics.',
    icon: BarChart2,
    iconBg: 'bg-indigo-700',
    arrowBg: 'bg-indigo-700 hover:bg-indigo-800',
  },
  {
    id: 'send-notification',
    label: 'Notify',
    description: 'Send messages to students & parents.',
    icon: Megaphone,
    iconBg: 'bg-orange-500',
    arrowBg: 'bg-orange-500 hover:bg-orange-600',
  },
  {
    id: 'notifications',
    label: 'Notices',
    description: 'Create and publish school notices.',
    icon: Bell,
    iconBg: 'bg-teal-600',
    arrowBg: 'bg-teal-600 hover:bg-teal-700',
  },
];

const COMPACT_QUICK_ACTION_DEFS = [
  {
    id: 'attendance',
    label: 'Mark Attendance',
    description: 'Take daily or period attendance quickly.',
    icon: ClipboardCheck,
    iconBg: 'bg-violet-600',
    arrowBg: 'bg-violet-600 hover:bg-violet-700',
  },
  {
    id: 'students',
    label: 'Students',
    description: 'View and manage student information.',
    icon: Users,
    iconBg: 'bg-sky-600',
    arrowBg: 'bg-sky-600 hover:bg-sky-700',
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Explore attendance reports and analytics.',
    icon: BarChart2,
    iconBg: 'bg-indigo-700',
    arrowBg: 'bg-indigo-700 hover:bg-indigo-800',
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    description: 'Review attendance and system activity.',
    icon: ScrollText,
    iconBg: 'bg-slate-700',
    arrowBg: 'bg-slate-700 hover:bg-slate-800',
    audit: true,
  },
  {
    id: 'send-notification',
    label: 'Notify',
    description: 'Send messages to students & parents.',
    icon: Megaphone,
    iconBg: 'bg-orange-500',
    arrowBg: 'bg-orange-500 hover:bg-orange-600',
  },
];

function QuickActionCard({ action, onNavigate }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(action.id, action.id === 'attendance' ? 'grid' : undefined)}
      className="flex flex-col rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-100 hover:shadow-md"
    >
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${action.iconBg}`}
      >
        <Icon size={18} />
      </span>
      <p className="mt-3 text-sm font-bold text-gray-900">{action.label}</p>
      <p className="mt-0.5 line-clamp-2 flex-1 text-[11px] leading-snug text-gray-500">
        {action.description}
      </p>
      <span
        className={`mt-3 inline-flex h-8 w-8 items-center justify-center self-end rounded-full text-white ${action.arrowBg}`}
        aria-hidden="true"
      >
        <ChevronRight size={16} />
      </span>
    </button>
  );
}

function OverviewStat({ label, value, badge, badgeTone, icon: Icon, iconWrap, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  const badgeClass =
    badgeTone === 'emerald'
      ? 'bg-emerald-100 text-emerald-700'
      : badgeTone === 'rose'
        ? 'bg-rose-100 text-rose-700'
        : badgeTone === 'amber'
          ? 'bg-amber-100 text-amber-800'
          : badgeTone === 'sky'
            ? 'bg-sky-100 text-sky-700'
            : 'bg-violet-100 text-violet-700';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-sm ${
        onClick ? 'cursor-pointer hover:border-violet-200 hover:bg-violet-50/40' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-gray-500">{label}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">{value}</p>
          {badge ? (
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
              {badge}
            </span>
          ) : null}
        </div>
      </div>
    </Tag>
  );
}

export default function DashboardPage({
  stats,
  error,
  dateLabel,
  selectedDate,
  onDateChange,
  onNavigate,
  user = null,
  classesData = [],
}) {
  const allowed = useMemo(() => allowedSectionKeys(user, classesData), [user, classesData]);
  const [classRows, setClassRows] = useState([]);
  const [drill, setDrill] = useState({ view: 'home' });
  const [sectionReport, setSectionReport] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const todayIso = getTodayAttendanceDate();
  const datePickerRef = useRef(null);
  const yearMenuRef = useRef(null);

  const overviewTab = useMemo(() => {
    if (selectedDate === todayIso) return 'today';
    if (selectedDate === shiftAttendanceDate(todayIso, -1)) return 'previous';
    return 'custom';
  }, [selectedDate, todayIso]);

  const selectToday = () => onDateChange?.(todayIso);
  const selectPrevious = async () => {
    const prev = await snapToWorkingAttendanceDate(shiftAttendanceDate(todayIso, -1));
    onDateChange?.(prev);
  };
  const selectCustomDate = (iso) => {
    if (!iso || iso > todayIso) return;
    onDateChange?.(iso);
  };

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
  const unmarkedCount = Math.max(0, classRows.length - markedRows.length);
  const takenPct = classRows.length ? pctOf(markedRows.length, classRows.length) : 0;
  const totalStudents = Number(stats.totalStudents || 0);
  const present = Number(stats.presentToday || 0);
  const absent = Number(stats.absentToday || 0);
  const halfDayOd =
    Number(stats.halfDayToday || 0) +
    Number(stats.odHalfDayToday || 0) +
    Number(stats.odFullDayToday || 0);

  const firstName = (user?.name || 'Admin').split(/\s+/)[0];
  const headerDate = formatHeaderDate(selectedDate, dateLabel);
  const academicYear = academicYearLabel(selectedDate);
  const yearOptions = useMemo(() => academicYearOptions(todayIso), [todayIso]);
  const selectedYearStart = academicYearStartFromDate(selectedDate);

  useEffect(() => {
    if (!yearMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (yearMenuRef.current && !yearMenuRef.current.contains(event.target)) {
        setYearMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setYearMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [yearMenuOpen]);

  const selectAcademicYear = (startYear) => {
    const next = dateForAcademicYear(startYear, selectedDate, todayIso);
    setYearMenuOpen(false);
    if (next && next !== selectedDate) onDateChange?.(next);
  };

  const compactNav = usesCompactSchoolNav();
  const quickActions = (compactNav ? COMPACT_QUICK_ACTION_DEFS : FULL_QUICK_ACTION_DEFS).filter((a) => {
    if (a.roles && !canApproveEditRequests(user)) return false;
    if (a.audit && !canViewAuditLogs(user)) return false;
    return true;
  });

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Welcome back, {firstName}! <span aria-hidden="true">👋</span>
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s what&apos;s happening in your school today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm">
            <CalendarDays size={15} className="text-violet-600" />
            {headerDate}
          </span>
          <div className="relative" ref={yearMenuRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={yearMenuOpen}
              onClick={() => setYearMenuOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-800"
            >
              {academicYear}
              <ChevronDown
                size={14}
                className={`opacity-80 transition ${yearMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {yearMenuOpen ? (
              <ul
                role="listbox"
                aria-label="Academic year"
                className="absolute right-0 z-20 mt-1.5 min-w-[12.5rem] overflow-hidden rounded-xl border border-violet-100 bg-white py-1 shadow-lg"
              >
                {yearOptions.map((opt) => {
                  const active = opt.startYear === selectedYearStart;
                  return (
                    <li key={opt.key} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={() => selectAcademicYear(opt.startYear)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold ${
                          active
                            ? 'bg-violet-50 text-violet-800'
                            : 'text-gray-700 hover:bg-violet-50 hover:text-violet-800'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {active ? <CheckCircle2 size={14} className="shrink-0 text-violet-600" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load live stats: {error}
        </div>
      ) : null}

      <div
        className={`grid grid-cols-2 gap-3 ${
          compactNav ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4 xl:grid-cols-8'
        }`}
      >
        {quickActions.map((action) => (
          <QuickActionCard key={action.id} action={action} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-indigo-600" />
            <h3 className="text-base font-bold text-gray-900">Today&apos;s Attendance Overview</h3>
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50/60 p-1">
            <button
              type="button"
              onClick={selectToday}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                overviewTab === 'today'
                  ? 'bg-indigo-700 text-white shadow-sm'
                  : 'text-indigo-800 hover:bg-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={selectPrevious}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                overviewTab === 'previous'
                  ? 'bg-indigo-700 text-white shadow-sm'
                  : 'text-indigo-800 hover:bg-white'
              }`}
            >
              Previous Day
            </button>
            <button
              type="button"
              onClick={() => datePickerRef.current?.showPicker?.() || datePickerRef.current?.click()}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                overviewTab === 'custom'
                  ? 'bg-amber-400 text-amber-950 shadow-sm'
                  : 'text-indigo-800 hover:bg-white'
              }`}
            >
              Select Date <CalendarDays size={13} />
            </button>
            <input
              ref={datePickerRef}
              type="date"
              value={selectedDate}
              max={todayIso}
              onChange={(e) => selectCustomDate(e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
          </div>
        </div>
        <p className="mb-3 text-sm font-semibold text-indigo-900">{headerDate}</p>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-5">
            <OverviewStat
              label="Total Students"
              value={totalStudents.toLocaleString()}
              icon={Users}
              iconWrap="bg-violet-100 text-violet-700"
              onClick={() => goDrill({ view: 'classes' })}
            />
            <OverviewStat
              label="Present"
              value={present.toLocaleString()}
              badge={`${pctOf(present, totalStudents)}%`}
              badgeTone="emerald"
              icon={UserCheck}
              iconWrap="bg-emerald-100 text-emerald-700"
            />
            <OverviewStat
              label="Absent"
              value={absent.toLocaleString()}
              badge={`${pctOf(absent, totalStudents)}%`}
              badgeTone="rose"
              icon={UserX}
              iconWrap="bg-red-100 text-red-600"
            />
            <OverviewStat
              label="Half Day / OD"
              value={halfDayOd.toLocaleString()}
              badge={`${pctOf(halfDayOd, totalStudents)}%`}
              badgeTone="amber"
              icon={Clock}
              iconWrap="bg-amber-100 text-amber-700"
            />
            <OverviewStat
              label="Attendance Taken"
              value={`${markedRows.length} / ${classRows.length || stats.totalClasses || 0}`}
              badge={`${takenPct}%`}
              badgeTone="sky"
              icon={Pencil}
              iconWrap="bg-sky-100 text-sky-700"
              onClick={() => goDrill({ view: 'classes' })}
            />
          </div>

          {unmarkedCount > 0 ? (
            <div className="flex w-full shrink-0 flex-col justify-between rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 xl:w-64">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-200 text-violet-800">
                  <ClipboardList size={18} />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Attendance not marked</p>
                  <p className="mt-1 text-2xl font-bold text-violet-900">
                    {unmarkedCount} {unmarkedCount === 1 ? 'Class' : 'Classes'}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">Mark attendance to keep records current.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('attendance', 'grid')}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
              >
                Go to Attendance
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="flex w-full shrink-0 flex-col justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 xl:w-64">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Overall Attendance
                </p>
                <p className="mt-1 text-3xl font-bold text-amber-950">
                  {stats.attendancePercent != null ? `${stats.attendancePercent}%` : '—'}
                </p>
                <p className="mt-1 text-xs text-amber-900/80">{headerDate}</p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('attendance-history', { date: selectedDate })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            View Class-wise Report
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => goDrill({ view: 'classes' })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-50"
          >
            Drill down on dashboard
          </button>
        </div>
      </div>

      {canApproveEditRequests(user) ? (
        <IntelligenceDashboardCards
          onOpen={(tab) => onNavigate?.('attendance-intelligence', tab)}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  );
}
