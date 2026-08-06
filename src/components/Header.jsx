import { Users, UserCheck, UserX, BarChart2, Menu, Calendar, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useMock } from '../services/api.js';

const PAGE_TITLES = {
  dashboard: { title: 'Dashboard', subtitle: 'School overview and quick stats.' },
  attendance: { title: 'Attendance', subtitle: 'Mark and manage daily attendance.' },
  'edit-approvals': {
    title: 'Edit Approvals',
    subtitle: 'View pending requests — approve or deny only via WhatsApp.',
  },
  students: { title: 'Students', subtitle: 'Manage student records.' },
  'leave-letters': { title: 'Leave Letters', subtitle: 'Upload and track student leave letters.' },
  classes: { title: 'Classes', subtitle: 'Class and section management.' },
  teachers: { title: 'Teachers', subtitle: 'Staff directory and management.' },
  calendar: { title: 'Academic Calendar', subtitle: 'Plan, manage and view academic events.' },
  timetable: { title: 'Timetable', subtitle: 'Weekly periods and class schedule.' },
  daywise: { title: 'Day-wise Attendance', subtitle: 'Mark period-wise attendance for the selected day.' },
  reports: { title: 'Reports', subtitle: 'Analytics and exports.' },
  notifications: { title: 'Notifications', subtitle: 'Alerts and school announcements.' },
  settings: { title: 'Settings', subtitle: 'System configuration.' },
  support: { title: 'Support Center', subtitle: 'Get help from Rio Biz Solutions.' },
};

const ROLE_LABELS = {
  INCHARGE: 'Attendance In-charge',
  TEACHER: 'Teacher',
  ADMIN: 'Administrator',
  HOD: 'HOD',
  VICE_PRINCIPAL: 'Vice Principal',
  PRINCIPAL: 'Principal',
};

function ConnectionBadge({ status }) {
  if (status == null) return null;
  if (status === 'offline') {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-500 sm:inline-flex"
        title="Realtime disconnected"
      >
        <WifiOff size={13} />
        Offline
      </span>
    );
  }
  if (status === 'live') {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 sm:inline-flex"
        title="Realtime connected"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <Wifi size={13} />
        Live
      </span>
    );
  }
  return (
    <span
      className="hidden items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 sm:inline-flex"
      title="Reconnecting to realtime"
    >
      <Wifi size={13} className="animate-pulse" />
      Reconnecting
    </span>
  );
}

export default function Header({
  activePage = 'attendance',
  onMenuClick,
  onMenuHoverEnter,
  onMenuHoverLeave,
  user,
  onLogout,
  dateLabel,
  connectionStatus,
}) {
  const page = PAGE_TITLES[activePage] || PAGE_TITLES.attendance;
  const initials = (user?.name || 'AP')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          onMouseEnter={onMenuHoverEnter}
          onMouseLeave={onMenuHoverLeave}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
          title="Open menu"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">{page.title}</h1>
          <p className="hidden truncate text-sm text-gray-500 sm:block">{page.subtitle}</p>
          <p className="truncate text-[11px] text-gray-500 sm:hidden">{page.subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {useMock() && (
          <span className="hidden rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 sm:inline-flex">
            Demo mode
          </span>
        )}
        <ConnectionBadge status={connectionStatus} />

        {dateLabel && (
          <div className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 sm:flex">
            <Calendar size={15} className="text-indigo-600" />
            {dateLabel}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white p-0.5 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500">
              {ROLE_LABELS[user?.role] || user?.role || 'Signed in'}
            </p>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Log out"
              className="mr-1 hidden rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 sm:inline-flex"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function DashboardStats({ stats }) {
  const cards = [
    {
      label: 'Total Classes',
      value: stats.totalClasses,
      icon: Users,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Present Today',
      value: stats.presentToday,
      sub: `${stats.attendancePercent}% of marked`,
      icon: UserCheck,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: 'Absent Today',
      value: stats.absentToday,
      sub: stats.markedToday != null ? `${stats.markedToday} marked` : undefined,
      icon: UserX,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-500',
    },
    {
      label: 'Attendance %',
      value: `${stats.attendancePercent}%`,
      sub: 'Of marked today',
      icon: BarChart2,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}>
            <card.icon size={22} className={card.iconColor} />
          </div>
          <div>
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            {card.sub && <p className="text-xs text-gray-400">{card.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
