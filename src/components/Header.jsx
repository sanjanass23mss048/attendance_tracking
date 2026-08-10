import { useEffect, useRef, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  BarChart2,
  Menu,
  Calendar,
  LogOut,
  Bell,
  ChevronRight,
} from 'lucide-react';
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

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'Mark today’s attendance',
    body: 'Remember to submit attendance for your assigned classes.',
    time: 'Today',
  },
  {
    id: 'n2',
    title: 'Academic calendar updated',
    body: 'New holidays and events were added for this month.',
    time: 'Yesterday',
  },
  {
    id: 'n3',
    title: 'Parent SMS',
    body: 'Absent-parent messages are ready after you confirm attendance.',
    time: 'This week',
  },
];

export default function Header({
  activePage = 'attendance',
  onMenuClick,
  onMenuHoverEnter,
  onMenuHoverLeave,
  onNotificationsClick,
  onNotificationItemClick,
  onNotificationsOpened,
  user,
  onLogout,
  dateLabel,
  notificationCount = 0,
  notifications = DEFAULT_NOTIFICATIONS,
}) {
  const page = PAGE_TITLES[activePage] || PAGE_TITLES.attendance;
  const hideTitleOnMobile = activePage === 'dashboard';
  const initials = (user?.name || 'AP')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [openMenu, setOpenMenu] = useState(null); // 'notifications' | 'account' | null
  const menusRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return undefined;
    const onDoc = (e) => {
      if (menusRef.current && !menusRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const badgeCount = Number(notificationCount) || 0;

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
        <div className={`min-w-0 ${hideTitleOnMobile ? 'hidden lg:block' : ''}`}>
          <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">{page.title}</h1>
          <p className="hidden truncate text-sm text-gray-500 sm:block">{page.subtitle}</p>
          <p className="truncate text-[11px] text-gray-500 sm:hidden">{page.subtitle}</p>
        </div>
      </div>

      <div ref={menusRef} className="relative flex shrink-0 items-center gap-2 sm:gap-4">
        {useMock() && (
          <span className="hidden rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 sm:inline-flex">
            Demo mode
          </span>
        )}

        {dateLabel && (
          <div className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 sm:flex">
            <Calendar size={15} className="text-indigo-600" />
            {dateLabel}
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setOpenMenu((m) => {
                const next = m === 'notifications' ? null : 'notifications';
                if (next === 'notifications') onNotificationsOpened?.();
                return next;
              });
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            aria-label="Notifications"
            aria-expanded={openMenu === 'notifications'}
          >
            <Bell size={18} />
            {badgeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </button>

          {openMenu === 'notifications' ? (
            <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-bold text-gray-900">Notifications</p>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onNotificationsOpened?.();
                    onNotificationsClick?.();
                  }}
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  View all
                  <ChevronRight size={14} />
                </button>
              </div>
              <ul className="max-h-72 overflow-y-auto py-1">
                {notifications.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-gray-500">
                    No notifications yet.
                  </li>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onNotificationsOpened?.();
                          if (onNotificationItemClick) {
                            onNotificationItemClick(n);
                          } else {
                            onNotificationsClick?.();
                          }
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{n.body}</p>
                        <p className="mt-1 text-[11px] font-medium text-indigo-600">{n.time}</p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'account' ? null : 'account'))}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white p-0.5 hover:bg-gray-50 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-2"
            aria-label="Account menu"
            aria-expanded={openMenu === 'account'}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500">
                {ROLE_LABELS[user?.role] || user?.role || 'Signed in'}
              </p>
            </div>
          </button>

          {openMenu === 'account' ? (
            <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-bold text-gray-900">{user?.name || 'User'}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {ROLE_LABELS[user?.role] || user?.role || 'Signed in'}
                </p>
                {user?.email ? (
                  <p className="mt-1 truncate text-xs text-gray-400">{user.email}</p>
                ) : null}
              </div>
              {onLogout ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              ) : null}
            </div>
          ) : null}
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
