import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  MessageSquare,
  Shield,
} from 'lucide-react';
import {
  getNotificationsFeed,
  markNotificationsSeen,
} from '../services/notificationService.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'holiday', label: 'Holidays' },
  { id: 'approval', label: 'Approvals' },
  { id: 'system', label: 'System' },
];

const TONE = {
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
  sky: 'bg-sky-50 text-sky-700',
  slate: 'bg-slate-100 text-slate-600',
};

const CATEGORY_ICON = {
  attendance: ClipboardCheck,
  holiday: CalendarDays,
  event: CalendarDays,
  approval: Shield,
  system: MessageSquare,
};

export default function NotificationsPage({ onNavigate, onFeedLoaded, onMarkAllRead }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const onFeedLoadedRef = useRef(onFeedLoaded);
  onFeedLoadedRef.current = onFeedLoaded;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getNotificationsFeed()
      .then((data) => {
        if (cancelled) return;
        const list = data.notifications || [];
        setItems(list);
        onFeedLoadedRef.current?.(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load notifications');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'holiday') {
      return items.filter((n) => n.category === 'holiday' || n.category === 'event');
    }
    return items.filter((n) => n.category === filter);
  }, [items, filter]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const handleMarkAllRead = () => {
    if (!items.length || unreadCount === 0) return;
    markNotificationsSeen(items.map((n) => n.id));
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    onMarkAllRead?.(items);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
              <Bell size={24} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Notifications</h2>
              <p className="text-sm text-gray-500">Alerts, holidays, and attendance reminders</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-400 disabled:hover:bg-white"
          >
            Mark all as read
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <LoaderCircle size={18} className="animate-spin text-indigo-500" />
            Loading…
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        {!loading && visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-medium text-gray-700">You’re all caught up</p>
            <p className="mt-1 text-xs text-gray-500">No notifications in this category.</p>
          </div>
        ) : null}

        {!loading && visible.length > 0 ? (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
            {visible.map((n) => {
              const Icon = CATEGORY_ICON[n.category] || Bell;
              const unread = !n.read;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => n.page && onNavigate?.(n.page)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-gray-50 ${
                      unread ? 'bg-indigo-50/40' : ''
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        TONE[n.tone] || TONE.slate
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'
                          }`}
                        >
                          {n.title}
                        </p>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-gray-400">
                          {unread ? (
                            <span className="h-2 w-2 rounded-full bg-indigo-500" aria-label="Unread" />
                          ) : null}
                          {n.time}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{n.body}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
