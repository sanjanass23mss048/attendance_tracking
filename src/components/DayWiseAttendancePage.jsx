import { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { ATTENDANCE_STATUS, DAYWISE_PERIOD_COUNT, STATUS_CYCLE } from '../data/mockData';
import {
  formatAttendanceDate,
  getStatusDisplay,
  getTodayAttendanceDate,
} from '../utils/attendance';
import { getClasses, resolveSectionId } from '../services/classService.js';
import { getStudents, normalizeStudent } from '../services/studentService.js';
import {
  createPresentPeriodSheet,
  getPeriodAttendance,
  marksFromPeriodSheet,
  savePeriodAttendance,
  sheetFromPeriodMarks,
} from '../services/attendanceService.js';
import { useMock } from '../services/api.js';
import { onAttendanceUpdated } from '../services/socketService.js';
import { networkErrorMessage, showToast } from '../services/toast.js';
import { SCHOOL_GRADES, SCHOOL_SECTIONS, formatClassLabel } from '../data/schoolGrades.js';

/** empty → P → A → L → H → OH → OF → empty */
const CELL_CYCLE = [...STATUS_CYCLE, ''];

function createEmptySheet() {
  return {};
}

function sheetsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function nextStatus(current) {
  const raw = current === 'O' ? 'OF' : current;
  const idx = CELL_CYCLE.indexOf(raw || '');
  if (idx === -1) return 'P';
  return CELL_CYCLE[(idx + 1) % CELL_CYCLE.length];
}

function countSheetCells(sheet) {
  const counts = { P: 0, A: 0, L: 0, H: 0, OH: 0, OF: 0, marked: 0 };
  Object.values(sheet).forEach((byPeriod) => {
    Object.values(byPeriod || {}).forEach((status) => {
      const code = status === 'O' ? 'OF' : status;
      if (ATTENDANCE_STATUS[code]) {
        counts[code] += 1;
        counts.marked += 1;
      }
    });
  });
  return counts;
}

function cellClasses(status) {
  const code = status === 'O' ? 'OF' : status;
  if (!code || !ATTENDANCE_STATUS[code]) {
    return 'border-gray-300 bg-white text-transparent hover:border-indigo-300 hover:bg-gray-50';
  }
  const map = {
    P: 'border-green-600 bg-green-500 text-white hover:bg-green-600',
    A: 'border-red-600 bg-red-500 text-white hover:bg-red-600',
    L: 'border-amber-500 bg-amber-400 text-white hover:bg-amber-500',
    H: 'border-violet-600 bg-violet-500 text-white hover:bg-violet-600',
    OH: 'border-cyan-600 bg-cyan-500 text-white hover:bg-cyan-600',
    OF: 'border-teal-800 bg-teal-700 text-white hover:bg-teal-800',
  };
  return map[code];
}

export default function DayWiseAttendancePage() {
  const [classOptions, setClassOptions] = useState(SCHOOL_GRADES);
  const [sectionOptions, setSectionOptions] = useState(SCHOOL_SECTIONS);
  const [classesData, setClassesData] = useState([]);
  const [selectedClass, setSelectedClass] = useState('1');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedDate, setSelectedDate] = useState(() => getTodayAttendanceDate());
  const [sectionId, setSectionId] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [periodCount, setPeriodCount] = useState(DAYWISE_PERIOD_COUNT);
  const [sheet, setSheet] = useState(createEmptySheet);
  const [savedSheet, setSavedSheet] = useState(createEmptySheet);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const reloadRef = useRef(null);

  const periodIds = useMemo(
    () => Array.from({ length: periodCount }, (_, i) => String(i + 1)),
    [periodCount]
  );

  useEffect(() => {
    getClasses()
      .then((data) => {
        const list = data.classes || [];
        setClassesData(list);
        setClassOptions(list.map((c) => c.name));
        if (list[0]) {
          setSelectedClass(list[0].name);
          const secs = list[0].sections || [];
          setSectionOptions(secs.map((s) => s.name));
          setSelectedSection(secs[0]?.name || 'A');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const klass = classesData.find((c) => String(c.name) === String(selectedClass));
    const secs = (klass?.sections || []).map((s) => s.name);
    if (secs.length) {
      setSectionOptions(secs);
      if (!secs.includes(selectedSection)) {
        setSelectedSection(secs[0]);
      }
    }
  }, [selectedClass, classesData]);

  const classLabel = `Class ${selectedClass} - ${selectedSection}`;
  const dateLabel = formatAttendanceDate(selectedDate);
  const counts = useMemo(() => countSheetCells(sheet), [sheet]);
  const isDirty = !sheetsEqual(sheet, savedSheet);
  const totalCells = students.length * periodCount;

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  const handleLoadStudents = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const sid = await resolveSectionId(selectedClass, selectedSection);
      if (!sid) throw new Error('Section not found');

      const [roster, periods] = await Promise.all([
        getStudents({ sectionId: sid }),
        getPeriodAttendance({ sectionId: sid, date: selectedDate }),
      ]);

      const list = (roster.students || []).map(normalizeStudent);
      const nextPeriodCount =
        periods.periodCount || roster.section?.periodCount || DAYWISE_PERIOD_COUNT;
      const savedMarks = periods.marks || [];
      // Empty day: default every student × period to Present; otherwise keep API marks.
      const nextSheet =
        savedMarks.length === 0
          ? createPresentPeriodSheet(list, nextPeriodCount)
          : sheetFromPeriodMarks(savedMarks);
      setSectionId(sid);
      setStudents(list);
      setPeriodCount(nextPeriodCount);
      setSheet(nextSheet);
      setSavedSheet(JSON.parse(JSON.stringify(nextSheet)));
      setStudentsLoaded(true);
      setLocked(false);
      if (silent) showToast('Day sheet refreshed (live update)', 'info');
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Failed to load day-wise attendance', 'error');
      if (!silent) {
        setStudentsLoaded(false);
        setStudents([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  reloadRef.current = handleLoadStudents;

  useEffect(() => {
    if (useMock()) return undefined;
    return onAttendanceUpdated((payload) => {
      if (payload?.type !== 'periods') return;
      if (payload.sectionId !== sectionId || payload.date !== selectedDate) return;
      if (savingRef.current) return;
      if (dirtyRef.current) {
        showToast('Period attendance updated elsewhere — save or reload to sync', 'info');
        return;
      }
      if (studentsLoaded && reloadRef.current) {
        reloadRef.current({ silent: true });
      }
    });
  }, [sectionId, selectedDate, studentsLoaded]);

  const handleCycleCell = (studentId, periodId) => {
    if (locked || !studentsLoaded) return;
    setSheet((prev) => {
      const studentMarks = { ...(prev[studentId] || {}) };
      const next = nextStatus(studentMarks[periodId]);
      if (next) {
        studentMarks[periodId] = next;
      } else {
        delete studentMarks[periodId];
      }
      if (Object.keys(studentMarks).length === 0) {
        const { [studentId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [studentId]: studentMarks };
    });
  };

  const handleMarkAllPresent = () => {
    if (locked || !studentsLoaded) return;
    setSheet(createPresentPeriodSheet(students, periodCount));
  };

  const handleSave = async () => {
    if (!sectionId) {
      showToast('Load students first.', 'error');
      return;
    }
    if (saving) return;
    const marks = marksFromPeriodSheet(sheet);
    if (marks.length === 0) {
      showToast('Mark at least one period before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      await savePeriodAttendance({
        sectionId,
        date: selectedDate,
        marks,
      });
      setSavedSheet(JSON.parse(JSON.stringify(sheet)));
      setLocked(true);
      showToast(`Day sheet saved for ${classLabel} on ${dateLabel}.`, 'success');
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Failed to save day sheet', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = () => {
    setLocked(false);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {formatClassLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 sm:min-w-[11.5rem]">
              <label className="mb-1 block text-xs text-gray-500">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-input w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={() => handleLoadStudents()}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load Students'}
            </button>
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={!studentsLoaded || locked}
              className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark all Present
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => (
              <span key={key} className="flex items-center gap-1 text-xs text-gray-500">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-0.5 text-[10px] font-bold text-white ${val.color}`}
                >
                  {key}
                </span>
                {val.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-sky-100 bg-sky-50 px-5 py-2.5">
          <Info size={16} className="shrink-0 text-sky-600" />
          <p className="text-sm text-sky-800">
            Tap a period box to cycle <strong>empty → P → A → L → H → OH → OF → empty</strong>.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-gray-100 px-5 py-3">
          {[
            { key: 'P', label: 'Present', color: 'text-green-600 bg-green-50 border-green-200' },
            { key: 'A', label: 'Absent', color: 'text-red-600 bg-red-50 border-red-200' },
            { key: 'L', label: 'Late', color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { key: 'H', label: 'Half Day', color: 'text-violet-600 bg-violet-50 border-violet-200' },
            { key: 'OH', label: 'OD Half', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
            { key: 'OF', label: 'OD Full', color: 'text-teal-700 bg-teal-50 border-teal-200' },
          ].map((item) => (
            <div key={item.key} className={`rounded-lg border px-3 py-2 text-xs ${item.color}`}>
              <span className="font-bold">{counts[item.key]}</span>{' '}
              <span className="opacity-80">{item.label}</span>
            </div>
          ))}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span className="font-bold text-gray-900">{counts.marked}</span> / {totalCells} cells
            marked · {classLabel} · {dateLabel}
          </div>
        </div>

        {!studentsLoaded ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">
            Select class, section, and date, then click Load Students.
          </div>
        ) : (
          <div className="px-4 py-3 sm:px-5">
            <div className="mb-2 flex items-center gap-3 px-1">
              <div className="w-[168px] shrink-0 sm:w-[200px]" aria-hidden="true" />
              <div
                className="grid flex-1 gap-1.5"
                style={{ gridTemplateColumns: `repeat(${periodCount}, minmax(0, 1fr))` }}
              >
                {periodIds.map((pid) => (
                  <div key={pid} className="text-center text-xs font-semibold text-gray-500">
                    {pid}
                  </div>
                ))}
              </div>
            </div>

            <ul className="divide-y divide-gray-100">
              {students.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1"
                >
                  <div className="flex w-[168px] shrink-0 items-center gap-2.5 sm:w-[200px]">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700"
                      aria-label={`Roll ${student.roll}`}
                    >
                      {student.roll}
                    </span>
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {student.name}
                    </span>
                  </div>

                  <div
                    className="grid flex-1 gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${periodCount}, minmax(0, 1fr))` }}
                  >
                    {periodIds.map((pid) => {
                      const raw = sheet[student.id]?.[pid] || '';
                      const status = raw === 'O' ? 'OF' : raw;
                      const display = getStatusDisplay(status);
                      return (
                        <button
                          key={pid}
                          type="button"
                          disabled={locked}
                          onClick={() => handleCycleCell(student.id, pid)}
                          title={
                            status
                              ? `${display.label} — click to change`
                              : `Period ${pid} — unmarked`
                          }
                          aria-label={`${student.name} period ${pid}: ${status ? display.label : 'unmarked'}`}
                          className={`mx-auto flex aspect-square max-h-9 w-full max-w-9 items-center justify-center rounded-md border-2 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:max-h-10 sm:max-w-10 sm:text-xs ${cellClasses(status)}`}
                        >
                          {status || ''}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white/95 px-5 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>
              <strong className="font-semibold text-gray-800">{students.length}</strong> Students
            </span>
            <span className="hidden h-3 w-px bg-gray-200 sm:block" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-gray-800">{periodCount}</strong> Periods
            </span>
            {locked ? (
              <>
                <span className="hidden h-3 w-px bg-gray-200 sm:block" aria-hidden="true" />
                <span className="font-medium text-green-600">✓ Day sheet saved</span>
              </>
            ) : (
              isDirty && (
                <>
                  <span className="hidden h-3 w-px bg-gray-200 sm:block" aria-hidden="true" />
                  <span className="font-medium text-amber-600">Unsaved changes</span>
                </>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {locked ? (
              <button
                type="button"
                onClick={handleUnlock}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                Edit Again
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={!studentsLoaded || saving}
                className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-gray-900 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Day Sheet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
