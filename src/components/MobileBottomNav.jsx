import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  CalendarDays,
  MoreHorizontal,
} from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

/**
 * Fixed bottom navigation for phone layouts.
 * "More" opens the sidebar so less-common pages stay reachable.
 */
export default function MobileBottomNav({
  activePage = 'attendance',
  onNavigate,
  onOpenMore,
}) {
  const isAttendance = activePage === 'attendance' || activePage === 'daywise';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgba(15,23,42,0.06)] backdrop-blur-md lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active =
            id === 'attendance'
              ? isAttendance
              : id === 'more'
                ? false
                : activePage === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === 'more') onOpenMore?.();
                else onNavigate?.(id);
              }}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors ${
                active
                  ? 'text-indigo-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  active ? 'bg-indigo-50 text-indigo-600' : ''
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
