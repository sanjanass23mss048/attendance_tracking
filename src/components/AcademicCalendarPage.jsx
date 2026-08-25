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
  Download,
  FileDown,
  X,
  CloudRain,
  Flag,
  MoonStar,
} from 'lucide-react';
import {
  EVENT_TYPES,
  CALENDAR_LEGEND,
} from '../data/calendarData';
import { exportAcademicCalendarPdf, resolveAcademicYearStart } from '../services/reportService.js';
import {
  createCalendarEvent,
  getMonthEvents,
  getAcademicYearEvents,
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
  { value: 'other', label: 'Others' },
];

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

function EventChip({ event, compact = false }) {
  const fullTitle = event.source === 'sunday' ? 'Weekly Holiday' : event.title || 'Event';
  const fullLabel = event.subtitle ? `${fullTitle} — ${event.subtitle}` : fullTitle;
  const titleClass = compact ? 'line-clamp-2 break-words' : 'break-words';

  if (event.source === 'sunday') {
    return (
      <div
        title={fullLabel}
        className="rounded-md bg-red-100 px-1 py-0.5 text-[9px] font-semibold leading-snug text-red-700 sm:px-1.5 sm:py-1 sm:text-[10px]"
      >
        <span className="flex items-start gap-0.5">
          <Sun size={10} className="mt-0.5 hidden shrink-0 sm:inline" />
          <span className={titleClass}>Weekly Holiday</span>
        </span>
      </div>
    );
  }

  if (
    event.source === 'calendarific' ||
    event.source === 'curated' ||
    event.source === 'nager' ||
    event.source === 'govt'
  ) {
    return (
      <div
        title={fullLabel}
        className="rounded-md border border-violet-100 bg-violet-50 px-1 py-0.5 text-[9px] font-semibold leading-snug text-violet-800 sm:px-1.5 sm:py-1 sm:text-[10px]"
      >
        <p className={titleClass}>{event.title}</p>
      </div>
    );
  }

  const style = EVENT_TYPES[event.type] || EVENT_TYPES.other;
  const Icon =
    event.type === 'exam'
      ? FlaskConical
      : event.type === 'important'
        ? Users
        : event.type === 'event'
          ? Star
          : Calendar;

  return (
    <div
      title={fullLabel}
      className={`rounded-md border px-1 py-0.5 text-[9px] font-semibold leading-snug sm:px-1.5 sm:py-1 sm:text-[10px] ${style.chip}`}
    >
      <div className="flex items-start gap-0.5">
        <Icon size={10} className="mt-0.5 hidden shrink-0 sm:inline" />
        <div className="min-w-0 flex-1">
          <p className={titleClass}>{event.title}</p>
          {event.subtitle ? (
            <p className={`font-medium opacity-80 ${compact ? 'line-clamp-1 break-words' : 'break-words'}`}>
              {event.subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DayEvents({ events }) {
  const maxVisible = 3;
  const visible = events.slice(0, maxVisible);
  const hidden = events.length - visible.length;
  return (
    <div className="space-y-0.5 sm:space-y-1">
      {visible.map((event) => (
        <EventChip key={event.id} event={event} compact />
      ))}
      {hidden > 0 ? (
        <p className="text-[9px] font-semibold text-indigo-600 sm:text-[10px]">+{hidden} more</p>
      ) : null}
    </div>
  );
}

export default function AcademicCalendarPage() {
  const defaultYear = 2026;
  const defaultMonth = 6; // July — matches mockup

  const [classGroup, setClassGroup] = useState('upto9');
  const [viewMode, setViewMode] = useState('calendar');
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [events, setEvents] = useState([]);
  const [scheduledEvents, setScheduledEvents] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    date: `${defaultYear}-07-15`,
    type: 'event',
    customType: '',
    subtitle: '',
    applicableTo: 'All Classes',
  });
  const [eventSubmitted, setEventSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [govtCount, setGovtCount] = useState(0);
  const [holidayState, setHolidayState] = useState(getDefaultHolidayState());
  const [selectedDay, setSelectedDay] = useState(null);
  const [exportNotice, setExportNotice] = useState('');
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [mobileListTab, setMobileListTab] = useState('upcoming');
  const [mobileCalView, setMobileCalView] = useState('calendar');

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

  useEffect(() => {
    setSelectedDay(null);
  }, [year, month]);

  const monthCells = useMemo(() => buildMonthDays(year, month), [year, month]);

  const classGroupFilter = (event) => {
    const a = (event.applicableTo || 'All Classes').toLowerCase();
    if (a === 'all classes' || !a) return true;
    if (classGroup === 'upto9') return a.includes('up to') || a.includes('9');
    return a.includes('10') || a.includes('above');
  };

  const filteredEvents = useMemo(
    () => events.filter(classGroupFilter),
    [events, classGroup]
  );

  const filteredScheduled = useMemo(
    () => scheduledEvents.filter(classGroupFilter),
    [scheduledEvents, classGroup]
  );

  const eventsByDay = useMemo(() => {
    const map = {};
    filteredEvents.forEach((event) => {
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
  }, [filteredEvents]);

  const monthStats = useMemo(() => {
    const sunday = filteredEvents.filter((e) => e.source === 'sunday').length;
    const schoolHoliday = filteredEvents.filter(
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
    const exam = filteredEvents.filter((e) => e.type === 'exam').length;
    const eventCount = filteredEvents.filter((e) => e.type === 'event').length;
    const important = filteredEvents.filter((e) => e.type === 'important').length;
    return { sunday, schoolHoliday, exam, eventCount, important };
  }, [filteredEvents]);

  const upcomingInMonth = useMemo(
    () =>
      filteredEvents
        .filter((e) => e.source !== 'sunday' && e.type !== 'holiday')
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [filteredEvents]
  );

  const mobileEvents = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const list = filteredEvents
      .filter((e) => e.source !== 'sunday')
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    if (mobileListTab === 'upcoming') {
      return list.filter((e) => !e.date || e.date >= todayIso).slice(0, 12);
    }
    return list;
  }, [filteredEvents, mobileListTab]);

  const changeMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };

  const openEventForm = () => {
    const pad = (n) => String(n).padStart(2, '0');
    setEventForm({
      title: '',
      date: `${year}-${pad(month + 1)}-15`,
      type: 'event',
      customType: '',
      subtitle: '',
      applicableTo: 'All Classes',
    });
    setEventSubmitted(false);
    setError('');
    setShowEventForm(true);
  };

  const academicStartYear = useMemo(
    () => resolveAcademicYearStart(year, month),
    [year, month]
  );

  const runAcademicCalendarExport = async () => {
    setExporting(true);
    setError('');
    setExportNotice('');
    try {
      const yearEvents = await getAcademicYearEvents(academicStartYear, holidayState);
      const today = new Date();
      const dateLabel = today.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        weekday: 'long',
      });
      exportAcademicCalendarPdf({
        startYear: academicStartYear,
        events: yearEvents,
        dateLabel,
      });
      setExportNotice('Print dialog opened — choose Save as PDF (landscape A4).');
      return { yearEvents, dateLabel };
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadCalendar = async () => {
    try {
      await runAcademicCalendarExport();
    } catch (err) {
      setError(err.message || 'Failed to download calendar');
    }
  };

  const handleExportCalendar = async () => {
    setError('');
    setExportNotice('');
    setPreviewMeta({
      startYear: academicStartYear,
      label: `${academicStartYear} – ${String(academicStartYear + 1).slice(-2)}`,
    });
    setPdfPreviewOpen(true);
  };

  const handleSaveCalendarExport = async () => {
    try {
      await runAcademicCalendarExport();
      setPdfPreviewOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to export calendar');
    }
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
    const customType = eventForm.customType.trim();
    if (eventForm.type === 'other' && !customType) {
      setError('Please specify the type.');
      return;
    }
    if (eventForm.type === 'other' && customType.length > 50) {
      setError('Custom type must be 50 characters or less.');
      return;
    }
    const resolvedType = eventForm.type === 'other' ? customType : eventForm.type;
    setSavingEvent(true);
    setError('');
    try {
      await createCalendarEvent({
        title: eventForm.title.trim(),
        date: eventForm.date,
        type: resolvedType,
        subtitle: eventForm.subtitle.trim(),
        applicableTo: eventForm.applicableTo || 'All Classes',
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

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {exportNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {exportNotice}
        </div>
      ) : null}

      {/* —— Mobile calendar (mockup) —— */}
      <div className="space-y-4 lg:hidden">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f5c542] px-4 py-4 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Academic Calendar</h2>
            <p className="mt-0.5 text-sm font-semibold text-gray-800">
              {MONTHS[month]} {year}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="rounded-full p-2 text-[#1e3a8a] hover:bg-black/5"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1e3a8a] text-white shadow-sm"
              aria-label="Next month"
            >
              <Calendar size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm border border-gray-200">
          <select
            value={classGroup}
            onChange={(e) => setClassGroup(e.target.value)}
            className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 px-3 text-sm font-semibold text-emerald-900"
          >
            <option value="upto9">Up to Class 9</option>
            <option value="above9">Class 10 &amp; above</option>
          </select>
        </div>

        <div className="flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileCalView('calendar')}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
              mobileCalView === 'calendar' ? 'bg-[#1e3a8a] text-white' : 'text-[#1e3a8a]'
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setMobileCalView('list')}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
              mobileCalView === 'list' ? 'bg-[#1e3a8a] text-white' : 'text-[#1e3a8a]'
            }`}
          >
            List
          </button>
        </div>

        {mobileCalView === 'calendar' ? (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="grid grid-cols-7 bg-gray-50 text-center text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {WEEKDAYS.map((day) => (
                <div key={day} className={`px-0.5 py-2 ${day === 'Sun' ? 'text-red-500' : ''}`}>
                  {day.slice(0, 3)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((cell, idx) => {
                const dayEvents = cell.inMonth ? eventsByDay[cell.day] || [] : [];
                const isSunday = cell.inMonth && dayEvents.some((e) => e.source === 'sunday');
                const isSelected = cell.inMonth && selectedDay === cell.day;
                const dots = dayEvents
                  .filter((e) => e.source !== 'sunday')
                  .slice(0, 3);
                return (
                  <button
                    type="button"
                    key={`m-${cell.day}-${idx}`}
                    disabled={!cell.inMonth}
                    onClick={() => {
                      if (!cell.inMonth) return;
                      setSelectedDay((prev) => (prev === cell.day ? null : cell.day));
                    }}
                    className={`min-h-[48px] border-b border-r border-gray-100 p-1 text-center ${
                      !cell.inMonth
                        ? 'bg-gray-50 text-gray-300'
                        : isSelected
                          ? 'bg-indigo-50'
                          : isSunday
                            ? 'bg-red-50'
                            : 'bg-white'
                    }`}
                  >
                    <p className={`text-xs font-semibold ${cell.inMonth ? 'text-gray-800' : 'text-gray-300'}`}>
                      {cell.day}
                    </p>
                    {cell.inMonth && (dots.length > 0 || isSunday) ? (
                      <div className="mt-0.5 flex justify-center gap-0.5">
                        {isSunday ? <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> : null}
                        {dots.map((event) => (
                          <span
                            key={event.id}
                            className={`h-1.5 w-1.5 rounded-full ${(EVENT_TYPES[event.type] || EVENT_TYPES.other).dot}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {mobileCalView === 'calendar' && selectedDay ? (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">
                {String(selectedDay).padStart(2, '0')} {MONTHS[month]} {year}
              </p>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-xs font-semibold text-[#1e3a8a]"
              >
                Close
              </button>
            </div>
            {(eventsByDay[selectedDay] || []).length ? (
              <ul className="space-y-1.5">
                {(eventsByDay[selectedDay] || []).map((event) => (
                  <li key={event.id} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-800">
                    {event.source === 'sunday' ? 'Weekly Holiday' : event.title}
                    {event.subtitle ? (
                      <span className="ml-1 font-medium text-gray-500">· {event.subtitle}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No events on this day.</p>
            )}
          </div>
        ) : null}

        <div className="flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileListTab('upcoming')}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
              mobileListTab === 'upcoming'
                ? 'bg-[#1e3a8a] text-white'
                : 'text-[#1e3a8a]'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setMobileListTab('all')}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
              mobileListTab === 'all' ? 'bg-[#1e3a8a] text-white' : 'text-[#1e3a8a]'
            }`}
          >
            All Events
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="animate-spin text-[#1e3a8a]" size={28} />
          </div>
        ) : mobileEvents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            No events for this month.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {mobileEvents.map((event) => {
              const style = EVENT_TYPES[event.type] || EVENT_TYPES.other;
              const isSudden = event.type === 'sudden' || event.source === 'sudden';
              const isHoliday = event.type === 'holiday' || event.source === 'sunday';
              const Icon = isSudden ? CloudRain : isHoliday ? Flag : MoonStar;
              const tagLabel = isSudden
                ? 'Sudden'
                : isHoliday
                  ? 'Holiday'
                  : style.label;
              const tagClass = isSudden
                ? 'bg-violet-100 text-violet-800'
                : isHoliday
                  ? 'bg-amber-100 text-amber-900'
                  : style.chip;
              const dateLabel = event.date
                ? new Date(`${event.date}T12:00:00`).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : `${String(event.day).padStart(2, '0')} ${MONTH_SHORT[month]} ${year}`;

              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (event.day) setSelectedDay(event.day);
                      setViewMode('list');
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-3 text-left shadow-sm"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.cardIcon}`}
                    >
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {event.source === 'sunday' ? 'Weekly Holiday' : event.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{dateLabel}</p>
                      <span
                        className={`mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${tagClass}`}
                      >
                        {tagLabel}
                      </span>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-gray-300" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-start gap-3 rounded-2xl bg-violet-50 px-4 py-3.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1e3a8a] text-white">
            <Calendar size={16} />
          </span>
          <p className="text-sm font-medium leading-snug text-gray-800">
            Stay informed about holidays, events and important school updates.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openEventForm}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-3 text-xs font-semibold text-gray-700"
          >
            <Plus size={14} /> Add Event
          </button>
          <button
            type="button"
            onClick={handleDownloadCalendar}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 py-3 text-xs font-semibold text-sky-800"
          >
            <Download size={14} /> Download
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-[#f5c542]/40 py-3 text-xs font-semibold text-amber-900"
          >
            <LoaderCircle size={14} /> Reload
          </button>
        </div>
      </div>

      <div className="hidden grid-cols-1 gap-5 lg:grid xl:grid-cols-[1fr_280px]">
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

              <div className="relative">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="appearance-none rounded-lg border border-gray-200 py-2 pl-3 pr-8 text-sm font-semibold text-gray-900"
                  aria-label="Year"
                >
                  {Array.from(
                    new Set([
                      ...Array.from({ length: 11 }, (_, i) => defaultYear - 5 + i),
                      year,
                    ])
                  )
                    .sort((a, b) => a - b)
                    .map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>

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

              <div className="relative">
                <select
                  value={classGroup}
                  onChange={(e) => setClassGroup(e.target.value)}
                  className="appearance-none rounded-lg border border-emerald-200 bg-emerald-50 py-2 pl-3 pr-8 text-sm font-semibold text-emerald-900"
                >
                  <option value="upto9">Up to Class 9</option>
                  <option value="above9">Class 10 &amp; above</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400" />
              </div>

              <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900">
                AY {academicStartYear}–{String(academicStartYear + 1).slice(-2)}
              </span>
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
              <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-[10px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">
                {WEEKDAYS.map((day) => (
                  <div key={day} className={`px-1 py-2 sm:px-2 sm:py-3 ${day === 'Sun' ? 'text-red-500' : ''}`}>
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {monthCells.map((cell, idx) => {
                  const dayEvents = cell.inMonth ? eventsByDay[cell.day] || [] : [];
                  const isSunday = cell.inMonth && dayEvents.some((e) => e.source === 'sunday');
                  const isSelected = cell.inMonth && selectedDay === cell.day;
                  return (
                    <button
                      type="button"
                      key={`${cell.day}-${idx}`}
                      disabled={!cell.inMonth}
                      onClick={() => {
                        if (!cell.inMonth) return;
                        setSelectedDay((prev) => (prev === cell.day ? null : cell.day));
                      }}
                      className={`min-h-[118px] border-b border-r border-gray-100 p-1 text-left align-top sm:min-h-[108px] sm:p-2 ${
                        !cell.inMonth
                          ? 'bg-gray-50/80 text-gray-300'
                          : isSelected
                            ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400'
                            : isSunday
                              ? 'bg-red-50/70'
                              : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <p
                        className={`mb-1 text-sm font-semibold ${
                          cell.inMonth ? 'text-gray-800' : 'text-gray-300'
                        }`}
                      >
                        {cell.day}
                      </p>
                      {cell.inMonth ? <DayEvents events={dayEvents} /> : null}
                    </button>
                  );
                })}
              </div>

              {selectedDay ? (
                <div className="border-t border-indigo-100 bg-indigo-50/60 px-4 py-3 sm:px-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-900">
                      {String(selectedDay).padStart(2, '0')} {MONTHS[month]} {year}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(null)}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      Close
                    </button>
                  </div>
                  {(eventsByDay[selectedDay] || []).length ? (
                    <ul className="space-y-2">
                      {(eventsByDay[selectedDay] || []).map((event) => {
                        const style = EVENT_TYPES[event.type] || EVENT_TYPES.other;
                        const label =
                          event.source === 'sunday'
                            ? 'Weekly Holiday'
                            : style.label;
                        return (
                          <li
                            key={event.id}
                            className="rounded-lg border border-white bg-white px-3 py-2 shadow-sm"
                          >
                            <p className="text-sm font-semibold text-gray-900">
                              {event.source === 'sunday' ? 'Weekly Holiday' : event.title}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {label}
                              {event.subtitle ? ` · ${event.subtitle}` : ''}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No events on this day.</p>
                  )}
                </div>
              ) : (
                <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 sm:hidden">
                  Tap a date to read the full event name.
                </p>
              )}

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
                    const style = EVENT_TYPES[event.type] || EVENT_TYPES.other;
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
            {upcomingInMonth.length === 0 && filteredScheduled.length === 0 ? (
              <p className="text-xs text-gray-400">No upcoming events this month.</p>
            ) : (
              <ul className="space-y-2.5">
                {(upcomingInMonth.length > 0 ? upcomingInMonth : filteredScheduled).map((event) => {
                  const style = EVENT_TYPES[event.type] || EVENT_TYPES.other;
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
                onClick={handleDownloadCalendar}
                disabled={exporting}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <Download size={14} className="text-indigo-600" />
                {exporting ? 'Preparing PDF…' : 'Download Academic Calendar'}
              </button>
              <button
                type="button"
                onClick={handleExportCalendar}
                disabled={exporting}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <FileDown size={14} className="text-indigo-600" /> Export Academic Calendar
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
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      type: e.target.value,
                      customType: e.target.value === 'other' ? prev.customType : '',
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {EVENT_FORM_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              {eventForm.type === 'other' && (
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Specify</label>
                  <input
                    type="text"
                    value={eventForm.customType}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, customType: e.target.value }))
                    }
                    placeholder="e.g. Workshop, Sports Day, Assembly"
                    maxLength={50}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    required
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-gray-500">Applicable To</label>
                <select
                  value={eventForm.applicableTo}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, applicableTo: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="All Classes">All Classes</option>
                  <option value="Up to Class 9">Up to Class 9</option>
                  <option value="Class 10 and above">Class 10 and above</option>
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


      {pdfPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                  Academic Calendar — {previewMeta?.label || `${academicStartYear} – ${String(academicStartYear + 1).slice(-2)}`}
                </h3>
                <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                  Two-page school calendar (Jun–Nov / Dec–Apr) with Day Order, colour-coded holidays &amp; events, and Important Details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPdfPreviewOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-auto px-4 py-4 sm:px-5">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950">
                <p className="font-semibold">Page 1 — June to November {academicStartYear}</p>
                <p className="mt-1 text-xs text-indigo-800/80">Six month columns · Date · Day · DO · Remarks</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">Page 2 — December {academicStartYear} to April {academicStartYear + 1}</p>
                <p className="mt-1 text-xs text-amber-800/80">Same layout with Important Details legend on each page</p>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
                <li>Sundays and holidays show “-” in DO and do not count</li>
                <li>Working days use Roman Day Order (I, II, III…)</li>
                <li>Print in <strong>landscape A4</strong> and choose Save as PDF</li>
              </ul>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setPdfPreviewOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveCalendarExport}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {exporting ? <LoaderCircle size={14} className="animate-spin" /> : <FileDown size={14} />}
                <span className="sm:hidden">Save PDF</span>
                <span className="hidden sm:inline">Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
