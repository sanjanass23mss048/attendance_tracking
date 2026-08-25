import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Lock,
  Search,
  Unlock,
  AlertTriangle,
  BarChart2,
  RotateCcw,
} from 'lucide-react';
import { formatClassLabel, compareClassNames } from '../data/schoolGrades.js';
import { canApproveEditRequests } from '../data/navItems.js';
import { getClassComparison, getDailyReport } from '../services/reportService.js';
import { resolveSectionId } from '../services/classService.js';
import {
  createEditRequest,
  getMyEditRequests,
} from '../services/attendanceEditRequestService.js';
import {
  formatAttendanceDate,
  getTodayAttendanceDate,
  shiftAttendanceDate,
  snapToWorkingAttendanceDate,
} from '../utils/attendance.js';
import { STATUS_LABELS } from './reports/attendancePaths.js';
import { showToast } from '../services/toast.js';
import AttendanceEditRequestModal from './AttendanceEditRequestModal.jsx';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'P', label: 'Present' },
  { id: 'A', label: 'Absent' },
  { id: 'H', label: 'Half Day' },
  { id: 'OH', label: 'OD Half' },
  { id: 'OF', label: 'OD' },
  { id: 'L', label: 'Late' },
];

function statusTone(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'P') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (c === 'A') return 'bg-rose-50 text-rose-800 ring-rose-200';
  if (c === 'H' || c === 'OH') return 'bg-amber-50 text-amber-900 ring-amber-200';
  if (c === 'OF' || c === 'L') return 'bg-sky-50 text-sky-800 ring-sky-200';
  return 'bg-slate-50 text-slate-700 ring-slate-200';
}

function markState(row) {
  const students = Number(row.studentCount || 0);
  const marked = Number(row.marked || 0);
  if (marked <= 0) return 'unmarked';
  if (students > 0 && marked < students) return 'partial';
  return 'marked';
}

function Avatar({ name }) {
  const initial = String(name || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-800">
      {initial}
    </span>
  );
}

function longDate(iso) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function shortDate(iso) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

export default function AttendanceHistoryPage({
  user = null,
  classesData = [],
  onNavigate,
  initialDate = null,
}) {
  const today = getTodayAttendanceDate();
  const [date, setDate] = useState(initialDate || shiftAttendanceDate(today, -1));
  const [loading, setLoading] = useState(true);
  const [classRows, setClassRows] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);
  const [drill, setDrill] = useState(null); // { className, sectionName, sectionId }
  const [students, setStudents] = useState([]);
  const [sectionSummary, setSectionSummary] = useState({});
  const [sectionLoading, setSectionLoading] = useState(false);
  const [studentStatusChip, setStudentStatusChip] = useState('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editHistory, setEditHistory] = useState([]);
  const dateInputRef = useRef(null);

  const isToday = date === today;
  const isHistorical = date < today;

  const classOptions = useMemo(() => {
    const names = [...new Set(classRows.map((r) => r.className))].sort(compareClassNames);
    return names;
  }, [classRows]);

  const sectionOptions = useMemo(() => {
    if (!filterClass) return [];
    return [
      ...new Set(
        classRows.filter((r) => String(r.className) === String(filterClass)).map((r) => r.sectionName)
      ),
    ].sort();
  }, [classRows, filterClass]);

  const filteredRows = useMemo(() => {
    return classRows.filter((row) => {
      if (filterClass && String(row.className) !== String(filterClass)) return false;
      if (filterSection && String(row.sectionName) !== String(filterSection)) return false;
      if (showUnmarkedOnly && markState(row) === 'marked') return false;
      return true;
    });
  }, [classRows, filterClass, filterSection, showUnmarkedOnly]);

  const completion = useMemo(() => {
    const total = classRows.length;
    const marked = classRows.filter((r) => markState(r) === 'marked').length;
    const partial = classRows.filter((r) => markState(r) === 'partial').length;
    const unmarked = classRows.filter((r) => markState(r) === 'unmarked').length;
    return { total, marked, partial, unmarked };
  }, [classRows]);

  const loadRows = async (forDate) => {
    setLoading(true);
    try {
      const data = await getClassComparison({ date: forDate });
      setClassRows(data.classes || []);
    } catch (err) {
      showToast(err.message || 'Could not load attendance history', 'error');
      setClassRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows(date);
  }, [date]);

  useEffect(() => {
    if (!drill) {
      setStudents([]);
      setSectionSummary({});
      return undefined;
    }
    let cancelled = false;
    setSectionLoading(true);
    (async () => {
      try {
        const sid =
          drill.sectionId ||
          (await resolveSectionId(drill.className, drill.sectionName));
        const report = await getDailyReport({
          date,
          sectionId: sid || undefined,
          className: drill.className,
          section: sid ? undefined : drill.sectionName,
        });
        if (cancelled) return;
        setStudents(report.students || []);
        setSectionSummary(report.summary || {});
        if (report.holiday) {
          showToast('This date is a holiday — no attendance roster.', 'info');
        }
        setDrill((prev) => (prev ? { ...prev, sectionId: sid || prev.sectionId } : prev));
      } catch (err) {
        if (!cancelled) {
          setStudents([]);
          setSectionSummary({});
          showToast(err?.message || 'Could not load section attendance', 'error');
        }
      } finally {
        if (!cancelled) setSectionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drill?.className, drill?.sectionName, date]);

  useEffect(() => {
    let cancelled = false;
    getMyEditRequests()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.requests) ? res.requests : Array.isArray(res) ? res : [];
        setEditHistory(
          list
            .filter((r) => String(r.attendanceDate || r.attendance_date || '').slice(0, 10) === date)
            .slice(0, 8)
        );
      })
      .catch(() => {
        if (!cancelled) setEditHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const goPrev = async () => {
    const next = await snapToWorkingAttendanceDate(shiftAttendanceDate(date, -1));
    setDate(next);
  };

  const goNext = async () => {
    const candidate = shiftAttendanceDate(date, 1);
    if (candidate > today) return;
    const next = await snapToWorkingAttendanceDate(candidate);
    if (next > today) setDate(today);
    else setDate(next);
  };

  const goToday = () => setDate(today);

  const resetFilters = () => {
    setFilterClass('');
    setFilterSection('');
    setFilterStatus('all');
    setSearch('');
    setShowUnmarkedOnly(false);
    setStudentStatusChip('all');
  };

  const openSection = (row) => {
    setStudentStatusChip('all');
    setDrill({
      className: row.className,
      sectionName: row.sectionName,
      sectionId: row.sectionId || null,
    });
  };

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const code = String(s.status || 'P').toUpperCase();
      if (studentStatusChip !== 'all' && code !== studentStatusChip) return false;
      if (filterStatus !== 'all' && code !== filterStatus) return false;
      if (!q) return true;
      return (
        String(s.name || '')
          .toLowerCase()
          .includes(q) || String(s.rollNo || '').includes(q)
      );
    });
  }, [students, search, studentStatusChip, filterStatus]);

  const submitEditRequest = async (reason) => {
    if (!drill?.sectionId && !drill?.sectionName) {
      showToast('Open a class section first', 'error');
      return;
    }
    setEditSubmitting(true);
    try {
      let sid = drill.sectionId;
      if (!sid) sid = await resolveSectionId(drill.className, drill.sectionName);
      await createEditRequest({
        sectionId: sid,
        attendanceDate: date,
        reason,
      });
      showToast('Edit request submitted', 'success');
      setEditModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Could not submit edit request', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const unlockAndEdit = () => {
    if (!drill) return;
    const ok = window.confirm(
      `Unlock attendance for ${formatClassLabel(drill.className)}-${drill.sectionName} on ${longDate(date)} and open the mark-attendance screen?`
    );
    if (!ok) return;
    onNavigate?.('attendance', {
      view: 'grid',
      className: drill.className,
      sectionName: drill.sectionName,
      date,
    });
  };

  const DateNav = ({ compact = false }) => (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'justify-between'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          className="inline-flex items-center gap-1 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50"
        >
          <ArrowLeft size={16} />
          {compact ? shortDate(shiftAttendanceDate(date, -1)) : 'Previous Day'}
        </button>
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-950"
        >
          <CalendarDays size={16} className="text-amber-500" />
          {longDate(date)}
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          max={today}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
        <button
          type="button"
          onClick={goNext}
          disabled={date >= today}
          className="inline-flex items-center gap-1 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {compact ? shortDate(shiftAttendanceDate(date, 1)) : 'Next Day'}
          <ArrowRight size={16} />
        </button>
      </div>
      <button
        type="button"
        onClick={goToday}
        className={`rounded-xl px-3 py-2 text-sm font-semibold ${
          isToday
            ? 'bg-indigo-700 text-white'
            : 'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
        }`}
      >
        Today
      </button>
    </div>
  );

  if (drill) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => setDrill(null)}
              className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700"
            >
              <ArrowLeft size={16} /> All classes
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              Class {formatClassLabel(drill.className)}-{drill.sectionName} – Attendance
            </h2>
            <p className="mt-1 text-sm text-gray-500">{longDate(date)}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('reports')}
            className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-800"
          >
            View Detailed Reports
          </button>
        </div>

        <DateNav compact />

        {isHistorical ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-amber-950">
              <Lock size={16} className="mt-0.5 shrink-0" />
              <p>
                <strong>View Mode</strong> — This attendance record is locked because it belongs to a
                previous date.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canApproveEditRequests(user) ? (
                <button
                  type="button"
                  onClick={unlockAndEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Unlock size={14} /> Unlock &amp; Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900"
                >
                  Request Edit
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Students" value={sectionSummary.total ?? students.length} tone="indigo" />
          <MiniStat label="Present" value={sectionSummary.present ?? 0} tone="emerald" />
          <MiniStat label="Absent" value={sectionSummary.absent ?? 0} tone="rose" />
          <MiniStat
            label="Half Day / OD"
            value={
              (sectionSummary.halfDay || 0) +
              (sectionSummary.odHalfDay || 0) +
              (sectionSummary.odFullDay || 0)
            }
            tone="amber"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.filter((s) => s.id !== 'L' && s.id !== 'OH').map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStudentStatusChip(chip.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                studentStatusChip === chip.id
                  ? 'bg-indigo-700 text-white'
                  : 'border border-gray-200 bg-white text-gray-700'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {sectionLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <LoaderCircle className="animate-spin text-indigo-600" size={18} /> Loading students…
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredStudents.map((s) => {
                const code = String(s.status || 'P').toUpperCase();
                return (
                  <li key={s.id || `${s.rollNo}-${s.name}`} className="flex items-start gap-3 px-4 py-3">
                    <Avatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {String(s.rollNo ?? '').padStart(2, '0')} – {s.name}
                      </p>
                      {(s.leaveReason || s.reason || s.remarks) && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {s.leaveReason || s.reason || s.remarks}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusTone(code)}`}
                    >
                      {STATUS_LABELS[code] || code}
                    </span>
                  </li>
                );
              })}
              {!filteredStudents.length ? (
                <li className="px-4 py-12 text-center text-sm text-gray-500">No students match filters.</li>
              ) : null}
            </ul>
          )}
        </div>

        {editHistory.length ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900">Attendance Edit History</h3>
            <ul className="mt-3 space-y-3">
              {editHistory.map((h) => (
                <li key={h.id} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-gray-900">
                    {formatAttendanceDate(h.attendanceDate || date)} · {h.status}
                  </p>
                  <p className="text-xs text-gray-600">{h.reason || h.denyReason || '—'}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <AttendanceEditRequestModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSubmit={submitEditRequest}
          teacherName={user?.name}
          classLabel={`${formatClassLabel(drill.className)}-${drill.sectionName}`}
          attendanceDateLabel={longDate(date)}
          submitting={editSubmitting}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance History</h2>
          <p className="mt-1 text-sm text-gray-500">View attendance records from previous days.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('reports')}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-50"
        >
          <BarChart2 size={16} />
          View Detailed Reports
        </button>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
        <DateNav />
      </div>

      {isHistorical ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Lock size={16} className="mt-0.5 shrink-0" />
          Historical day — records open in view mode. Use Request Edit / Unlock &amp; Edit from a class.
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">Attendance Completion</h3>
          <button
            type="button"
            onClick={() => setShowUnmarkedOnly((v) => !v)}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            {showUnmarkedOnly ? 'Show all classes' : 'View Unmarked Classes'}
          </button>
        </div>
        <p className="text-sm text-gray-700">
          <span className="font-bold text-indigo-900">
            {completion.marked} / {completion.total || 0} Classes Marked
          </span>
          {completion.unmarked ? (
            <span className="ml-2 text-amber-800">
              · {completion.unmarked} not marked
              {completion.partial ? ` · ${completion.partial} partial` : ''}
            </span>
          ) : (
            <span className="ml-2 text-emerald-700">· All marked</span>
          )}
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Class
          <select
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900"
            value={filterClass}
            onChange={(e) => {
              setFilterClass(e.target.value);
              setFilterSection('');
            }}
          >
            <option value="">All Classes</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {formatClassLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Section
          <select
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900"
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            disabled={!filterClass}
          >
            <option value="">All Sections</option>
            {sectionOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Attendance Status
          <select
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:col-span-2 lg:col-span-1">
          Search Student
          <span className="relative mt-1 block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm font-medium text-gray-900"
              placeholder="Name or roll"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-slate-100"
          >
            <RotateCcw size={14} /> Reset Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-20 text-sm text-gray-500">
          <LoaderCircle className="animate-spin text-indigo-600" size={18} /> Loading history…
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((row) => {
            const state = markState(row);
            const present = Number(row.present || 0);
            const absent = Number(row.absent || 0);
            const half =
              Number(row.halfDay || 0) + Number(row.odHalfDay || 0) + Number(row.odFullDay || 0);
            const pct = row.attendancePercent ?? 0;
            return (
              <button
                key={`${row.className}-${row.sectionName}`}
                type="button"
                onClick={() => openSection(row)}
                className="rounded-2xl border border-indigo-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-indigo-950">
                      Class {formatClassLabel(row.className)}-{row.sectionName}
                    </p>
                    <p className="text-xs font-medium text-gray-500">
                      {row.studentCount || 0} Students
                    </p>
                  </div>
                  <MarkBadge state={state} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-emerald-50 px-2 py-2">
                    <p className="text-[10px] font-semibold uppercase text-emerald-700">Present</p>
                    <p className="text-lg font-bold text-emerald-900">{present}</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 px-2 py-2">
                    <p className="text-[10px] font-semibold uppercase text-rose-700">Absent</p>
                    <p className="text-lg font-bold text-rose-900">{absent}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-2 py-2">
                    <p className="text-[10px] font-semibold uppercase text-amber-800">Half/OD</p>
                    <p className="text-lg font-bold text-amber-950">{half}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">
                    Attendance{' '}
                    <span className="text-indigo-700">
                      {state === 'unmarked' ? '—' : `${pct}%`}
                    </span>
                  </p>
                  <span className="text-xs font-semibold text-indigo-700">View Students →</span>
                </div>
              </button>
            );
          })}
          {!filteredRows.length ? (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-500">
              No classes match these filters for {longDate(date)}.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-950',
    emerald: 'bg-emerald-50 text-emerald-950',
    rose: 'bg-rose-50 text-rose-950',
    amber: 'bg-amber-50 text-amber-950',
  };
  return (
    <div className={`rounded-2xl px-3 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function MarkBadge({ state }) {
  if (state === 'marked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 size={12} /> Marked
      </span>
    );
  }
  if (state === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-800 ring-1 ring-inset ring-sky-200">
        <Clock size={12} /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900 ring-1 ring-inset ring-amber-200">
      <AlertTriangle size={12} /> Not Marked
    </span>
  );
}
