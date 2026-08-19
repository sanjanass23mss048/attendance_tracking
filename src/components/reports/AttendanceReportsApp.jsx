import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Percent,
  School,
  UserRound,
  Users,
  XCircle,
  Clock3,
} from 'lucide-react';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { formatClassLabel, compareClassNames } from '../../data/schoolGrades.js';
import { getTodayAttendanceDate, attendancePercentFromCounts } from '../../utils/attendance.js';
import { getAttendanceSummary } from '../../services/attendanceService.js';
import {
  getClassComparison,
  getDailyReport,
  getMonthlyReport,
} from '../../services/reportService.js';
import { getClasses, resolveSectionId } from '../../services/classService.js';
import { getStudents } from '../../services/studentService.js';
import {
  buildAttendancePath,
  readHashPath,
  writeHashPath,
  STATUS_ROUTE_MAP,
  STATUS_LABELS,
} from './attendancePaths.js';
import {
  CircularAttendance,
  KpiCard,
  MobileKpi,
  MobileStandardCard,
  ReportPageHeader,
  attendanceBand,
  formatShortDate,
  pastelAt,
} from './attendanceReportUi.jsx';

const DIST_COLORS = {
  Present: '#22c55e',
  Absent: '#ef4444',
  Late: '#f59e0b',
  'Half Day': '#8b5cf6',
  'OD Half Day': '#06b6d4',
  'OD Full Day': '#0f766e',
};

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function aggregateStandards(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row.className);
    if (!map.has(key)) {
      map.set(key, {
        classId: key,
        className: key,
        sections: 0,
        studentCount: 0,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        odHalfDay: 0,
        odFullDay: 0,
        marked: 0,
      });
    }
    const g = map.get(key);
    g.sections += 1;
    g.studentCount += row.studentCount || 0;
    g.present += row.present || 0;
    g.absent += row.absent || 0;
    g.late += row.late || 0;
    g.halfDay += row.halfDay || 0;
    g.odHalfDay += row.odHalfDay || 0;
    g.odFullDay += row.odFullDay || 0;
    g.marked += row.marked || 0;
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      attendancePercent: attendancePercentFromCounts({
        present: g.present,
        absent: g.absent,
        late: g.late,
        halfDay: g.halfDay,
        odHalfDay: g.odHalfDay,
        odFullDay: g.odFullDay,
      }),
    }))
    .sort((a, b) => compareClassNames(a.className, b.className));
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-16 text-sm text-gray-500 shadow-sm">
      <LoaderCircle className="animate-spin text-indigo-500" size={18} />
      Loading attendance report…
    </div>
  );
}

function OverviewPage({ date, summary, standards, onNavigate, loading }) {
  if (loading) return <LoadingBlock />;

  const kpis = [
    { label: 'Total Classes', value: summary.totalClasses ?? standards.length, icon: School, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', cardBg: 'bg-indigo-50/70' },
    { label: 'Total Students', value: summary.totalStudents ?? '—', icon: Users, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', cardBg: 'bg-sky-50/80' },
    { label: 'Present Today', value: summary.present ?? 0, icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', cardBg: 'bg-emerald-50/80', hint: 'School-wide' },
    { label: 'Absent Today', value: summary.absent ?? 0, icon: XCircle, iconBg: 'bg-rose-50', iconColor: 'text-rose-500', cardBg: 'bg-rose-50/80' },
    { label: 'Late / Half Day', value: (summary.late || 0) + (summary.halfDay || 0), icon: Clock3, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', cardBg: 'bg-amber-50/80' },
    { label: 'Attendance %', value: `${summary.attendancePercent ?? 0}%`, icon: Percent, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', cardBg: 'bg-violet-50/80' },
  ];

  return (
    <div>
      <div className="hidden lg:block">
        <ReportPageHeader
          title="Attendance Reports"
          subtitle="View school-wide attendance and drill down by standard and section."
          breadcrumb={[
            { label: 'Reports', path: { view: 'hub' } },
            { label: 'Attendance' },
          ]}
          onNavigate={onNavigate}
        />
      </div>

      <div className="mb-4 flex items-center justify-between gap-2 lg:hidden">
        <h3 className="text-lg font-bold text-gray-900">Overview</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
          <CalendarDays size={13} className="text-[#1e3a8a]" />
          As of {formatShortDate(date)}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="contents">
            <div className="lg:hidden">
              <MobileKpi {...kpi} />
            </div>
            <div className="hidden lg:block">
              <KpiCard
                label={kpi.label}
                value={kpi.value}
                icon={kpi.icon}
                tone={
                  kpi.label.includes('Present')
                    ? 'green'
                    : kpi.label.includes('Absent')
                      ? 'red'
                      : kpi.label.includes('Late')
                        ? 'amber'
                        : kpi.label.includes('Attendance')
                          ? 'violet'
                          : kpi.label.includes('Students')
                            ? 'sky'
                            : 'indigo'
                }
                hint={kpi.hint}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3">
        <h3 className="text-base font-bold text-gray-900">Attendance by Standard</h3>
        <p className="text-sm text-gray-500 lg:hidden">Tap a class to view sections</p>
        <p className="hidden text-sm text-gray-500 lg:block">
          As of {formatShortDate(date)} · click a standard to open its page
        </p>
      </div>

      <div className="space-y-3 lg:hidden">
        {standards.map((std, i) => {
          const unmarked = !std.marked;
          return (
            <MobileStandardCard
              key={std.classId}
              title={formatClassLabel(std.className)}
              subtitle={`${std.studentCount} Students · ${std.sections} sections`}
              present={std.present}
              absent={std.absent}
              percent={std.attendancePercent}
              unmarked={unmarked}
              tone={pastelAt(i + 2)}
              onClick={() => onNavigate({ view: 'class', classId: std.classId })}
            />
          );
        })}
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
        {standards.map((std, i) => {
          const tone = pastelAt(i);
          const unmarked = !std.marked;
          return (
            <button
              key={std.classId}
              type="button"
              onClick={() => onNavigate({ view: 'class', classId: std.classId })}
              className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.bg} ${tone.border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-lg font-bold ${tone.accent}`}>
                    {formatClassLabel(std.className)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-600">
                    {std.studentCount} Students · {std.sections} sections
                  </p>
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
                  <p className="font-bold text-gray-900">
                    {unmarked ? 'Not marked' : `${std.attendancePercent}%`}
                  </p>
                </div>
              </div>
              <p className={`mt-4 text-sm font-semibold ${tone.accent}`}>View Sections →</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClassPage({ classId, date, sections, onNavigate, loading }) {
  const label = formatClassLabel(classId);
  const totals = useMemo(() => {
    const t = {
      sections: sections.length,
      studentCount: 0,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      odHalfDay: 0,
      odFullDay: 0,
      marked: 0,
    };
    for (const s of sections) {
      t.studentCount += s.studentCount || 0;
      t.present += s.present || 0;
      t.absent += s.absent || 0;
      t.late += s.late || 0;
      t.halfDay += s.halfDay || 0;
      t.odHalfDay += s.odHalfDay || 0;
      t.odFullDay += s.odFullDay || 0;
      t.marked += s.marked || 0;
    }
    t.attendancePercent = attendancePercentFromCounts({
      present: t.present,
      absent: t.absent,
      late: t.late,
      halfDay: t.halfDay,
      odHalfDay: t.odHalfDay,
      odFullDay: t.odFullDay,
    });
    return t;
  }, [sections]);

  if (loading) return <LoadingBlock />;

  const kpis = [
    { label: 'Total Sections', value: totals.sections, icon: ClipboardList, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', cardBg: 'bg-indigo-50/70' },
    { label: 'Total Students', value: totals.studentCount, icon: Users, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', cardBg: 'bg-sky-50/80' },
    { label: 'Present', value: totals.present, icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', cardBg: 'bg-emerald-50/80' },
    { label: 'Absent', value: totals.absent, icon: XCircle, iconBg: 'bg-rose-50', iconColor: 'text-rose-500', cardBg: 'bg-rose-50/80' },
    { label: 'Late / Half Day', value: totals.late + totals.halfDay, icon: Clock3, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', cardBg: 'bg-amber-50/80' },
    { label: 'Attendance', value: `${totals.attendancePercent}%`, icon: Percent, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', cardBg: 'bg-violet-50/80' },
  ];

  return (
    <div>
      <ReportPageHeader
        title={`${label} Attendance`}
        subtitle={`Section-wise attendance for ${formatShortDate(date)}`}
        breadcrumb={[
          { label: 'Reports', path: { view: 'hub' } },
          { label: 'Attendance', path: { view: 'overview' } },
          { label },
        ]}
        onBack={() => onNavigate({ view: 'overview' })}
        onNavigate={onNavigate}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="contents">
            <div className="lg:hidden">
              <MobileKpi {...kpi} />
            </div>
            <div className="hidden lg:block">
              <KpiCard
                label={kpi.label}
                value={kpi.value}
                icon={kpi.icon}
                tone={
                  kpi.label === 'Present'
                    ? 'green'
                    : kpi.label === 'Absent'
                      ? 'red'
                      : kpi.label.includes('Late')
                        ? 'amber'
                        : kpi.label === 'Attendance'
                          ? 'violet'
                          : kpi.label.includes('Students')
                            ? 'sky'
                            : 'indigo'
                }
              />
            </div>
          </div>
        ))}
      </div>

      <h3 className="mb-3 text-base font-bold text-gray-900">Sections</h3>
      <div className="space-y-3 lg:hidden">
        {sections.map((sec, i) => (
          <MobileStandardCard
            key={sec.sectionId || sec.sectionName}
            title={`${label} – ${sec.sectionName}`}
            subtitle={`${sec.studentCount} Students`}
            present={sec.present}
            absent={sec.absent}
            percent={sec.attendancePercent}
            unmarked={!sec.marked}
            tone={pastelAt(i + 2)}
            onClick={() =>
              onNavigate({
                view: 'section',
                classId,
                sectionId: sec.sectionName || sec.sectionId,
              })
            }
          />
        ))}
      </div>
      <div className="hidden gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
        {sections.map((sec, i) => {
          const tone = pastelAt(i + 2);
          return (
            <button
              key={sec.sectionId || sec.sectionName}
              type="button"
              onClick={() =>
                onNavigate({
                  view: 'section',
                  classId,
                  sectionId: sec.sectionName || sec.sectionId,
                })
              }
              className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.bg} ${tone.border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-lg font-bold ${tone.accent}`}>
                    {label} – {sec.sectionName}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{sec.studentCount} Students</p>
                </div>
                <CircularAttendance
                  percent={sec.attendancePercent}
                  strokeClass={tone.bar}
                  unmarked={!sec.marked}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Present</p>
                  <p className="font-bold text-emerald-700">{sec.present}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Absent</p>
                  <p className="font-bold text-rose-700">{sec.absent}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Attendance</p>
                  <p className="font-bold text-gray-900">{sec.attendancePercent}%</p>
                </div>
              </div>
              <p className={`mt-4 text-sm font-semibold ${tone.accent}`}>View Section →</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateRangeTabs({ preset, date, onPreset, onDate }) {
  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom Date' },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPreset(t.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            preset === t.id
              ? 'bg-[#f5c542] text-[#1e3a8a] lg:bg-indigo-600 lg:text-white'
              : 'border border-gray-200 bg-white text-gray-600 hover:border-indigo-200'
          }`}
        >
          {t.label}
        </button>
      ))}
      <div className="relative ml-auto">
        <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="date"
          value={date}
          onChange={(e) => {
            onPreset('custom');
            onDate(e.target.value);
          }}
          className="rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}

function SectionPage({
  classId,
  sectionId,
  date,
  preset,
  onPreset,
  onDate,
  report,
  trend,
  onNavigate,
  loading,
}) {
  const label = `${formatClassLabel(classId)} – ${sectionId}`;
  const summary = report?.summary || {};
  const students = report?.students || [];

  const distribution = [
    { name: 'Present', value: summary.present || 0 },
    { name: 'Absent', value: summary.absent || 0 },
    { name: 'Late', value: summary.late || 0 },
    { name: 'Half Day', value: summary.halfDay || 0 },
    { name: 'OD Half Day', value: summary.odHalfDay || 0 },
    { name: 'OD Full Day', value: summary.odFullDay || 0 },
  ].filter((d) => d.value > 0);

  if (loading) return <LoadingBlock />;

  if (report?.holiday) {
    return (
      <div>
        <ReportPageHeader
          title={`${label} Attendance Report`}
          subtitle={`Detailed attendance for ${formatShortDate(date)}`}
          breadcrumb={[
            { label: 'Reports', path: { view: 'hub' } },
            { label: 'Attendance', path: { view: 'overview' } },
            { label: formatClassLabel(classId), path: { view: 'class', classId } },
            { label: `Section ${sectionId}` },
          ]}
          onBack={() => onNavigate({ view: 'class', classId })}
          onNavigate={onNavigate}
        />
        <DateRangeTabs preset={preset} date={date} onPreset={onPreset} onDate={onDate} />
        <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          This date is a Sunday or calendar holiday and is excluded from attendance reports.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ReportPageHeader
        title={`${label} Attendance Report`}
        subtitle={`Detailed attendance for ${formatShortDate(date)}`}
        breadcrumb={[
          { label: 'Reports', path: { view: 'hub' } },
          { label: 'Attendance', path: { view: 'overview' } },
          { label: formatClassLabel(classId), path: { view: 'class', classId } },
          { label: `Section ${sectionId}` },
        ]}
        onBack={() => onNavigate({ view: 'class', classId })}
        onNavigate={onNavigate}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Students" value={summary.total ?? students.length} icon={Users} tone="sky" />
        <KpiCard
          label="Present Today"
          value={summary.present ?? 0}
          icon={CheckCircle2}
          tone="green"
          hint="View list →"
          onClick={() =>
            onNavigate({ view: 'status', classId, sectionId, status: 'present' })
          }
        />
        <KpiCard
          label="Absent Today"
          value={summary.absent ?? 0}
          icon={XCircle}
          tone="red"
          hint="View list →"
          onClick={() =>
            onNavigate({ view: 'status', classId, sectionId, status: 'absent' })
          }
        />
        <KpiCard
          label="Late"
          value={summary.late ?? 0}
          icon={Clock3}
          tone="amber"
          onClick={() => onNavigate({ view: 'status', classId, sectionId, status: 'late' })}
        />
        <KpiCard
          label="Half Day"
          value={summary.halfDay ?? 0}
          icon={ClipboardList}
          tone="violet"
          onClick={() =>
            onNavigate({ view: 'status', classId, sectionId, status: 'half-day' })
          }
        />
        <KpiCard
          label="Attendance %"
          value={`${summary.attendancePercent ?? 0}%`}
          icon={Percent}
          tone="indigo"
        />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <KpiCard
          label="OD Half Day"
          value={summary.odHalfDay ?? 0}
          tone="sky"
          hint="View list →"
          onClick={() =>
            onNavigate({ view: 'status', classId, sectionId, status: 'od-half-day' })
          }
        />
        <KpiCard
          label="OD Full Day"
          value={summary.odFullDay ?? 0}
          tone="slate"
          hint="View list →"
          onClick={() =>
            onNavigate({ view: 'status', classId, sectionId, status: 'od-full-day' })
          }
        />
      </div>

      <DateRangeTabs preset={preset} date={date} onPreset={onPreset} onDate={onDate} />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Attendance Trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="percent" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Attendance Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80}>
                  {distribution.map((d) => (
                    <Cell key={d.name} fill={DIST_COLORS[d.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {distribution.map((d) => (
              <span key={d.name} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">Student Attendance Summary</h3>
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
                      {String(s.rollNo).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({
                            view: 'student',
                            studentId: String(s.studentId),
                            classId,
                            sectionId,
                          })
                        }
                        className="font-semibold text-indigo-600 hover:underline"
                      >
                        {s.name}
                      </button>
                    </td>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusListPage({ classId, sectionId, status, date, students, onNavigate, loading }) {
  const title = `${STATUS_LABELS[status] || status} Students`;
  if (loading) return <LoadingBlock />;
  return (
    <div>
      <ReportPageHeader
        title={title}
        subtitle={`${students.length} student${students.length === 1 ? '' : 's'} on ${formatShortDate(date)}`}
        breadcrumb={[
          { label: 'Reports', path: { view: 'hub' } },
          { label: formatClassLabel(classId), path: { view: 'class', classId } },
          { label: `Section ${sectionId}`, path: { view: 'section', classId, sectionId } },
          { label: STATUS_LABELS[status] || status },
        ]}
        onBack={() => onNavigate({ view: 'section', classId, sectionId })}
        onNavigate={onNavigate}
      />

      <div className="space-y-3">
        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            No students with this status on {formatShortDate(date)}.
          </div>
        ) : (
          students.map((s, i) => {
            const tone = pastelAt(i);
            return (
              <button
                key={s.studentId || s.rollNo}
                type="button"
                onClick={() =>
                  onNavigate({
                    view: 'student',
                    studentId: String(s.studentId),
                    classId,
                    sectionId,
                  })
                }
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${tone.bg} ${tone.border}`}
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {String(s.rollNo).padStart(2, '0')} – {s.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {STATUS_LABELS[s.status || STATUS_ROUTE_MAP[status]] || status}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Parent contact · Alert status:{' '}
                    <span className="font-semibold text-emerald-700">
                      {String(s.status || '').toUpperCase() === 'A' || status === 'absent'
                        ? 'WhatsApp Alert · Sent to Both Parents'
                        : 'No alert required'}
                    </span>
                  </p>
                </div>
                <UserRound className={tone.accent} size={20} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function StudentPage({ studentId, classId, sectionId, monthly, history, onNavigate, loading }) {
  const student = monthly?.students?.find((s) => String(s.studentId) === String(studentId)) ||
    history?.find((h) => String(h.studentId) === String(studentId)) ||
    null;

  const name = student?.name || 'Student';
  const roll = student?.rollNo ?? '—';
  const present = student?.present ?? 0;
  const absent = student?.absent ?? 0;
  const late = student?.late ?? 0;
  const halfDay = student?.halfDay ?? 0;
  const odHalfDay = student?.odHalfDay ?? 0;
  const odFullDay = student?.odFullDay ?? 0;
  const workingDays =
    present + absent + late + halfDay + odHalfDay + odFullDay || monthly?.totals?.workingDays || 0;
  const pct =
    student?.attendancePercent ??
    attendancePercentFromCounts({ present, absent, late, halfDay, odHalfDay, odFullDay });

  const calendarDays = useMemo(() => {
    const days = [];
    const base = getTodayAttendanceDate();
    const y = Number(base.slice(0, 4));
    const m = Number(base.slice(5, 7));
    const last = new Date(y, m, 0).getDate();
    for (let d = 1; d <= last; d += 1) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hit = (history || []).find((h) => h.date === iso);
      const dow = new Date(`${iso}T12:00:00`).getDay();
      let status = hit?.status || null;
      if (!status && dow === 0) status = 'HOLIDAY';
      days.push({ day: d, iso, status });
    }
    return days;
  }, [history]);

  const statusColor = (status) => {
    if (status === 'P') return 'bg-emerald-500';
    if (status === 'A') return 'bg-rose-500';
    if (status === 'L') return 'bg-amber-500';
    if (status === 'H') return 'bg-violet-500';
    if (status === 'HOLIDAY') return 'bg-gray-300';
    return 'bg-gray-100';
  };

  if (loading) return <LoadingBlock />;

  return (
    <div>
      <ReportPageHeader
        title="Student Attendance Report"
        subtitle={`${name} · ${formatClassLabel(classId || '—')} – ${sectionId || '—'} · Roll ${String(roll).padStart?.(2, '0') || roll}`}
        breadcrumb={[
          { label: 'Reports', path: { view: 'hub' } },
          { label: 'Attendance', path: { view: 'overview' } },
          classId
            ? { label: formatClassLabel(classId), path: { view: 'class', classId } }
            : { label: 'Class' },
          sectionId
            ? { label: `Section ${sectionId}`, path: { view: 'section', classId, sectionId } }
            : null,
          { label: name },
        ].filter(Boolean)}
        onBack={() =>
          classId && sectionId
            ? onNavigate({ view: 'section', classId, sectionId })
            : onNavigate({ view: 'overview' })
        }
        onNavigate={onNavigate}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Working Days" value={workingDays} tone="slate" icon={Calendar} />
        <KpiCard label="Present" value={present} tone="green" icon={CheckCircle2} />
        <KpiCard label="Absent" value={absent} tone="red" icon={XCircle} />
        <KpiCard label="Late" value={late} tone="amber" icon={Clock3} />
        <KpiCard label="Half Day" value={halfDay} tone="violet" icon={ClipboardList} />
        <KpiCard label="Attendance %" value={`${pct}%`} tone="indigo" icon={Percent} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Monthly Attendance Calendar</h3>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-gray-400">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({
              length: new Date(
                Number(getTodayAttendanceDate().slice(0, 4)),
                Number(getTodayAttendanceDate().slice(5, 7)) - 1,
                1
              ).getDay(),
            }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {calendarDays.map((d) => (
              <span
                key={d.iso}
                title={`${d.iso} · ${STATUS_LABELS[d.status] || d.status || '—'}`}
                className={`flex h-8 items-center justify-center rounded-lg text-xs font-semibold text-white ${statusColor(d.status)}`}
              >
                {d.day}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Present</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-rose-500" /> Absent</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-500" /> Late</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-violet-500" /> Half Day</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-gray-300" /> Holiday</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Attendance History</h3>
          <div className="max-h-72 overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Day</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2">Alert</th>
                </tr>
              </thead>
              <tbody>
                {(history || []).slice(-14).reverse().map((h) => (
                  <tr key={h.date} className="border-t border-gray-100">
                    <td className="py-2 pr-2">{formatShortDate(h.date)}</td>
                    <td className="py-2 pr-2 text-gray-500">
                      {new Date(`${h.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                    </td>
                    <td className="py-2 pr-2 font-medium">{STATUS_LABELS[h.status] || h.status}</td>
                    <td className="py-2 text-xs text-gray-500">
                      {h.status === 'A' ? 'Sent' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-page Attendance Reports shell.
 * Uses hash routes: #/reports/attendance/...
 */
export default function AttendanceReportsApp({ onExit }) {
  const today = getTodayAttendanceDate();
  const [route, setRoute] = useState(() => readHashPath());
  const [date, setDate] = useState(today);
  const [preset, setPreset] = useState('today');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [comparison, setComparison] = useState([]);
  const [sectionReport, setSectionReport] = useState(null);
  const [trend, setTrend] = useState([]);
  const [monthly, setMonthly] = useState(null);
  const [history, setHistory] = useState([]);

  const navigate = useCallback(
    (parts) => {
      if (parts?.view === 'hub') {
        onExit?.();
        window.history.pushState(null, '', window.location.pathname + window.location.search);
        return;
      }
      const next = { ...parts };
      setRoute(next);
      writeHashPath(next);
    },
    [onExit]
  );

  useEffect(() => {
    const onHash = () => setRoute(readHashPath());
    window.addEventListener('hashchange', onHash);
    writeHashPath(route);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed hash once
  }, []);

  const applyPreset = (id) => {
    setPreset(id);
    if (id === 'today') setDate(today);
    if (id === 'yesterday') setDate(addDaysIso(today, -1));
    if (id === 'week') setDate(today);
    if (id === 'month') setDate(today);
  };

  // School + class comparison
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sum, cmp] = await Promise.all([
          getAttendanceSummary({ date }),
          getClassComparison({ date }),
        ]);
        if (cancelled) return;
        setSummary(sum || {});
        setComparison(cmp?.classes || []);
      } catch {
        if (!cancelled) {
          setSummary({});
          setComparison([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const standards = useMemo(() => aggregateStandards(comparison), [comparison]);

  const classSections = useMemo(() => {
    if (route.view !== 'class' && route.view !== 'section' && route.view !== 'status') return [];
    return comparison
      .filter((c) => String(c.className) === String(route.classId))
      .sort((a, b) => String(a.sectionName).localeCompare(String(b.sectionName)));
  }, [comparison, route]);

  // Resolve section DB id + daily report
  useEffect(() => {
    if (!['section', 'status', 'student'].includes(route.view)) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const classes = await getClasses();
        const list = classes?.classes || [];
        const klass = list.find((c) => String(c.name) === String(route.classId));
        const sec = (klass?.sections || []).find(
          (s) => String(s.name) === String(route.sectionId)
        );
        const sid =
          sec?.id ||
          (await resolveSectionId(route.classId, route.sectionId).catch(() => null));
        if (cancelled) return;

        if (route.view === 'section' || route.view === 'status') {
          const report = await getDailyReport({
            date,
            sectionId: sid || undefined,
            className: route.classId,
            section: route.sectionId,
          });
          if (cancelled) return;
          setSectionReport(report);

          const points = [];
          for (let i = 6; i >= 0; i -= 1) {
            const d = addDaysIso(date, -i);
            try {
              const r = await getDailyReport({
                date: d,
                sectionId: sid || undefined,
                className: route.classId,
                section: route.sectionId,
              });
              if (r?.holiday) continue;
              points.push({
                label: d.slice(8),
                percent: r?.summary?.attendancePercent ?? 0,
              });
            } catch {
              points.push({ label: d.slice(8), percent: 0 });
            }
          }
          if (!cancelled) setTrend(points);
        }

        if (route.view === 'student' && sid) {
          const now = new Date(`${date}T12:00:00`);
          const monthRep = await getMonthlyReport({
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            sectionId: sid,
          });
          if (cancelled) return;
          setMonthly(monthRep);

          const from = monthStart(date);
          const hist = [];
          const roster = await getStudents({ sectionId: sid });
          const target = (roster.students || []).find(
            (s) => String(s.id) === String(route.studentId)
          );
          for (let i = 0; i < 31; i += 1) {
            const d = addDaysIso(from, i);
            if (d.slice(0, 7) !== date.slice(0, 7)) break;
            if (new Date(`${d}T12:00:00`) > new Date(`${date}T12:00:00`)) break;
            try {
              const day = await getDailyReport({
                date: d,
                sectionId: sid,
                className: route.classId,
                section: route.sectionId,
              });
              if (day?.holiday) continue;
              const row = (day.students || []).find(
                (s) => String(s.studentId) === String(route.studentId)
              );
              hist.push({
                date: d,
                status: row?.status || 'P',
                studentId: route.studentId,
                name: row?.name || target?.name,
                rollNo: row?.rollNo || target?.roll || target?.rollNo,
              });
            } catch {
              // skip
            }
          }
          if (!cancelled) setHistory(hist);
        }
      } catch {
        if (!cancelled) {
          setSectionReport(null);
          setTrend([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route, date]);

  const statusStudents = useMemo(() => {
    if (route.view !== 'status') return [];
    const code = STATUS_ROUTE_MAP[route.status] || 'A';
    return (sectionReport?.students || []).filter((s) => {
      const st = s.status && s.status !== '' ? s.status : 'P';
      return st === code;
    });
  }, [route, sectionReport]);

  if (route.view === 'overview') {
    return (
      <OverviewPage
        date={date}
        summary={summary}
        standards={standards}
        onNavigate={navigate}
        loading={loading}
      />
    );
  }
  if (route.view === 'class') {
    return (
      <ClassPage
        classId={route.classId}
        date={date}
        sections={classSections}
        onNavigate={navigate}
        loading={loading}
      />
    );
  }
  if (route.view === 'section') {
    return (
      <SectionPage
        classId={route.classId}
        sectionId={route.sectionId}
        date={date}
        preset={preset}
        onPreset={applyPreset}
        onDate={setDate}
        report={sectionReport}
        trend={trend}
        onNavigate={navigate}
        loading={loading}
      />
    );
  }
  if (route.view === 'status') {
    return (
      <StatusListPage
        classId={route.classId}
        sectionId={route.sectionId}
        status={route.status}
        date={date}
        students={statusStudents}
        onNavigate={navigate}
        loading={loading}
      />
    );
  }
  if (route.view === 'student') {
    return (
      <StudentPage
        studentId={route.studentId}
        classId={route.classId}
        sectionId={route.sectionId}
        monthly={monthly}
        history={history}
        onNavigate={navigate}
        loading={loading}
      />
    );
  }

  return (
    <OverviewPage
      date={date}
      summary={summary}
      standards={standards}
      onNavigate={navigate}
      loading={loading}
    />
  );
}
