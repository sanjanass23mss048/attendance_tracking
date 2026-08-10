import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calculator,
  CalendarPlus,
  Download,
  FlaskConical,
  Globe,
  Languages,
  Leaf,
  Library,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  Pencil,
  Plus,
  Sun,
  Trophy,
  Upload,
} from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import {
  buildDefaultWeeklyTimetable,
  DEFAULT_TEACHERS,
  PERIOD_TIMES,
  SUBJECT_STYLES,
  TIMETABLE_DAYS,
} from '../data/timetableData.js';
import { exportTablePdfReport } from '../services/reportService.js';
import TimetableAddPeriodModal from './TimetableAddPeriodModal.jsx';
import TimetableEditCellModal from './TimetableEditCellModal.jsx';

const TABS = ['Sections', 'Class Strength', 'Teachers Assigned', 'Timetable'];

const SUBJECT_ICONS = {
  English: BookOpen,
  Maths: Calculator,
  EVS: Leaf,
  Hindi: Languages,
  Computer: Monitor,
  Drawing: Palette,
  Games: Trophy,
  Library: Library,
  Science: FlaskConical,
  Social: Globe,
};

function subjectClass(subject) {
  return SUBJECT_STYLES[subject] || 'bg-gray-100 text-gray-800 border-gray-200';
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function TimetableGrid({ periods, grid, editMode = false, onCellClick }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-indigo-950 text-white">
            <th className="sticky left-0 z-10 min-w-[110px] bg-indigo-950 px-3 py-3 text-left font-semibold">
              <div>Day</div>
              <div className="text-[10px] font-normal text-indigo-300">Period / Time</div>
            </th>
            {periods.map((slot) => (
              <th key={slot.period} className="min-w-[120px] px-2 py-3 text-center font-semibold">
                <div className="text-base">{slot.period}</div>
                <div className="mt-0.5 whitespace-nowrap text-[10px] font-normal leading-tight text-indigo-200">
                  {slot.time}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIMETABLE_DAYS.map((day, dayIdx) => (
            <tr key={day} className="border-t border-gray-100">
              <td className="sticky left-0 z-10 bg-white px-3 py-2.5 align-middle">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{day}</span>
                  <Sun size={14} className="text-amber-400" aria-hidden />
                </div>
              </td>
              {periods.map((slot, periodIdx) => {
                const entry = grid[periodIdx]?.[dayIdx];
                const openEditor = () => {
                  if (!editMode || !onCellClick) return;
                  onCellClick({
                    dayIdx,
                    periodIdx,
                    day,
                    period: slot.period,
                    time: slot.time,
                    subject: entry?.subject || '',
                    teacher: entry?.teacher || '',
                  });
                };

                if (!entry) {
                  return (
                    <td key={`${day}-${slot.period}`} className="px-1.5 py-2">
                      <button
                        type="button"
                        disabled={!editMode}
                        onClick={openEditor}
                        className={`w-full rounded-xl border border-dashed border-gray-200 px-2 py-4 text-center text-xs text-gray-400 ${
                          editMode
                            ? 'cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600'
                            : ''
                        }`}
                      >
                        {editMode ? '+ Add' : '—'}
                      </button>
                    </td>
                  );
                }
                const Icon = SUBJECT_ICONS[entry.subject] || BookOpen;
                const CardTag = editMode ? 'button' : 'div';
                return (
                  <td key={`${day}-${slot.period}`} className="px-1.5 py-2 align-top">
                    <CardTag
                      type={editMode ? 'button' : undefined}
                      onClick={editMode ? openEditor : undefined}
                      className={`w-full rounded-xl border px-2.5 py-2.5 text-left ${subjectClass(entry.subject)} ${
                        editMode ? 'cursor-pointer ring-offset-1 hover:ring-2 hover:ring-indigo-400' : ''
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <Icon size={14} className="opacity-80" aria-hidden />
                        <p className="font-semibold leading-tight">{entry.subject}</p>
                      </div>
                      <p className="text-[11px] opacity-80">{entry.teacher}</p>
                    </CardTag>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [activeTab, setActiveTab] = useState('Timetable');
  const [sectionName, setSectionName] = useState('A');
  const [timetableGrid, setTimetableGrid] = useState(() => buildDefaultWeeklyTimetable());
  const [periods, setPeriods] = useState(() => PERIOD_TIMES.slice(0, 7));
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editCell, setEditCell] = useState(null);
  const timetablePanelRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    getClasses()
      .then((data) => {
        const list = data.classes || [];
        setClasses(list);
        if (list.length) {
          setSelectedClassId(list[0].id);
          const firstSec = list[0].sections?.[0]?.name;
          if (firstSec) setSectionName(firstSec);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onChange = () => {
      const el = timetablePanelRef.current;
      setIsFullscreen(Boolean(el && document.fullscreenElement === el));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (activeTab !== 'Timetable' && document.fullscreenElement === timetablePanelRef.current) {
      document.exitFullscreen().catch(() => {});
    }
  }, [activeTab]);

  const toggleFullscreen = useCallback(async () => {
    const el = timetablePanelRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
        await el.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen unavailable:', err);
      alert('Fullscreen is not available in this browser.');
    }
  }, []);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || classes[0],
    [classes, selectedClassId]
  );

  const sections = selectedClass?.sections || [];
  const selectedSection = sections.find((s) => s.name === sectionName) || sections[0];
  const periodCount = selectedSection?.periodCount || 8;

  useEffect(() => {
    const pc = selectedSection?.periodCount || 7;
    setPeriods(PERIOD_TIMES.slice(0, Math.min(pc, PERIOD_TIMES.length)));
  }, [selectedClassId, selectedSection?.id, selectedSection?.periodCount]);

  const nextPeriod = periods.reduce((max, p) => Math.max(max, p.period), 0) + 1;

  const handleEditCellSave = (payload) => {
    setTimetableGrid((prev) => {
      const next = prev.map((row) => [...row]);
      while (next.length <= payload.periodIdx) {
        next.push(Array(TIMETABLE_DAYS.length).fill(null));
      }
      const row = [...(next[payload.periodIdx] || Array(TIMETABLE_DAYS.length).fill(null))];
      row[payload.dayIdx] = {
        subject: payload.subject,
        teacher: payload.teacher,
      };
      next[payload.periodIdx] = row;
      return next;
    });
    setEditCell(null);
  };

  const handleEditCellClear = (payload) => {
    setTimetableGrid((prev) => {
      const next = prev.map((row) => [...row]);
      if (!next[payload.periodIdx]) return prev;
      const row = [...next[payload.periodIdx]];
      row[payload.dayIdx] = null;
      next[payload.periodIdx] = row;
      return next;
    });
    setEditCell(null);
  };

  const toggleEditTimetable = () => {
    setActiveTab('Timetable');
    setEditMode((v) => !v);
    setEditCell(null);
  };

  const handleAddPeriod = (slot) => {
    const { period, time, cells } = slot;
    if (periods.some((p) => p.period === period)) {
      setShowAddPeriod(false);
      return;
    }
    const nextPeriods = [...periods, { period, time }].sort((a, b) => a.period - b.period);
    const periodIdx = nextPeriods.findIndex((p) => p.period === period);
    const rowCells =
      Array.isArray(cells) && cells.length === TIMETABLE_DAYS.length
        ? cells
        : Array(TIMETABLE_DAYS.length).fill(null);

    setPeriods(nextPeriods);
    setTimetableGrid((prev) => {
      const next = prev.map((row) => [...row]);
      while (next.length <= periodIdx) {
        next.push(Array(TIMETABLE_DAYS.length).fill(null));
      }
      next[periodIdx] = rowCells;
      return next;
    });
    setShowAddPeriod(false);
  };

  const totalSections = classes.reduce((n, c) => n + (c.sections?.length || 0), 0);
  const totalStudents = classes.reduce(
    (n, c) => n + (c.sections || []).reduce((m, s) => m + (s.studentCount || 0), 0),
    0
  );
  const classStudentCount = (sections || []).reduce((n, s) => n + (s.studentCount || 0), 0);

  const handleExportPdf = () => {
    const headers = ['Day', ...periods.map((p) => `P${p.period} (${p.time})`)];
    const rows = TIMETABLE_DAYS.map((day, di) => {
      const cells = periods.map((_, pi) => {
        const e = timetableGrid[pi]?.[di];
        return e ? `${e.subject} (${e.teacher})` : '';
      });
      return [day, ...cells];
    });
    exportTablePdfReport({
      title: 'WEEKLY TIMETABLE',
      pill: `Class ${formatClassLabel(selectedClass?.name || '—')} · Sec ${sectionName}`,
      dateLabel: `Class ${formatClassLabel(selectedClass?.name || '—')} · Section ${sectionName}`,
      headers,
      rows,
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total Classes" value={loading ? '—' : classes.length} />
        <StatCard label="Total Sections" value={loading ? '—' : totalSections} />
        <StatCard label="Total Students" value={loading ? '—' : totalStudents} />
        <StatCard label="Total Teachers" value={DEFAULT_TEACHERS.length} />
        <StatCard label="Total Periods / Day" value={periods.length} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => alert('Import Class Data: upload CSV in a future update.')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Upload size={16} />
          Import Class Data
        </button>
        <button
          type="button"
          onClick={() => alert('Add Class: connect to API create endpoint next.')}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add Class
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Class list */}
        <aside className="w-full shrink-0 space-y-2 lg:w-56">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Classes
          </p>
          {classes.map((klass) => {
            const count = (klass.sections || []).reduce((n, s) => n + (s.studentCount || 0), 0);
            const active = klass.id === selectedClass?.id;
            return (
              <button
                key={klass.id}
                type="button"
                onClick={() => {
                  setSelectedClassId(klass.id);
                  setSectionName(klass.sections?.[0]?.name || 'A');
                }}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  active
                    ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <p className={`text-sm font-bold ${active ? 'text-indigo-800' : 'text-gray-900'}`}>
                  {formatClassLabel(klass.name)}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {klass.sections?.length || 0} sections · {count} students
                </p>
              </button>
            );
          })}
        </aside>

        {/* Detail panel */}
        <div
          ref={timetablePanelRef}
          className={`min-w-0 flex-1 rounded-xl border border-gray-200 bg-white shadow-sm ${
            isFullscreen ? 'h-screen overflow-y-auto rounded-none border-0' : ''
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">
                  {formatClassLabel(selectedClass?.name || '—')}
                </h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  Active
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {sections.length} sections · {classStudentCount} students
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleEditTimetable}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                  editMode
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Pencil size={15} />
                {editMode ? 'Done Editing' : 'Edit Timetable'}
              </button>
              {activeTab === 'Timetable' && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm hover:border-indigo-200 hover:text-indigo-600"
                  title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                  aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-4 p-5">
            {activeTab === 'Sections' && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((sec) => (
                  <div
                    key={sec.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <p className="font-semibold text-gray-900">Section {sec.name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {sec.studentCount} students · {sec.periodCount} periods / day
                    </p>
                  </div>
                ))}
                {!sections.length && (
                  <p className="text-sm text-gray-500">No sections found.</p>
                )}
              </div>
            )}

            {activeTab === 'Class Strength' && (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Section</th>
                      <th className="px-4 py-3">Students</th>
                      <th className="px-4 py-3">Periods / Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((sec) => (
                      <tr key={sec.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-900">Section {sec.name}</td>
                        <td className="px-4 py-3 text-gray-700">{sec.studentCount}</td>
                        <td className="px-4 py-3 text-gray-700">{sec.periodCount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-indigo-50/50">
                      <td className="px-4 py-3 font-semibold text-indigo-900">Total</td>
                      <td className="px-4 py-3 font-semibold text-indigo-900">{classStudentCount}</td>
                      <td className="px-4 py-3 text-indigo-800">{periodCount}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {activeTab === 'Teachers Assigned' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {DEFAULT_TEACHERS.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                      {t.name
                        .split(' ')
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.subject} · {t.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'Timetable' && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-500">Section</span>
                    <select
                      value={selectedSection?.name || sectionName}
                      onChange={(e) => setSectionName(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.name}>
                          Section {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddPeriod(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <CalendarPlus size={15} />
                    Add Period
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Download size={15} />
                    Export PDF
                  </button>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BookOpen size={16} className="text-indigo-600" />
                  <span>
                    {formatClassLabel(selectedClass?.name)}, Section {selectedSection?.name || sectionName} —
                    periods across columns, days down rows
                  </span>
                </div>

                {editMode && (
                  <p className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                    Edit mode: click any period cell to change subject and teacher.
                  </p>
                )}

                <TimetableGrid
                  periods={periods}
                  grid={timetableGrid}
                  editMode={editMode}
                  onCellClick={setEditCell}
                />

                <TimetableAddPeriodModal
                  open={showAddPeriod}
                  nextPeriod={nextPeriod}
                  onClose={() => setShowAddPeriod(false)}
                  onSave={handleAddPeriod}
                />

                <TimetableEditCellModal
                  open={Boolean(editCell)}
                  cell={editCell}
                  onClose={() => setEditCell(null)}
                  onSave={handleEditCellSave}
                  onClear={handleEditCellClear}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
