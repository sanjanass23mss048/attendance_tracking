import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  UserCheck,
  UserX,
  BarChart2,
  ClipboardCheck,
  Shield,
  FileText,
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutGrid,
  Hash,
  List,
  PieChart as PieIcon,
  ChevronRight,
} from 'lucide-react';
import { DashboardStats } from './Header.jsx';
import { formatClassRoman } from '../utils/classFormat.js';
import { canApproveEditRequests } from '../data/navItems.js';

const STATUS_COLORS = {
  present: '#22c55e',
  absent: '#ef4444',
  late: '#f59e0b',
  halfDay: '#8b5cf6',
  odHalf: '#06b6d4',
  odFull: '#0f766e',
};

const FULL_ACCESS_ROLES = new Set([
  'INCHARGE',
  'ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'HEADMASTER',
  'HOD',
]);

const QUICK_LINKS = [
  { id: 'attendance', label: 'Mark Attendance', icon: ClipboardCheck, color: 'bg-indigo-50 text-indigo-600' },
  { id: 'edit-approvals', label: 'Edit Approvals', icon: Shield, color: 'bg-amber-50 text-amber-700' },
  { id: 'leave-letters', label: 'Leave Letters', icon: FileText, color: 'bg-sky-50 text-sky-600' },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: 'bg-violet-50 text-violet-600' },
  { id: 'students', label: 'Students', icon: Users, color: 'bg-emerald-50 text-emerald-600' },
  { id: 'classes', label: 'Classes', icon: BookOpen, color: 'bg-rose-50 text-rose-600' },
];

const MOBILE_QUICK_ACTIONS = [
  { view: 'grid', label: 'Grid View', icon: LayoutGrid, color: 'bg-indigo-50 text-indigo-600' },
  { view: 'roll', label: 'Roll Quick Entry', icon: Hash, color: 'bg-violet-50 text-violet-600' },
  { view: 'list', label: 'List View', icon: List, color: 'bg-sky-50 text-sky-600' },
  { view: 'summary', label: 'Summary', icon: PieIcon, color: 'bg-amber-50 text-amber-600' },
  { page: 'reports', label: 'Reports', icon: BarChart3, color: 'bg-emerald-50 text-emerald-600' },
];

/** Sample rows — className/sectionName are canonical (e.g. 1 / A). */
const SAMPLE_CLASS_ROWS = [
  { className: 'LKG', sectionName: 'A', percent: 92, present: 37, absent: 3 },
  { className: 'LKG', sectionName: 'B', percent: 88, present: 35, absent: 5 },
  { className: 'UKG', sectionName: 'A', percent: 95, present: 38, absent: 2 },
  { className: '1', sectionName: 'A', percent: 90, present: 36, absent: 4 },
  { className: '2', sectionName: 'A', percent: 86, present: 34, absent: 6 },
  { className: '3', sectionName: 'A', percent: 93, present: 37, absent: 3 },
];

/** Sample feed — scoped by className + sectionName. */
const SAMPLE_ACTIVITIES = [
  {
    text: 'Attendance marked for LKG-A',
    time: '10 min ago',
    tone: 'bg-green-500',
    className: 'LKG',
    sectionName: 'A',
  },
  {
    text: 'Leave letter approved — Roll 12 · I-A',
    time: '32 min ago',
    tone: 'bg-sky-500',
    className: '1',
    sectionName: 'A',
  },
  {
    text: 'New student added to UKG-B',
    time: '1 hr ago',
    tone: 'bg-indigo-500',
    className: 'UKG',
    sectionName: 'B',
  },
  {
    text: 'Edit request pending for I-A',
    time: '2 hr ago',
    tone: 'bg-amber-500',
    className: '1',
    sectionName: 'A',
  },
  {
    text: 'Attendance marked for I-A',
    time: '3 hr ago',
    tone: 'bg-green-500',
    className: '1',
    sectionName: 'A',
  },
  {
    text: 'Attendance marked for II-A',
    time: '4 hr ago',
    tone: 'bg-green-500',
    className: '2',
    sectionName: 'A',
  },
  {
    text: 'Edit request pending for III-A',
    time: '5 hr ago',
    tone: 'bg-amber-500',
    className: '3',
    sectionName: 'A',
  },
];

const SAMPLE_EVENTS = [
  { day: '12', month: 'AUG', title: 'Football Match', sub: 'Sports Ground · 3:00 PM' },
  { day: '15', month: 'AUG', title: 'Independence Day Celebration', sub: 'School Assembly · 8:30 AM' },
  { day: '20', month: 'AUG', title: 'Science Exhibition', sub: 'Lab Block · All Day' },
];

function sectionKey(className, sectionName) {
  return `${String(className ?? '')
    .trim()
    .toUpperCase()}-${String(sectionName ?? '')
    .trim()
    .toUpperCase()}`;
}

function displaySectionLabel(className, sectionName) {
  const grade = formatClassRoman(className);
  return `${grade}-${String(sectionName ?? '').trim().toUpperCase()}`;
}

/** Allowed section keys for a teacher from classes API tree; null = full school access. */
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

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Dashboard overview — class teachers only see their assigned sections.
 */
export default function DashboardPage({
  stats,
  error,
  dateLabel,
  onNavigate,
  user = null,
  classesData = [],
}) {
  const allowed = useMemo(() => allowedSectionKeys(user, classesData), [user, classesData]);

  const classRows = useMemo(() => {
    const rows = SAMPLE_CLASS_ROWS.filter((row) => {
      if (!allowed) return true;
      return allowed.has(sectionKey(row.className, row.sectionName));
    }).map((row) => ({
      ...row,
      name: displaySectionLabel(row.className, row.sectionName),
      className: row.className,
      sectionName: row.sectionName,
    }));

    if (allowed && !rows.length && classesData?.length) {
      return classesData.flatMap((klass) =>
        (klass.sections || []).map((sec) => ({
          name: displaySectionLabel(klass.name, sec.name),
          className: klass.name,
          sectionName: sec.name,
          percent: 0,
          present: 0,
          absent: 0,
        }))
      );
    }
    return rows;
  }, [allowed, classesData]);

  const activities = useMemo(() => {
    const list = SAMPLE_ACTIVITIES.filter((a) => {
      if (!allowed) return true;
      if (!a.className || !a.sectionName) return false;
      return allowed.has(sectionKey(a.className, a.sectionName));
    });

    if (allowed && !list.length && classesData?.length) {
      return classesData.flatMap((klass) =>
        (klass.sections || []).map((sec) => {
          const label = displaySectionLabel(klass.name, sec.name);
          return {
            text: `No recent activity for ${label} yet`,
            time: 'Just now',
            tone: 'bg-gray-400',
          };
        })
      );
    }
    return list;
  }, [allowed, classesData]);

  const marked = stats.markedToday ?? 0;
  const pieData = useMemo(
    () =>
      [
        { key: 'present', name: 'Present', value: stats.presentToday || 0, color: STATUS_COLORS.present },
        { key: 'absent', name: 'Absent', value: stats.absentToday || 0, color: STATUS_COLORS.absent },
        { key: 'late', name: 'Late', value: stats.lateToday || 0, color: STATUS_COLORS.late },
        { key: 'halfDay', name: 'Half Day', value: stats.halfDayToday || 0, color: STATUS_COLORS.halfDay },
        { key: 'odHalf', name: 'OD - Half Day', value: stats.odHalfDayToday || 0, color: STATUS_COLORS.odHalf },
        { key: 'odFull', name: 'OD - Full Day', value: stats.odFullDayToday || 0, color: STATUS_COLORS.odFull },
      ].filter((d) => d.value > 0),
    [stats]
  );

  const pieFallback = [{ name: 'No data', value: 1, color: '#e5e7eb' }];
  const chartData = pieData.length ? pieData : pieFallback;

  const firstName = (user?.name || 'Admin').split(/\s+/)[0];
  const absentPct =
    marked > 0 ? Math.round(((stats.absentToday || 0) / marked) * 1000) / 10 : 0;
  const quickLinks = QUICK_LINKS.filter(
    (link) => link.id !== 'edit-approvals' || canApproveEditRequests(user)
  );

  const mobileStatCards = [
    {
      label: 'Total Classes',
      value: stats.totalClasses ?? 0,
      icon: Users,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Present Today',
      value: stats.presentToday ?? 0,
      sub: `${stats.attendancePercent ?? 0}%`,
      icon: UserCheck,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: 'Absent Today',
      value: stats.absentToday ?? 0,
      sub: marked ? `${absentPct}%` : undefined,
      icon: UserX,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-500',
    },
    {
      label: 'Attendance %',
      value: `${stats.attendancePercent ?? 0}%`,
      sub: 'Today',
      icon: BarChart2,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-500',
    },
  ];

  const openAttendance = (view) => onNavigate?.('attendance', view);
  const openPage = (id) => onNavigate?.(id);

  return (
    <div className="space-y-5">
      {/* —— Mobile home (mockup) —— */}
      <div className="space-y-5 lg:hidden">
        <div>
          <p className="text-sm text-gray-500">
            {greetingForNow()}, {firstName}
          </p>
          <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-gray-900">Attendance</h2>
          <p className="mt-1 text-sm text-gray-500">Mark and manage daily attendance.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load live stats: {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {mobileStatCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm"
            >
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                <card.icon size={18} className={card.iconColor} />
              </div>
              <p className="text-[11px] font-medium text-gray-500">{card.label}</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900">{card.value}</p>
              {card.sub && <p className="text-[11px] text-gray-400">{card.sub}</p>}
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-900">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {MOBILE_QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() =>
                  action.view ? openAttendance(action.view) : openPage(action.page)
                }
                className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-3.5 text-center shadow-sm active:scale-[0.98]"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.color}`}
                >
                  <action.icon size={20} />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-gray-800">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Today&apos;s Classes</h3>
            <button
              type="button"
              onClick={() => openPage('classes')}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-600"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {(classRows.length ? classRows : []).slice(0, 6).map((row) => (
              <button
                key={row.name}
                type="button"
                onClick={() => openAttendance('grid')}
                className="w-56 shrink-0 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">{row.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">Attendance class</p>
                  </div>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    {row.percent}%
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {row.present}P · {row.absent}A
                </p>
              </button>
            ))}
            {!classRows.length && (
              <p className="px-1 text-sm text-gray-500">No classes assigned.</p>
            )}
          </div>
        </div>
      </div>

      {/* —— Desktop / tablet dashboard —— */}
      <div className="hidden space-y-5 lg:block">
        <DashboardStats stats={stats} />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load live stats: {error}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-gray-900">Live Attendance</h2>
              {dateLabel && (
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {dateLabel}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={pieData.length ? 2 : 0}
                      stroke="none"
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{marked}</span>
                  <span className="text-[11px] text-gray-500">Marked today</span>
                </div>
              </div>
              <ul className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  { label: 'Present', value: stats.presentToday, color: STATUS_COLORS.present },
                  { label: 'Absent', value: stats.absentToday, color: STATUS_COLORS.absent },
                  { label: 'Late', value: stats.lateToday, color: STATUS_COLORS.late },
                  { label: 'Half Day', value: stats.halfDayToday, color: STATUS_COLORS.halfDay },
                  { label: 'OD - Half Day', value: stats.odHalfDayToday, color: STATUS_COLORS.odHalf },
                  { label: 'OD - Full Day', value: stats.odFullDayToday, color: STATUS_COLORS.odFull },
                ].map((row) => (
                  <li key={row.label} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="text-gray-600">{row.label}</span>
                    <span className="ml-auto font-semibold text-gray-900">{row.value ?? 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_0.9fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-gray-900">Today at a Glance</h2>
            <div className="space-y-3">
              {[
                { label: 'Total students', value: stats.totalStudents, icon: Users },
                { label: 'Classes / sections', value: stats.totalClasses, icon: BookOpen },
                { label: 'Marked today', value: stats.markedToday, icon: ClipboardCheck },
                { label: 'Attendance %', value: `${stats.attendancePercent}%`, icon: BarChart2 },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <row.icon size={15} className="text-indigo-500" />
                    {row.label}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{row.value ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-gray-900">Class Wise Attendance</h2>
            <div className="space-y-3">
              {classRows.length ? (
                classRows.map((row) => (
                  <div key={row.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800">{row.name}</span>
                      <span className="text-gray-500">
                        {row.present}P / {row.absent}A · {row.percent}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No classes assigned to your account.</p>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-gray-900">Recent Activities</h2>
              <ul className="space-y-3">
                {activities.length ? (
                  activities.map((a) => (
                    <li key={a.text} className="flex gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tone}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{a.text}</p>
                        <p className="text-[11px] text-gray-400">{a.time}</p>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500">No recent activity for your classes.</li>
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                <CalendarDays size={16} className="text-indigo-500" />
                Upcoming Events
              </h2>
              <ul className="space-y-3">
                {SAMPLE_EVENTS.map((e) => (
                  <li key={e.title} className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                      <span className="text-[10px] font-semibold uppercase leading-none">{e.month}</span>
                      <span className="text-sm font-bold leading-tight">{e.day}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{e.title}</p>
                      <p className="text-xs text-gray-500">{e.sub}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-base font-bold text-gray-900">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {quickLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => onNavigate?.(link.id)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-4 text-center shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${link.color}`}>
                  <link.icon size={20} />
                </span>
                <span className="text-xs font-semibold text-gray-800">{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
