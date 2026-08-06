import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  ChevronDown,
  LoaderCircle,
  Sun,
  Star,
  Users,
  FlaskConical,
  Plus,
  Zap,
  Download,
  FileDown,
  X,
} from 'lucide-react';
import {
  EVENT_TYPES,
  DEFAULT_SUDDEN_HOLIDAY,
  APPLICABLE_OPTIONS,
  CALENDAR_LEGEND,
  buildSuddenHolidayMessage,
} from '../data/calendarData';
import {
  createSuddenHoliday,
  createCalendarEvent,
  getMonthEvents,
  getGovtHolidayMeta,
  getScheduledEvents,
  getDefaultHolidayState,
  getHolidayStates,
  isCalendarificConfigured,
  refreshGovtHolidays,
  migrateLocalStorageToDb,
} from '../services/calendarService';

const EVENT_FORM_TYPES = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'event', label: 'Event' },
  { value: 'exam', label: 'Exam' },
  { value: 'important', label: 'Important' },
];

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function eventsToCsv(events) {
  const header = ['Date', 'Title', 'Type', 'Source', 'Subtitle'];
  const rows = events.map((event) =>
    [event.date, event.title, event.type, event.source, event.subtitle || '']
      .map(escapeCsv)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

function icsEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function eventsToIcs(events, calendarName) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Attendance Tracking//Academic Calendar//EN',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    'CALSCALE:GREGORIAN',
  ];

  events.forEach((event) => {
    const dt = String(event.date || '').replace(/-/g, '');
    if (!/^\d{8}$/.test(dt)) return;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(event.id)}@attendance-tracking`,
      `DTSTAMP:${dt}T000000Z`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${icsEscape(event.title)}`,
    );
    if (event.subtitle) {
      lines.push(`DESCRIPTION:${icsEscape(event.subtitle)}`);
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function openPrintFriendlyCalendar(events, title) {
  const rows = events
    .map(
      (event) =>
        `<tr><td>${event.date}</td><td>${event.title}</td><td>${event.type}</td><td>${event.subtitle || ''}</td></tr>`
    )
    .join('');
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: Georgia, serif; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 8px; }
      p { color: #555; font-size: 13px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #f5f5f5; }
    </style></head><body>
    <h1>${title}</h1>
    <p>Print this page or use your browser’s “Save as PDF”.</p>
    <table><thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Notes</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No events</td></tr>'}</tbody></table>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function buildMonthDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i -= 1) {
    cells.push({ day: prevMonthDays - i, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - (firstDay + daysInMonth) + 1, inMonth: false });
  }
  return cells;
}

function EventChip({ event }) {
  if (event.source === 'sunday') {
    return (
      <div className="flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-1 text-[10px] font-semibold text-red-700">
        <Sun size={11} className="shrink-0" />
        <span className="truncate">Weekly Holiday</span>
      </div>
    );
  }

  if (event.source === 'calendarific' || event.source === 'curated' || event.source === 'nager' || event.source === 'govt') {
    return (
      <div className="rounded-md border border-violet-100 bg-violet-50 px-1.5 py-1 text-[10px] font-semibold text-violet-800">
        <p className="truncate">{event.title}</p>
      </div>
    );
  }

  const style = EVENT_TYPES[event.type] || EVENT_TYPES.event;
  const Icon =
    event.type === 'exam' ? FlaskConical : event.type === 'important' ? Users : event.type === 'event' ? Star : Calendar;

  return (
    <div className={`flex items-start gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold leading-tight ${style.chip}`}>
      <Icon size={11} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="truncate">{event.title}</p>
        {event.subtitle && <p className="truncate font-medium opacity-80">{event.subtitle}</p>}
      </div>
    </div>
  );
}

function DayEvents({ events }) {
  const maxVisible = 2;
  const visible = events.slice(0, maxVisible);
  const hidden = events.length - visible.length;
  return (
    <div className="space-y-1">
      {visible.map((event) => (
        <EventChip key={event.id} event={event} />
      ))}
      {hidden > 0 && <p className="text-[10px] font-semibold text-indigo-600">+{hidden} more</p>}
    </div>
  );
}

export default function AcademicCalendarPage() {
  const defaultYear = 2026;
  const defaultMonth = 6; // July — matches mockup

  const [viewMode, setViewMode] = useState('calendar');
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [events, setEvents] = useState([]);
  const [scheduledEvents, setScheduledEvents] = useState([]);
  const [showSuddenForm, setShowSuddenForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    ...DEFAULT_SUDDEN_HOLIDAY,
    date: `${defaultYear}-07-14`,
    message: buildSuddenHolidayMessage(DEFAULT_SUDDEN_HOLIDAY.reason),
  });
  const [eventForm, setEventForm] = useState({
    title: '',
    date: `${defaultYear}-07-15`,
    type: 'event',
    subtitle: '',
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [eventSubmitted, setEventSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [govtCount, setGovtCount] = useState(0);
  const [holidayState, setHolidayState] = useState(getDefaultHolidayState());

  const calendarificReady = isCalendarificConfigured();
  const holidayStates = getHolidayStates();

  useEffect(() => {
    migrateLocalStorageToDb();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [monthEvents, scheduled, meta] = await Promise.all([
          getMonthEvents(year, month, holidayState),
          getScheduledEvents(8, year, holidayState),
          getGovtHolidayMeta(year, holidayState),
        ]);
        if (!cancelled) {
          setEvents(monthEvents);
          setScheduledEvents(scheduled);
          setGovtCount(meta.events?.length || 0);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load calendar events');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [year, month, reloadKey, holidayState]);

  const monthCells = useMemo(() => buildMonthDays(year, month), [year, month]);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((event) => {
      if (!map[event.day]) map[event.day] = [];
      map[event.day].push(event);
    });
    Object.keys(map).forEach((day) => {
      map[day].sort((a, b) => {
        const rank = (e) => {
          if (e.source === 'sunday') return 0;
          if (e.source === 'sudden') return 1;
          if (e.type === 'exam') return 2;
          if (e.type === 'important') return 3;
          if (e.type === 'event') return 4;
          return 5;
        };
        return rank(a) - rank(b) || a.title.localeCompare(b.title);
      });
    });
    return map;
  }, [events]);

  const monthStats = useMemo(() => {
    const sunday = events.filter((e) => e.source === 'sunday').length;
    const schoolHoliday = events.filter(
      (e) =>
        e.source !== 'sunday' &&
        (e.type === 'holiday' || e.type === 'sudden') &&
        (e.source === 'school' ||
          e.source === 'sudden' ||
          e.source === 'api' ||
          e.source === 'calendarific' ||
          e.source === 'curated' ||
          e.source === 'govt' ||
          e.source === 'nager')
    ).length;
    const exam = events.filter((e) => e.type === 'exam').length;
    const eventCount = events.filter((e) => e.type === 'event').length;
    const important = events.filter((e) => e.type === 'important').length;
    return { sunday, schoolHoliday, exam, eventCount, important };
  }, [events]);

  const upcomingInMonth = useMemo(
    () =>
      events
        .filter((e) => e.source !== 'sunday' && e.type !== 'holiday')
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [events]
  );

  const changeMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };

  const openSuddenForm = () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setHolidayForm({
      ...DEFAULT_SUDDEN_HOLIDAY,
      date: iso,
      message: buildSuddenHolidayMessage(DEFAULT_SUDDEN_HOLIDAY.reason),
    });
    setFormSubmitted(false);
    setError('');
    setShowSuddenForm(true);
  };

  const openEventForm = () => {
    const pad = (n) => String(n).padStart(2, '0');
    setEventForm({
      title: '',
      date: `${year}-${pad(month + 1)}-15`,
      type: 'event',
      subtitle: '',
    });
    setEventSubmitted(false);
    setError('');
    setShowEventForm(true);
  };

  const handleDownloadCalendar = () => {
    if (events.length === 0) {
      setError('No events in the current month to download.');
      return;
    }
    setError('');
    const filename = `academic-calendar-${year}-${String(month + 1).padStart(2, '0')}.csv`;
    downloadTextFile(filename, eventsToCsv(events), 'text/csv;charset=utf-8');
  };

  const handleExportCalendar = () => {
    if (events.length === 0) {
      setError('No events in the current month to export.');
      return;
    }
    setError('');
    const label = `${MONTHS[month]} ${year}`;
    const filename = `academic-calendar-${year}-${String(month + 1).padStart(2, '0')}.ics`;
    downloadTextFile(filename, eventsToIcs(events, `Academic Calendar — ${label}`), 'text/calendar;charset=utf-8');
    openPrintFriendlyCalendar(events, `Academic Calendar — ${label}`);
  };

  const handleSubmitEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim()) {
      setError('Please enter a title for the holiday or event.');
      return;
    }
    if (!eventForm.date) {
      setError('Please choose a date.');
      return;
    }
    setSavingEvent(true);
    setError('');
    try {
      await createCalendarEvent({
        title: eventForm.title.trim(),
        date: eventForm.date,
        type: eventForm.type,
        subtitle: eventForm.subtitle.trim(),
      });
      setEventSubmitted(true);
      const [y, m] = eventForm.date.split('-').map(Number);
      setYear(y);
      setMonth(m - 1);
      setReloadKey((key) => key + 1);
      setTimeout(() => {
        setEventSubmitted(false);
        setShowEventForm(false);
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to save holiday / event');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleSubmitHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.reason.trim()) {
      setError('Please enter a reason for the sudden holiday.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createSuddenHoliday({
        date: holidayForm.date,
        reason: holidayForm.reason.trim(),
        applicableTo: holidayForm.applicableTo,
        message: holidayForm.message,
      });
      setFormSubmitted(true);
      const [y, m] = holidayForm.date.split('-').map(Number);
      setYear(y);
      setMonth(m - 1);
      setReloadKey((key) => key + 1);
      setTimeout(() => {
        setFormSubmitted(false);
        setShowSuddenForm(false);
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to save sudden holiday');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <ChevronRight size={18} />
              </button>

              <div className="relative">
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="appearance-none rounded-lg border border-gray-200 py-2 pl-3 pr-8 text-sm font-semibold text-gray-900"
                  aria-label="Month"
                >
                  {MONTH_SHORT.map((label, m) => (
                    <option key={label} value={m}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <span className="text-sm font-semibold text-gray-900">{year}</span>

              <div className="relative">
                <select
                  value={holidayState}
                  onChange={(e) => setHolidayState(e.target.value)}
                  className="appearance-none rounded-lg border border-indigo-200 bg-indigo-50 py-2 pl-3 pr-8 text-sm font-semibold text-indigo-900"
                >
                  {holidayStates.map((state) => (
                    <option key={state.id} value={state.id}>{state.label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-gray-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Calendar size={14} /> Calendar View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <List size={14} /> List View
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await refreshGovtHolidays(year, holidayState);
                    setReloadKey((k) => k + 1);
                  } catch (err) {
                    setError(err.message || 'Refresh failed');
                    setLoading(false);
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-amber-500"
              >
                {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
                Reload
              </button>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <>
              <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-xs font-bold uppercase tracking-wide text-gray-500">
                {WEEKDAYS.map((day) => (
                  <div key={day} className={`px-2 py-3 ${day === 'Sun' ? 'text-red-500' : ''}`}>{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {monthCells.map((cell, idx) => {
                  const dayEvents = cell.inMonth ? eventsByDay[cell.day] || [] : [];
                  const isSunday = cell.inMonth && dayEvents.some((e) => e.source === 'sunday');
                  return (
                    <div
                      key={`${cell.day}-${idx}`}
                      className={`min-h-[108px] border-b border-r border-gray-100 p-2 ${
                        !cell.inMonth
                          ? 'bg-gray-50/80 text-gray-300'
                          : isSunday
                            ? 'bg-red-50/70'
                            : 'bg-white'
                      }`}
                    >
                      <p className={`mb-1.5 text-sm font-semibold ${cell.inMonth ? 'text-gray-800' : 'text-gray-300'}`}>
                        {cell.day}
                      </p>
                      {cell.inMonth && <DayEvents events={dayEvents} />}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  {monthStats.sunday} Weekly Holidays
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  {monthStats.schoolHoliday + govtCount > 0 ? monthStats.schoolHoliday : monthStats.schoolHoliday} School Holidays
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {monthStats.exam} Exams
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  {monthStats.eventCount} Events
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  {monthStats.important} Important
                </span>
                {calendarificReady && (
                  <span className="ml-auto text-[11px] text-indigo-600">Govt holidays: Calendarific ({govtCount}/yr)</span>
                )}
              </div>
            </>
          ) : (
            <div className="divide-y divide-gray-100">
              {events.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-gray-400">No events this month.</p>
              ) : (
                [...events]
                  .sort((a, b) => a.day - b.day)
                  .map((event) => {
                    const style = EVENT_TYPES[event.type] || EVENT_TYPES.event;
                    return (
                      <div key={event.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{event.title}</p>
                          <p className="text-xs text-gray-500">
                            {String(event.day).padStart(2, '0')} {MONTHS[month]} {year}
                            {event.subtitle ? ` · ${event.subtitle}` : ''}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style.chip}`}>
                          {event.source === 'sunday' ? 'Weekly Holiday' : style.label}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Legend</h3>
            <ul className="space-y-2">
              {CALENDAR_LEGEND.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Upcoming Events</h3>
            {upcomingInMonth.length === 0 && scheduledEvents.length === 0 ? (
              <p className="text-xs text-gray-400">No upcoming events this month.</p>
            ) : (
              <ul className="space-y-2.5">
                {(upcomingInMonth.length > 0 ? upcomingInMonth : scheduledEvents).map((event) => {
                  const style = EVENT_TYPES[event.type] || EVENT_TYPES.event;
                  return (
                    <li key={event.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-xs font-semibold text-gray-900">{event.title}</p>
                      <p className="text-[11px] text-gray-500">
                        {event.date || `${event.day}/${month + 1}/${year}`}
                        {event.subtitle ? ` · ${event.subtitle}` : ''}
                      </p>
                      <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${style.chip}`}>
                        {style.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Quick Actions</h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={openEventForm}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus size={14} className="text-indigo-600" /> Add Holiday / Event
              </button>
              <button
                type="button"
                onClick={openSuddenForm}
                className="flex w-full items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-left text-xs font-semibold text-violet-800 hover:bg-violet-100"
              >
                <Zap size={14} /> Sudden Holiday
              </button>
              <button
                type="button"
                onClick={handleDownloadCalendar}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download size={14} className="text-indigo-600" /> Download Calendar
              </button>
              <button
                type="button"
                onClick={handleExportCalendar}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <FileDown size={14} className="text-indigo-600" /> Export as PDF / ICS
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-gray-900">View Options</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium ${
                  viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600'
                }`}
              >
                <Calendar size={14} /> Calendar
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium ${
                  viewMode === 'list' ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600'
                }`}
              >
                <List size={14} /> List
              </button>
            </div>
          </div>
        </aside>
      </div>

      {showEventForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmitEvent}
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Add Holiday / Event</h3>
              <button
                type="button"
                onClick={() => setShowEventForm(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-500">
              Add a planned holiday, exam, or school event to the academic calendar.
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Independence Day, Science Fair"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Date</label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Type</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {EVENT_FORM_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Subtitle / notes (optional)</label>
                <input
                  type="text"
                  value={eventForm.subtitle}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="e.g. All Classes, 10:00 AM"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEventForm(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEvent}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingEvent ? 'Saving…' : eventSubmitted ? 'Saved!' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showSuddenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmitHoliday}
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Add Sudden Holiday</h3>
              <button type="button" onClick={() => setShowSuddenForm(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-500">
              For rain, strike, or other unplanned closures. Saves locally and syncs to the server when live. Parent message is prepared automatically.
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Date</label>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Reason</label>
                <input
                  type="text"
                  value={holidayForm.reason}
                  onChange={(e) => {
                    const reason = e.target.value;
                    setHolidayForm((prev) => ({
                      ...prev,
                      reason,
                      message: buildSuddenHolidayMessage(reason),
                    }));
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Applicable To</label>
                <select
                  value={holidayForm.applicableTo}
                  onChange={(e) => setHolidayForm((prev) => ({ ...prev, applicableTo: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {APPLICABLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Message to Parents</label>
                <textarea
                  rows={4}
                  value={holidayForm.message}
                  onChange={(e) => setHolidayForm((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowSuddenForm(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : formSubmitted ? 'Submitted!' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
