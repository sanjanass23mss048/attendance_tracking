import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  BookOpen,
  GraduationCap,
  BarChart3,
  Settings,
  FileText,
  Headset,
  Shield,
  CalendarDays,
  Pin,
  PinOff,
  ArrowRight,
  X,
} from 'lucide-react';
import { navItemsForUser } from '../data/navItems';
import attendanceLogoMark from '../assets/attendance-logo-mark.png';

const iconMap = {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  BookOpen,
  GraduationCap,
  BarChart3,
  Settings,
  FileText,
  Shield,
  CalendarDays,
};

export default function Sidebar({
  activePage,
  onNavigate,
  isPinned,
  onPinnedChange,
  isHovered,
  onHoveredChange,
  isMobileOpen,
  onMobileOpenChange,
  user = null,
}) {
  const [isMobile, setIsMobile] = useState(false);
  const items = navItemsForUser(user);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!isMobile && isMobileOpen) onMobileOpenChange?.(false);
  }, [isMobile, isMobileOpen, onMobileOpenChange]);

  const isOpen = isMobile
    ? Boolean(isMobileOpen)
    : Boolean(isPinned) || Boolean(isHovered) || Boolean(isMobileOpen);

  const handleNavigate = (id) => {
    onNavigate(id);
    if (isMobile) onMobileOpenChange?.(false);
  };

  return (
    <>
      {isMobile && isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[40] bg-black/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => onMobileOpenChange?.(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-[50] flex h-screen w-60 flex-col border-r border-indigo-900 bg-indigo-950 shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseEnter={() => {
          if (!isMobile && !isPinned) onHoveredChange?.(true);
        }}
        onMouseLeave={() => {
          if (!isMobile && !isPinned) onHoveredChange?.(false);
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-indigo-800 px-3 py-4">
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left hover:bg-indigo-900/50"
            aria-label="Go to Dashboard"
          >
            <img
              src={attendanceLogoMark}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-white/20"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight tracking-tight text-white">
                Presence
              </p>
              <p className="truncate text-[11px] leading-tight text-indigo-300">School attendance</p>
            </div>
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={() => onMobileOpenChange?.(false)}
              className="rounded-lg p-1.5 text-indigo-200 hover:bg-indigo-900 hover:text-white"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPinnedChange?.(!isPinned)}
              className={`rounded-lg p-1.5 transition-colors ${
                isPinned
                  ? 'bg-amber-400 text-gray-900 hover:bg-amber-300'
                  : 'text-indigo-300 hover:bg-indigo-900 hover:text-white'
              }`}
              title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              aria-pressed={isPinned}
            >
              {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 font-semibold text-white shadow-sm'
                    : 'text-indigo-200 hover:bg-indigo-900 hover:text-white'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="m-3 rounded-2xl border border-indigo-700/80 bg-gradient-to-br from-indigo-900 to-indigo-950 p-4 shadow-lg">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              <Headset size={20} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Need Help?</p>
              <p className="mt-0.5 text-[11px] leading-snug text-indigo-200">
                We&apos;re here to support you
              </p>
            </div>
          </div>
          <div className="mb-3 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            <span className="text-[11px] font-medium text-green-300">Support Online</span>
          </div>
          <button
            type="button"
            onClick={() => handleNavigate('support')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-400"
          >
            Contact Support
            <ArrowRight size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
