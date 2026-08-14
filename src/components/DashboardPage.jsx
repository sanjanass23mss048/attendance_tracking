import { useEffect, useMemo, useState } from 'react';
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
  Megaphone,
  Bell,
} from 'lucide-react';
import { DashboardStats } from './Header.jsx';
import { formatClassRoman } from '../utils/classFormat.js';
import { canApproveEditRequests, canViewAuditLogs } from '../data/navItems.js';
import { listAuditLogs } from '../services/auditLogService.js';
import { getScheduledEvents } from '../services/calendarService.js';

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

const ROLE_LABELS = {
  INCHARGE: 'Attendance In-charge',
  TEACHER: 'Teacher',
  ADMIN: 'Administrator',
  HOD: 'HOD',
  VICE_PRINCIPAL: 'Vice Principal',
  PRINCIPAL: 'Principal',
};

const QUICK_LINKS = [
  { id: 'attendance', label: 'Mark Attendance', icon: ClipboardCheck, color: 'bg-indigo-50 text-indigo-600' },
  { id: 'edit-approvals', label: 'Edit Approvals', icon: Shield, color: 'bg-amber-50 text-amber-700' },
  { id: 'leave-letters', label: 'Leave Letters', icon: FileText, color: 'bg-sky-50 text-sky-600' },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: 'bg-violet-50 text-violet-600' },
  { id: 'students', label: 'Students', icon: Users, color: 'bg-emerald-50 text-emerald-600' },
  { id: 'classes', label: 'Classes', icon: BookOpen, color: 'bg-rose-50 text-rose-600' },
];

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function activityTone(category) {
  switch (String(category || '').toUpperCase()) {
    case 'AUTH':
      return 'bg-slate-500';
    case 'ATTENDANCE':
      return 'bg-green-500';
    case 'APPROVAL':
      return 'bg-amber-500';
    case 'STUDENT':
      return 'bg-indigo-500';
    case 'NOTICE':
      return 'bg-violet-500';
    default:
      return 'bg-gray-400';
  }
}

function formatEventChip(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { day: '—', month: '—' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
  };
}

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
  const [activities, setActivities] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canViewAuditLogs(user)) {
        if (!cancelled) setActivities([]);
        return;
      }
      try {
        const data = await listAuditLogs({ limit: 7 });
        if (cancelled) return;
        setActivities(
          (data.logs || []).map((log) => ({
            text: log.summary || log.action || 'Activity',
            time: relativeTime(log.createdAt),
            tone: activityTone(log.category),
          }))
        );
      } catch {
        if (!cancelled) setActivities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const events = await getScheduledEvents(new Date().getFullYear(), 3);
        if (cancelled) return;
        setUpcomingEvents(
          (events || []).map((event) => {
            const chip = formatEventChip(event.date);
            return {
              day: chip.day,
              month: chip.month,
              title: event.title || 'Event',
              sub: event.source ? String(event.source).replace(/_/g, ' ') : 'School calendar',
            };
          })
        );
      } catch {
        if (!cancelled) setUpcomingEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const classRows = useMemo(() => {
    const rows = (classesData || []).flatMap((klass) =>
      (klass.sections || []).map((sec) => ({
        name: displaySectionLabel(klass.name, sec.name),
        className: klass.name,
        sectionName: sec.name,
        percent: 0,
        present: 0,
        absent: 0,
      }))
    );

    if (!allowed) return rows;
    return rows.filter((row) => allowed.has(sectionKey(row.className, row.sectionName)));
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
  const roleLabel = (ROLE_LABELS[user?.role] || user?.role || 'Teacher').toUpperCase();
  const initials = firstName.slice(0, 1).toUpperCase();
  const quickLinks = QUICK_LINKS.filter(
    (link) => link.id !== 'edit-approvals' || canApproveEditRequests(user)
  );

  const openAttendance = (view) => onNavigate?.('attendance', view);
  const openPage = (id) => onNavigate?.(id);

  const todayChip =
    dateLabel ||
    new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const mobileStatCards = [
    {
      label: 'Marked',
      value: marked,
      icon: ClipboardCheck,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      cardBg: 'bg-amber-50/80',
    },
    {
      label: 'Present',
      value: stats.presentToday ?? 0,
      icon: UserCheck,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      cardBg: 'bg-sky-50/80',
    },
    {
      label: 'Absent',
      value: stats.absentToday ?? 0,
      icon: UserX,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-500',
      cardBg: 'bg-rose-50/80',
    },
    {
      label: 'Classes',
      value: stats.totalClasses ?? classRows.length ?? 0,
      icon: BookOpen,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      cardBg: 'bg-indigo-50/70',
    },
  ];

  const mobileQuickActions = [
    { page: 'calendar', label: 'Calendar', icon: CalendarDays, color: 'bg-amber-50 text-amber-600' },
    { page: 'notifications', label: 'Notice', icon: Megaphone, color: 'bg-violet-50 text-violet-600' },
    { page: 'notifications', label: 'Notifications', icon: Bell, color: 'bg-sky-50 text-sky-600' },
    { page: 'reports', label: 'Reports', icon: BarChart3, color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="space-y-5">
      {/* —— Mobile home (mockup) —— */}
      <div className="space-y-4 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Hello, {firstName}{' '}
              <span aria-hidden="true">👋</span>
            </h2>
            <p className="mt-0.5 text-xs font-semibold tracking-wider text-gray-500">
              {roleLabel}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1e3a8a] text-lg font-bold text-white shadow-sm">
            {initials}
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
          <CalendarDays size={14} className="text-[#1e3a8a]" />
          Today · {todayChip.replace(/^Today\s*[•·]\s*/i, '')}
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
              className={`rounded-2xl border border-white/80 ${card.cardBg} p-3.5 shadow-sm`}
            >
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                <card.icon size={18} className={card.iconColor} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => openAttendance('grid')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1e3a8a] px-4 py-3.5 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
          >
            <ClipboardCheck size={18} />
            Mark Attendance
          </button>
          <button
            type="button"
            onClick={() => openPage('reports')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#1e3a8a] bg-white px-4 py-3.5 text-sm font-bold text-[#1e3a8a] active:scale-[0.99]"
          >
            <BarChart3 size={18} />
            View Reports
          </button>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-900">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-2">
            {mobileQuickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => openPage(action.page)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white px-1.5 py-3 text-center shadow-sm active:scale-[0.98]"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.color}`}
                >
                  <action.icon size={20} />
                </span>
                <span className="text-[10px] font-semibold leading-tight text-gray-800">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openPage('notifications')}
          className="flex w-full items-center gap-3 rounded-2xl bg-[#f5c542] px-4 py-3.5 text-left shadow-sm active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e3a8a] text-white">
            <Megaphone size={18} />
          </span>
          <span className="text-sm font-semibold leading-snug text-gray-900">
            Stay Updated: Check notices and upcoming events regularly.
          </span>
        </button>
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
                {upcomingEvents.length ? (
                  upcomingEvents.map((e) => (
                    <li key={`${e.title}-${e.day}`} className="flex gap-3">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                        <span className="text-[10px] font-semibold uppercase leading-none">{e.month}</span>
                        <span className="text-sm font-bold leading-tight">{e.day}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{e.title}</p>
                        <p className="text-xs text-gray-500">{e.sub}</p>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500">No upcoming events scheduled.</li>
                )}
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
