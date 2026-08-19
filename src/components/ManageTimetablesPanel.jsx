import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  TIMETABLE_DAYS,
  PERIOD_TIMES,
  SUBJECT_STYLES,
  DEFAULT_TEACHERS,
  buildDefaultWeeklyTimetable,
  buildEmptyWeeklyTimetable,
  normalizeWeeklyGrid,
  isBreakSlot,
  slotRowKey,
} from '../data/timetableData.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { getTeachers } from '../services/teacherService.js';
import { getTimetable, saveTimetable } from '../services/timetableService.js';
import { networkErrorMessage, showToast } from '../services/toast.js';

const SUBJECTS = Object.keys(SUBJECT_STYLES);
const DEFAULT_TEACHER_NAMES = DEFAULT_TEACHERS.map((t) => t.name);

function teacherForSubject(subject) {
  return DEFAULT_TEACHERS.find((t) => t.subject === subject)?.name || '';
}

/** Matches parent portal: Class timetable + Exam (tests included under Exam). */
const TYPE_CARDS = [
  {
    id: 'regular',
    title: 'Regular Timetable',
    hint: 'Daily period-wise class timetable.',
    icon: CalendarClock,
    active: 'border-sky-500 bg-sky-50 ring-1 ring-sky-200',
    iconBg: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'exam',
    title: 'Exam Timetable',
    hint: 'Unit / Weekly / Monthly tests and Mid-Term, Quarterly, Annual exams.',
    icon: GraduationCap,
    active: 'border-violet-500 bg-violet-50 ring-1 ring-violet-200',
    iconBg: 'bg-violet-100 text-violet-700',
  },
];

const EXAM_OR_TEST_NAMES = [
  'Unit Test - 1',
  'Unit Test - 2',
  'Weekly Test',
  'Monthly Test',
  'Cycle Test',
  'Mid-Term Examination',
  'Quarterly Examination',
  'Half-Yearly Examination',
  'Annual Examination',
  'Final Examination',
  'Model Examination',
];

const CLASS_GROUPS = [
  { id: '1-5', label: 'Classes 1-5' },
  { id: '6-8', label: 'Classes 6-8' },
  { id: '9-12', label: 'Classes 9-12' },
];

const EXAM_SESSIONS = [
  { id: 'morning', label: 'Morning Session', start: '09:30', end: '12:00' },
  { id: 'afternoon', label: 'Afternoon Session', start: '13:30', end: '16:00' },
  { id: 'custom', label: 'Custom Time', start: '', end: '' },
];

const ROOMS = ['Room 101', 'Room 102', 'Main Hall', 'Computer Lab', 'Room 201'];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayName(iso) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  } catch {
    return '';
  }
}

function formatDisplayDate(iso) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function durationMinutes(start, end) {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (!Number.isFinite(mins) || mins <= 0) return '';
  if (mins < 60) return `${mins} Minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyExamRow(classLabel = '') {
  return {
    id: newId('ER'),
    date: todayIso(),
    classLabel,
    subject: 'English',
    startTime: '09:30',
    endTime: '12:00',
    marks: '100',
    room: 'Main Hall',
  };
}

function subjectChipClass(subject) {
  return SUBJECT_STYLES[subject] || 'bg-gray-50 text-gray-800 border-gray-200';
}

/**
 * Manage Timetables - Regular (class) + Exam/Test schedules.
 * Tests are created under Exam Timetable (same as parent portal).
 */
export default function ManageTimetablesPanel({
  mode = 'regular',
  sectionOptions = [],
  loadingClasses = false,
}) {
  const initialType =
    mode === 'exam-timetable' ||
    mode === 'exam' ||
    mode === 'test-timetable' ||
    mode === 'test'
      ? 'exam'
      : 'regular';

  const [type, setType] = useState(initialType);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  const [classKey, setClassKey] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [grid, setGrid] = useState(() => buildDefaultWeeklyTimetable());
  const [staffTeachers, setStaffTeachers] = useState(DEFAULT_TEACHER_NAMES);

  const [examName, setExamName] = useState('Quarterly Examination');
  const [examYear, setExamYear] = useState('2026-2027');
  const [examTerm, setExamTerm] = useState('Term 1');
  const [examClassKeys, setExamClassKeys] = useState([]);
  const [examGroup, setExamGroup] = useState('');
  const [examStart, setExamStart] = useState(() => todayIso());
  const [examEnd, setExamEnd] = useState(() => addDaysIso(todayIso(), 14));
  const [examSession, setExamSession] = useState('morning');
  const [examHall, setExamHall] = useState('Main Hall');
  const [examInstructions, setExamInstructions] = useState(
    'Students must report 15 minutes before the examination.\nHall ticket is mandatory.\nElectronic devices are not permitted.'
  );
  const [examRows, setExamRows] = useState(() => [
    { ...emptyExamRow('6-A'), date: todayIso(), subject: 'English' },
    { ...emptyExamRow('6-A'), date: addDaysIso(todayIso(), 2), subject: 'Maths' },
    { ...emptyExamRow('6-A'), date: addDaysIso(todayIso(), 4), subject: 'Science' },
  ]);
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [notifyParents, setNotifyParents] = useState(true);
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [sendPush, setSendPush] = useState(false);
  const [examPreview, setExamPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedSection = sectionOptions.find((o) => o.key === classKey);
  const classSectionId = selectedSection?.sectionId || '';

  useEffect(() => {
    if (!sectionOptions.length) return;
    setClassKey((prev) => prev || sectionOptions[0].key);
    setExamClassKeys((prev) => (prev.length ? prev : [sectionOptions[0].key]));
  }, [sectionOptions]);

  useEffect(() => {
    if (!classSectionId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await getTimetable(classSectionId);
        if (!cancelled) setGrid(normalizeWeeklyGrid(data.grid));
      } catch (err) {
        if (!cancelled) {
          showToast(networkErrorMessage(err) || 'Could not load timetable', 'error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classSectionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTeachers({ staffType: 'teaching' });
        const names = (data.teachers || [])
          .map((t) => t.name)
          .filter(Boolean);
        if (!cancelled && names.length) {
          setStaffTeachers([...new Set([...DEFAULT_TEACHER_NAMES, ...names])]);
        }
      } catch {
        /* keep default teacher list */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teacherOptions = useMemo(() => {
    const fromGrid = grid.flat().map((c) => c?.teacher).filter(Boolean);
    return [...new Set([...staffTeachers, ...fromGrid])];
  }, [grid, staffTeachers]);

  const updateCell = (periodIndex, patch) => {
    setGrid((prev) => {
      const copy = prev.map((row) => row.map((c) => (c ? { ...c } : c)));
      copy[periodIndex][selectedDay] = {
        ...(copy[periodIndex][selectedDay] || { subject: '', teacher: '' }),
        ...patch,
      };
      return copy;
    });
  };

  const examConflicts = useMemo(() => {
    const warnings = [];
    const byClassDate = new Map();
    const subjectsByClass = new Map();
    const roomsBySlot = new Map();

    for (const row of examRows) {
      const classKeyLabel = row.classLabel || '-';
      const subjKey = `${classKeyLabel}::${row.subject}`;
      if (subjectsByClass.has(subjKey)) {
        warnings.push(`Same subject scheduled twice: ${row.subject} for ${classKeyLabel}`);
      } else {
        subjectsByClass.set(subjKey, true);
      }

      const slotKey = `${classKeyLabel}::${row.date}::${row.startTime}`;
      if (byClassDate.has(slotKey)) {
        warnings.push(
          `Two papers for ${classKeyLabel} at the same time on ${formatDisplayDate(row.date)}`
        );
      } else {
        byClassDate.set(slotKey, true);
      }

      const roomKey = `${row.room}::${row.date}::${row.startTime}`;
      if (row.room && roomsBySlot.has(roomKey)) {
        warnings.push(`Hall already occupied: ${row.room} on ${formatDisplayDate(row.date)}`);
      } else if (row.room) {
        roomsBySlot.set(roomKey, true);
      }
    }
    return [...new Set(warnings)];
  }, [examRows]);

  const toggleKey = (list, key, setter) => {
    setter(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const applySession = (sessionId) => {
    setExamSession(sessionId);
    const sess = EXAM_SESSIONS.find((s) => s.id === sessionId);
    if (!sess || sessionId === 'custom') return;
    setExamRows((rows) =>
      rows.map((r) => ({ ...r, startTime: sess.start, endTime: sess.end }))
    );
  };

  const publish = async (kind) => {
    if (kind === 'exam' && examConflicts.length) {
      showToast('Resolve conflict warnings before publishing', 'error');
      return;
    }
    if (kind === 'exam') {
      showToast('Exam / test timetable published', 'success');
      return;
    }
    if (!classSectionId) {
      showToast('Select a class to save the timetable', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await saveTimetable(classSectionId, grid, {
        className: selectedSection?.className,
        sectionName: selectedSection?.sectionName,
      });
      setGrid(normalizeWeeklyGrid(data.grid));
      showToast('Regular timetable saved', 'success');
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Could not save timetable', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isTestName = /test/i.test(examName);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Manage Timetables</h2>
        <p className="mt-1 text-sm text-gray-500">
          Class timetable and exam / test schedules - same options parents see.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {TYPE_CARDS.map((card) => {
          const Icon = card.icon;
          const active = type === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setType(card.id)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
                active ? card.active : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                <Icon size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900">{card.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                  {card.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {type === 'regular' ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Select Class / Section
            </label>
            <select
              value={classKey}
              onChange={(e) => setClassKey(e.target.value)}
              disabled={loadingClasses}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {sectionOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-500">Select Day</label>
            <div className="flex flex-wrap gap-1.5">
              {TIMETABLE_DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(i)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    selectedDay === i
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-indigo-50 text-indigo-900">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-semibold">Time</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Subject</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Teacher</th>
                </tr>
              </thead>
              <tbody>
                {PERIOD_TIMES.map((slot, pi) => {
                  const cell = grid[pi]?.[selectedDay];
                  const isBreak = isBreakSlot(slot);
                  return (
                    <tr key={slotRowKey(slot, pi)} className="border-t border-gray-100">
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{slot.time}</td>
                      <td className="px-3 py-2.5">
                        {isBreak ? (
                          <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                            {slot.label}
                          </span>
                        ) : (
                          <select
                            value={cell?.subject || ''}
                            onChange={(e) => {
                              const nextSub = e.target.value;
                              updateCell(pi, {
                                subject: nextSub,
                                teacher: nextSub
                                  ? teacherForSubject(nextSub) || cell?.teacher || ''
                                  : '',
                              });
                            }}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                              cell?.subject
                                ? subjectChipClass(cell.subject)
                                : 'border-gray-200 bg-white text-gray-500'
                            }`}
                          >
                            <option value="">Select subject</option>
                            {SUBJECTS.map((s) => (
                              <option key={s} value={s}>
                                {s === 'Maths' ? 'Mathematics' : s}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isBreak ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <select
                            value={cell?.teacher || ''}
                            onChange={(e) => updateCell(pi, { teacher: e.target.value })}
                            className="w-full min-w-[9rem] rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-800 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="">Select teacher</option>
                            {teacherOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                            {cell?.teacher && !teacherOptions.includes(cell.teacher) ? (
                              <option value={cell.teacher}>{cell.teacher}</option>
                            ) : null}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setGrid(buildEmptyWeeklyTimetable());
                showToast('Timetable cleared', 'info');
              }}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => publish('regular')}
              disabled={saving || !classSectionId}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Timetable'}
            </button>
          </div>
        </div>
      ) : null}

      {type === 'exam' ? (
        <div className="space-y-5">
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {isTestName ? 'Test Details' : 'Examination Details'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name *">
                <select
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="field-input"
                >
                  <optgroup label="Tests">
                    {EXAM_OR_TEST_NAMES.filter((n) => /test/i.test(n)).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Examinations">
                    {EXAM_OR_TEST_NAMES.filter((n) => !/test/i.test(n)).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              <Field label="Academic Year *">
                <input
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                  className="field-input"
                />
              </Field>
              <Field label="Term">
                <select
                  value={examTerm}
                  onChange={(e) => setExamTerm(e.target.value)}
                  className="field-input"
                >
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </Field>
              <Field label="Class Group (optional)">
                <select
                  value={examGroup}
                  onChange={(e) => setExamGroup(e.target.value)}
                  className="field-input"
                >
                  <option value="">- Individual / multi select below -</option>
                  {CLASS_GROUPS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start Date">
                <input
                  type="date"
                  value={examStart}
                  onChange={(e) => setExamStart(e.target.value)}
                  className="field-input"
                />
              </Field>
              <Field label="End Date">
                <input
                  type="date"
                  value={examEnd}
                  onChange={(e) => setExamEnd(e.target.value)}
                  className="field-input"
                />
              </Field>
            </div>

            <Field label="Classes *" className="mt-3">
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-gray-200 p-2">
                {sectionOptions.map((o) => {
                  const on = examClassKeys.includes(o.key);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => toggleKey(examClassKeys, o.key, setExamClassKeys)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        on
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-900">
              {isTestName ? 'Test Session' : 'Exam Session'}
            </h3>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              {EXAM_SESSIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applySession(s.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    examSession === s.id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-semibold text-gray-900">{s.label}</span>
                  {s.start ? (
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {s.start} - {s.end}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <Field label="Exam Hall / Room">
              <select
                value={examHall}
                onChange={(e) => setExamHall(e.target.value)}
                className="field-input"
              >
                {ROOMS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                {isTestName ? 'Test Schedule' : 'Examination Schedule'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  const label =
                    sectionOptions.find((o) => examClassKeys.includes(o.key))?.label ||
                    formatClassLabel('6') + '-A';
                  setExamRows((r) => [...r, emptyExamRow(label.replace(/^Class\s+/i, ''))]);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700"
              >
                <Plus size={14} /> {isTestName ? 'Add Test' : 'Add Exam'}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-indigo-50 text-indigo-900">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Date</th>
                    <th className="px-2 py-2 font-semibold">Day</th>
                    <th className="px-2 py-2 font-semibold">Class</th>
                    <th className="px-2 py-2 font-semibold">Subject</th>
                    <th className="px-2 py-2 font-semibold">Start</th>
                    <th className="px-2 py-2 font-semibold">End</th>
                    <th className="px-2 py-2 font-semibold">Duration</th>
                    <th className="px-2 py-2 font-semibold">Marks</th>
                    <th className="px-2 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {examRows.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) =>
                            setExamRows((rows) =>
                              rows.map((r) =>
                                r.id === row.id ? { ...r, date: e.target.value } : r
                              )
                            )
                          }
                          className="w-[8.5rem] rounded border border-gray-200 px-1 py-1"
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-600">
                        {dayName(row.date).slice(0, 3)}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={row.classLabel}
                          onChange={(e) =>
                            setExamRows((rows) =>
                              rows.map((r) =>
                                r.id === row.id ? { ...r, classLabel: e.target.value } : r
                              )
                            )
                          }
                          className="w-16 rounded border border-gray-200 px-1 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={row.subject}
                          onChange={(e) =>
                            setExamRows((rows) =>
                              rows.map((r) =>
                                r.id === row.id ? { ...r, subject: e.target.value } : r
                              )
                            )
                          }
                          className={`rounded border px-1 py-1 font-semibold ${subjectChipClass(row.subject)}`}
                        >
                          {SUBJECTS.map((s) => (
                            <option key={s} value={s}>
                              {s === 'Maths' ? 'Mathematics' : s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) =>
                            setExamRows((rows) =>
                              rows.map((r) =>
                                r.id === row.id ? { ...r, startTime: e.target.value } : r
                              )
                            )
                          }
                          className="rounded border border-gray-200 px-1 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) =>
                            setExamRows((rows) =>
                              rows.map((r) =>
                                r.id === row.id ? { ...r, endTime: e.target.value } : r
                              )
                            )
                          }
                          className="rounded border border-gray-200 px-1 py-1"
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-600">
                        {durationMinutes(row.startTime, row.endTime) || '-'}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={row.marks}
                          onChange={(e) =>
                            setExamRows((rows) =>
                              rows.map((r) =>
                                r.id === row.id ? { ...r, marks: e.target.value } : r
                              )
                            )
                          }
                          className="w-12 rounded border border-gray-200 px-1 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            title="Duplicate"
                            onClick={() =>
                              setExamRows((rows) => [
                                ...rows,
                                { ...row, id: newId('ER'), date: addDaysIso(row.date, 1) },
                              ])
                            }
                            className="rounded p-1 text-indigo-600 hover:bg-indigo-50"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() =>
                              setExamRows((rows) => rows.filter((r) => r.id !== row.id))
                            }
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                          </button>
                          <span className="rounded p-1 text-gray-400" title="Edit inline">
                            <Pencil size={14} />
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {examConflicts.length > 0 ? <ConflictBox items={examConflicts} /> : null}
          </div>

          <Field label="Exam Instructions">
            <textarea
              value={examInstructions}
              onChange={(e) => setExamInstructions(e.target.value)}
              rows={3}
              className="field-input"
            />
          </Field>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              When published
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Check label="Notify Students" checked={notifyStudents} onChange={setNotifyStudents} />
              <Check label="Notify Parents" checked={notifyParents} onChange={setNotifyParents} />
              <Check
                label="Add to Academic Calendar"
                checked={addToCalendar}
                onChange={setAddToCalendar}
              />
              <Check label="Send Push Notification" checked={sendPush} onChange={setSendPush} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => showToast('Exam / test timetable draft saved', 'info')}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => setExamPreview(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800"
            >
              <Eye size={16} /> Preview Timetable
            </button>
            <button
              type="button"
              onClick={() => publish('exam')}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Publish {isTestName ? 'Test' : 'Exam'} Timetable
            </button>
          </div>

          {examPreview ? (
            <PreviewCard
              title={examName}
              subtitle={
                examGroup
                  ? CLASS_GROUPS.find((g) => g.id === examGroup)?.label
                  : sectionOptions
                      .filter((o) => examClassKeys.includes(o.key))
                      .map((o) => o.label)
                      .join(', ')
              }
              rows={examRows.map((r) => ({
                date: r.date,
                subject: r.subject,
                start: r.startTime,
                end: r.endTime,
                extra: r.classLabel,
              }))}
              onClose={() => setExamPreview(false)}
            />
          ) : null}
        </div>
      ) : null}

      <style>{`
        .field-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e5e7eb;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
        .field-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 1px #6366f1;
        }
      `}</style>
    </section>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      {label}
    </label>
  );
}

function ConflictBox({ items }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-amber-900">
        <AlertTriangle size={14} /> Conflict warnings
      </p>
      <ul className="list-inside list-disc text-xs text-amber-800">
        {items.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewCard({ title, subtitle, rows, onClose }) {
  return (
    <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
            Published Timetable Preview
          </p>
          <h4 className="text-base font-bold text-gray-900">{title}</h4>
          {subtitle ? <p className="text-sm text-gray-600">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-indigo-700">
          Close
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={`${r.date}-${r.subject}-${r.start}`}
            className="rounded-xl border border-white bg-white px-3 py-2.5 shadow-sm"
          >
            <p className="text-xs font-bold uppercase text-gray-500">
              {formatDisplayDate(r.date)} · {dayName(r.date).slice(0, 3)}
              {r.extra ? ` · ${r.extra}` : ''}
            </p>
            <p className="font-bold text-gray-900">
              {r.subject === 'Maths' ? 'Mathematics' : r.subject}
            </p>
            <p className="text-sm text-gray-600">
              {r.start} - {r.end}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => showToast('PDF download coming soon', 'info')}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold"
        >
          <Download size={14} /> Download PDF
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold"
        >
          <FileSpreadsheet size={14} /> Print
        </button>
        <button
          type="button"
          onClick={() => showToast('Share link copied', 'success')}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold"
        >
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
  );
}
