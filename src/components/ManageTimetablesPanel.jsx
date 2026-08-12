import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
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
  buildDefaultWeeklyTimetable,
} from '../data/timetableData.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { showToast } from '../services/toast.js';

const SUBJECTS = Object.keys(SUBJECT_STYLES);

const TYPE_CARDS = [
  {
    id: 'regular',
    title: 'Regular Timetable',
    hint: 'Daily period-wise class timetable.',
    icon: CalendarClock,
    active: 'border-sky-500 bg-sky-50',
    iconBg: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'test',
    title: 'Test Timetable',
    hint: 'Unit, Weekly, Monthly and Cycle Tests.',
    icon: ClipboardList,
    active: 'border-amber-500 bg-amber-50',
    iconBg: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'exam',
    title: 'Exam Timetable',
    hint: 'Mid-Term, Quarterly, Half-Yearly, Annual exams.',
    icon: GraduationCap,
    active: 'border-violet-500 bg-violet-50',
    iconBg: 'bg-violet-100 text-violet-800',
  },
];

const CLASS_GROUPS = [
  { id: '1-5', label: 'Classes 1–5' },
  { id: '6-8', label: 'Classes 6–8' },
  { id: '9-12', label: 'Classes 9–12' },
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

function emptyTestRow() {
  return {
    id: newId('TR'),
    date: todayIso(),
    subject: 'Maths',
    startTime: '09:00',
    endTime: '10:00',
    marks: '25',
    room: 'Room 101',
    instructions: '',
  };
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
 * Manage Timetables — Regular / Test / Exam scheduling UI.
 */
export default function ManageTimetablesPanel({
  mode = 'regular',
  sectionOptions = [],
  loadingClasses = false,
}) {
  const initialType =
    mode === 'test-timetable' || mode === 'test'
      ? 'test'
      : mode === 'exam-timetable' || mode === 'exam'
        ? 'exam'
        : 'regular';

  const [type, setType] = useState(initialType);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  const [classKey, setClassKey] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [grid, setGrid] = useState(() => buildDefaultWeeklyTimetable());

  const [testName, setTestName] = useState('Unit Test – 2');
  const [testYear, setTestYear] = useState('2026–2027');
  const [testTerm, setTestTerm] = useState('Term 1');
  const [testClassKeys, setTestClassKeys] = useState([]);
  const [testStart, setTestStart] = useState(() => todayIso());
  const [testEnd, setTestEnd] = useState(() => addDaysIso(todayIso(), 4));
  const [testRows, setTestRows] = useState(() => [
    { ...emptyTestRow(), date: todayIso(), subject: 'Maths' },
    { ...emptyTestRow(), date: addDaysIso(todayIso(), 1), subject: 'English' },
    { ...emptyTestRow(), date: addDaysIso(todayIso(), 2), subject: 'Science' },
  ]);
  const [testPreview, setTestPreview] = useState(false);

  const [examName, setExamName] = useState('Quarterly Examination');
  const [examYear, setExamYear] = useState('2026–2027');
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

  useEffect(() => {
    if (!sectionOptions.length) return;
    setClassKey((prev) => prev || sectionOptions[0].key);
    setTestClassKeys((prev) => (prev.length ? prev : [sectionOptions[0].key]));
    setExamClassKeys((prev) => (prev.length ? prev : [sectionOptions[0].key]));
  }, [sectionOptions]);

  const selectedClass = sectionOptions.find((o) => o.key === classKey);

  const examConflicts = useMemo(() => {
    const warnings = [];
    const byClassDate = new Map();
    const subjectsByClass = new Map();
    const roomsBySlot = new Map();

    for (const row of examRows) {
      const classKeyLabel = row.classLabel || '—';
      const subjKey = `${classKeyLabel}::${row.subject}`;
      if (subjectsByClass.has(subjKey)) {
        warnings.push(`Same subject scheduled twice: ${row.subject} for ${classKeyLabel}`);
      } else {
        subjectsByClass.set(subjKey, true);
      }

      const slotKey = `${classKeyLabel}::${row.date}::${row.startTime}`;
      if (byClassDate.has(slotKey)) {
        warnings.push(
          `Two examinations for ${classKeyLabel} at the same time on ${formatDisplayDate(row.date)}`
        );
      } else {
        byClassDate.set(slotKey, true);
      }

      const roomKey = `${row.room}::${row.date}::${row.startTime}`;
      if (row.room && roomsBySlot.has(roomKey)) {
        warnings.push(`Exam hall already occupied: ${row.room} on ${formatDisplayDate(row.date)}`);
      } else if (row.room) {
        roomsBySlot.set(roomKey, true);
      }
    }
    return [...new Set(warnings)];
  }, [examRows]);

  const testConflicts = useMemo(() => {
    const warnings = [];
    const seen = new Map();
    for (const row of testRows) {
      const key = `${row.date}::${row.subject}`;
      if (seen.has(key)) warnings.push(`Same subject twice on ${formatDisplayDate(row.date)}: ${row.subject}`);
      else seen.set(key, true);
    }
    return warnings;
  }, [testRows]);

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

  const publish = (kind) => {
    const conflicts = kind === 'exam' ? examConflicts : kind === 'test' ? testConflicts : [];
    if (conflicts.length) {
      showToast('Resolve conflict warnings before publishing', 'error');
      return;
    }
    showToast(
      kind === 'exam'
        ? 'Exam timetable published'
        : kind === 'test'
          ? 'Test timetable published'
          : 'Regular timetable saved',
      'success'
    );
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Manage Timetables</h2>
        <p className="mt-1 text-sm text-gray-500">
          Create, update and publish class, test and examination schedules.
        </p>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        {TYPE_CARDS.map((card) => {
          const Icon = card.icon;
          const active = type === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setType(card.id)}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                active ? card.active : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                <Icon size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{card.title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
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
                  <th className="px-3 py-2.5 text-xs font-semibold">Period</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Time</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Subject</th>
                </tr>
              </thead>
              <tbody>
                {PERIOD_TIMES.map((p, pi) => {
                  const cell = grid[pi]?.[selectedDay];
                  const isLunch = pi === 3;
                  return (
                    <tr key={p.period} className="border-t border-gray-100">
                      <td className="px-3 py-2.5 font-semibold text-gray-700">P{p.period}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{p.time}</td>
                      <td className="px-3 py-2.5">
                        {isLunch ? (
                          <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                            Lunch Break
                          </span>
                        ) : (
                          <select
                            value={cell?.subject || 'English'}
                            onChange={(e) => {
                              const nextSub = e.target.value;
                              setGrid((prev) => {
                                const copy = prev.map((row) => row.map((c) => ({ ...c })));
                                copy[pi][selectedDay] = {
                                  subject: nextSub,
                                  teacher: cell?.teacher || '',
                                };
                                return copy;
                              });
                            }}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${subjectChipClass(cell?.subject)}`}
                          >
                            {SUBJECTS.map((s) => (
                              <option key={s} value={s}>
                                {s === 'Maths' ? 'Mathematics' : s}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            Editing for <strong>{selectedClass?.label || '—'}</strong> ·{' '}
            {TIMETABLE_DAYS[selectedDay]}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setGrid(buildDefaultWeeklyTimetable())}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => showToast(`Preview · ${selectedClass?.label || 'class'}`, 'info')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800"
            >
              <Eye size={16} /> Preview
            </button>
            <button
              type="button"
              onClick={() => publish('regular')}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Save Timetable
            </button>
          </div>
        </div>
      ) : null}

      {type === 'test' ? (
        <div className="space-y-5">
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Test Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Test Name *">
                <input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="field-input"
                  placeholder="Unit Test – 2"
                />
              </Field>
              <Field label="Academic Year *">
                <input
                  value={testYear}
                  onChange={(e) => setTestYear(e.target.value)}
                  className="field-input"
                />
              </Field>
              <Field label="Term *">
                <select
                  value={testTerm}
                  onChange={(e) => setTestTerm(e.target.value)}
                  className="field-input"
                >
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </Field>
              <Field label="Test Start Date *">
                <input
                  type="date"
                  value={testStart}
                  onChange={(e) => setTestStart(e.target.value)}
                  className="field-input"
                />
              </Field>
              <Field label="Test End Date *">
                <input
                  type="date"
                  value={testEnd}
                  onChange={(e) => setTestEnd(e.target.value)}
                  className="field-input"
                />
              </Field>
            </div>
            <Field label="Class / Section * (select one or more)" className="mt-3">
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-gray-200 p-2">
                {sectionOptions.map((o) => {
                  const on = testClassKeys.includes(o.key);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => toggleKey(testClassKeys, o.key, setTestClassKeys)}
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900">Test Schedule</h3>
              <button
                type="button"
                onClick={() => setTestRows((r) => [...r, emptyTestRow()])}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700"
              >
                <Plus size={14} /> Add Test
              </button>
            </div>

            <div className="space-y-3">
              {testRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 sm:p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">
                      {formatDisplayDate(row.date)} · {dayName(row.date)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setTestRows((rows) => rows.filter((r) => r.id !== row.id))}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        setTestRows((rows) =>
                          rows.map((r) => (r.id === row.id ? { ...r, date: e.target.value } : r))
                        )
                      }
                      className="field-input"
                    />
                    <select
                      value={row.subject}
                      onChange={(e) =>
                        setTestRows((rows) =>
                          rows.map((r) =>
                            r.id === row.id ? { ...r, subject: e.target.value } : r
                          )
                        )
                      }
                      className={`field-input font-semibold ${subjectChipClass(row.subject)}`}
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s === 'Maths' ? 'Mathematics' : s}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={row.startTime}
                      onChange={(e) =>
                        setTestRows((rows) =>
                          rows.map((r) =>
                            r.id === row.id ? { ...r, startTime: e.target.value } : r
                          )
                        )
                      }
                      className="field-input"
                    />
                    <input
                      type="time"
                      value={row.endTime}
                      onChange={(e) =>
                        setTestRows((rows) =>
                          rows.map((r) =>
                            r.id === row.id ? { ...r, endTime: e.target.value } : r
                          )
                        )
                      }
                      className="field-input"
                    />
                    <input
                      value={row.marks}
                      onChange={(e) =>
                        setTestRows((rows) =>
                          rows.map((r) => (r.id === row.id ? { ...r, marks: e.target.value } : r))
                        )
                      }
                      placeholder="Total Marks"
                      className="field-input"
                    />
                    <select
                      value={row.room}
                      onChange={(e) =>
                        setTestRows((rows) =>
                          rows.map((r) => (r.id === row.id ? { ...r, room: e.target.value } : r))
                        )
                      }
                      className="field-input"
                    >
                      {ROOMS.map((room) => (
                        <option key={room}>{room}</option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    <span className={`mr-2 rounded-md border px-2 py-0.5 font-semibold ${subjectChipClass(row.subject)}`}>
                      {row.subject === 'Maths' ? 'Mathematics' : row.subject}
                    </span>
                    {row.startTime} – {row.endTime}
                    {durationMinutes(row.startTime, row.endTime)
                      ? ` · ${durationMinutes(row.startTime, row.endTime)}`
                      : ''}
                    {row.marks ? ` · ${row.marks} Marks` : ''}
                  </p>
                </div>
              ))}
            </div>

            {testConflicts.length > 0 ? (
              <ConflictBox items={testConflicts} />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setTestRows((rows) => [
                  ...rows,
                  ...rows.map((r) => ({ ...r, id: newId('TR'), date: addDaysIso(r.date, 7) })),
                ])
              }
              className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700"
            >
              <Copy size={14} /> Duplicate Schedule
            </button>
            <button
              type="button"
              onClick={() => setTestPreview(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-800"
            >
              <Eye size={14} /> Preview
            </button>
            <button
              type="button"
              onClick={() => showToast('Test timetable draft saved', 'info')}
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => publish('test')}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Publish Test Timetable
            </button>
          </div>

          {testPreview ? (
            <PreviewCard
              title={testName}
              subtitle={sectionOptions
                .filter((o) => testClassKeys.includes(o.key))
                .map((o) => o.label)
                .join(', ')}
              rows={testRows.map((r) => ({
                date: r.date,
                subject: r.subject,
                start: r.startTime,
                end: r.endTime,
              }))}
              onClose={() => setTestPreview(false)}
            />
          ) : null}
        </div>
      ) : null}

      {type === 'exam' ? (
        <div className="space-y-5">
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Examination Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Exam Name *">
                <select
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="field-input"
                >
                  <option>Quarterly Examination</option>
                  <option>Half-Yearly Examination</option>
                  <option>Annual Examination</option>
                  <option>Final Examination</option>
                  <option>Model Examination</option>
                  <option>Mid-Term Examination</option>
                </select>
              </Field>
              <Field label="Academic Year *">
                <input
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                  className="field-input"
                />
              </Field>
              <Field label="Term / Semester">
                <select
                  value={examTerm}
                  onChange={(e) => setExamTerm(e.target.value)}
                  className="field-input"
                >
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Semester 1</option>
                  <option>Semester 2</option>
                </select>
              </Field>
              <Field label="Class Group (optional)">
                <select
                  value={examGroup}
                  onChange={(e) => setExamGroup(e.target.value)}
                  className="field-input"
                >
                  <option value="">— Individual / multi select below —</option>
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
            <h3 className="mb-2 text-sm font-bold text-gray-900">Exam Session</h3>
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
                      {s.start} – {s.end}
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
              <h3 className="text-sm font-bold text-gray-900">Examination Schedule</h3>
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
                <Plus size={14} /> Add Exam
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
                        {durationMinutes(row.startTime, row.endTime) || '—'}
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
              onClick={() => showToast('Exam timetable draft saved', 'info')}
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
              Publish
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
              {r.start} – {r.end}
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
