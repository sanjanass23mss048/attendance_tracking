import { useEffect, useMemo, useState } from 'react';
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
  Monitor,
  Palette,
  Sun,
  Trophy,
} from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { getTimetable } from '../services/timetableService.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import {
  buildDefaultWeeklyTimetable,
  PERIOD_TIMES,
  SUBJECT_STYLES,
  TIMETABLE_DAYS,
  isBreakSlot,
  normalizeWeeklyGrid,
  slotRowKey,
} from '../data/timetableData.js';
import { networkErrorMessage, showToast } from '../services/toast.js';
import { exportTablePdfReport } from '../services/reportService.js';
import TimetableAddPeriodModal from './TimetableAddPeriodModal.jsx';

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

function SubjectIcon({ subject, className }) {
  const Icon = SUBJECT_ICONS[subject] || BookOpen;
  return <Icon size={14} className={className} aria-hidden />;
}

function TimetableGrid({ periods, grid }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-indigo-950 text-white">
            <th className="sticky left-0 z-10 min-w-[110px] bg-indigo-950 px-3 py-3 text-left font-semibold">
              <div>Day</div>
              <div className="text-[10px] font-normal text-indigo-300">Period / Time</div>
            </th>
            {periods.map((slot, periodIdx) => (
              <th key={slotRowKey(slot, periodIdx)} className="min-w-[130px] px-2 py-3 text-center font-semibold">
                <div className="text-base">{isBreakSlot(slot) ? slot.label : slot.period}</div>
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
                const isEmpty = !entry || (!entry.subject && !entry.teacher);
                if (isEmpty) {
                  if (isBreakSlot(slot)) {
                    return (
                      <td key={slotRowKey(slot, periodIdx)} className="px-1.5 py-2">
                        <div className="rounded-xl bg-amber-50 px-2 py-4 text-center text-xs font-semibold text-amber-800">
                          {slot.label}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={slotRowKey(slot, periodIdx)} className="px-1.5 py-2">
                      <div className="rounded-xl border border-dashed border-gray-200 px-2 py-4 text-center text-xs text-gray-400">
                        —
                      </div>
                    </td>
                  );
                }
                return (
                  <td key={slotRowKey(slot, periodIdx)} className="px-1.5 py-2 align-top">
                    <div
                      className={`rounded-xl border px-2.5 py-2.5 shadow-sm ${subjectClass(entry.subject)}`}
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <SubjectIcon subject={entry.subject} className="opacity-80" />
                        <p className="font-semibold leading-tight">{entry.subject}</p>
                      </div>
                      <p className="text-[11px] leading-snug opacity-80">{entry.teacher}</p>
                    </div>
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

export default function WeeklyTimetablePage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [sectionName, setSectionName] = useState('A');
  const [timetableGrid, setTimetableGrid] = useState(() => buildDefaultWeeklyTimetable());
  const [periods, setPeriods] = useState(() => PERIOD_TIMES);
  const [showAddPeriod, setShowAddPeriod] = useState(false);

  useEffect(() => {
    getClasses()
      .then((data) => {
        const list = data.classes || [];
        setClasses(list);
        if (list.length) {
          setSelectedClassId(list[0].id);
          const firstSec = list[0].sections?.[0]?.name;
          if (firstSec) setSectionName(firstSec);
          setPeriods(PERIOD_TIMES);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || classes[0],
    [classes, selectedClassId]
  );

  const sections = selectedClass?.sections || [];
  const selectedSection = sections.find((s) => s.name === sectionName) || sections[0];

  useEffect(() => {
    const sectionId = selectedSection?.id;
    if (!sectionId) return undefined;
    let cancelled = false;
    getTimetable(sectionId)
      .then((data) => {
        if (cancelled) return;
        setTimetableGrid(normalizeWeeklyGrid(data.grid));
        setPeriods(Array.isArray(data.periods) && data.periods.length ? data.periods : PERIOD_TIMES);
      })
      .catch((err) => {
        if (!cancelled) {
          showToast(networkErrorMessage(err) || 'Could not load timetable', 'error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSection?.id]);

  const classSectionOptions = useMemo(() => {
    const opts = [];
    for (const klass of classes) {
      for (const sec of klass.sections || []) {
        opts.push({
          key: `${klass.id}-${sec.name}`,
          classId: klass.id,
          className: klass.name,
          sectionName: sec.name,
          periodCount: sec.periodCount || 7,
          label: `Class ${klass.name} — Section ${sec.name}`,
        });
      }
    }
    return opts;
  }, [classes]);

  const selectedOptionKey = selectedClass
    ? `${selectedClass.id}-${selectedSection?.name || sectionName}`
    : '';

  const handleClassSectionChange = (key) => {
    const opt = classSectionOptions.find((o) => o.key === key);
    if (!opt) return;
    setSelectedClassId(opt.classId);
    setSectionName(opt.sectionName);
    setPeriods(PERIOD_TIMES);
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

  const handleExportPdf = () => {
    const headers = ['Day', ...periods.map((p) => `P${p.period} (${p.time})`)];
    const rows = TIMETABLE_DAYS.map((day, di) => {
      const cells = periods.map((_, pi) => {
        const e = timetableGrid[pi]?.[di];
        return e ? `${e.subject} (${e.teacher})` : '';
      });
      return [day, ...cells];
    });
    const sec = selectedSection?.name || sectionName;
    exportTablePdfReport({
      title: 'WEEKLY TIMETABLE',
      pill: `Class ${formatClassLabel(selectedClass?.name || '—')} · Sec ${sec}`,
      dateLabel: `Class ${formatClassLabel(selectedClass?.name || '—')} · Section ${sec}`,
      headers,
      rows,
    });
  };

  const nextPeriod =
    periods.reduce((max, p) => Math.max(max, p.period), 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Weekly Timetable</h2>
          <p className="mt-1 text-sm text-gray-500">
            {formatClassLabel(selectedClass?.name || '—')}, Section{' '}
            {selectedSection?.name || sectionName}
          </p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Class / Section</span>
          <select
            value={selectedOptionKey}
            onChange={(e) => handleClassSectionChange(e.target.value)}
            disabled={loading || !classSectionOptions.length}
            className="min-w-[200px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {classSectionOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
            {!classSectionOptions.length && <option>No classes</option>}
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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

      <TimetableGrid periods={periods} grid={timetableGrid} />

      <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        Demo schedule shown — switch class/section to browse. Add Period extends columns.
      </p>

      <TimetableAddPeriodModal
        open={showAddPeriod}
        nextPeriod={nextPeriod}
        onClose={() => setShowAddPeriod(false)}
        onSave={handleAddPeriod}
      />
    </div>
  );
}
