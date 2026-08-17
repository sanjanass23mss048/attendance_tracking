import {
  LayoutDashboard,
  ClipboardCheck,
  Megaphone,
  Users,
  CalendarDays,
} from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'notifications', label: 'Notice', icon: Megaphone },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];
/**
 * Fixed bottom navigation for phone layouts (navy + yellow active).
 */
export default function MobileBottomNav({
  activePage = 'dashboard',
  onNavigate,
}) {
  const resolved =
    activePage === 'daywise' || activePage === 'send-notification'
      ? activePage === 'daywise'
        ? 'attendance'
        : 'notifications'
      : activePage;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 bg-[#1e3a8a] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.18)] lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = resolved === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate?.(id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors ${
                active ? 'text-[#f5c542]' : 'text-white/70 hover:text-white'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
