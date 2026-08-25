import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  GripVertical,
  Info,
  Lock,
  RotateCcw,
  Shuffle,
  X,
} from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { getStudents } from '../services/studentService.js';
import { networkErrorMessage, showToast } from '../services/toast.js';

const ROMAN = {
  LKG: 'LKG',
  UKG: 'UKG',
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X',
  11: 'XI',
  12: 'XII',
};

function ordinalClassLabel(className) {
  const key = String(className || '').trim().toUpperCase();
  if (key === 'LKG' || key === 'UKG') return key;
  const n = Number(key);
  if (!Number.isFinite(n)) return String(className);
  const v = n % 100;
  const s = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th');
  return `${n}${s}`;
}

/** Promotion paths: UKG→1 … 10→11 */
const CLASS_GROUPS = [
  ['UKG', '1'],
  ['1', '2'],
  ['2', '3'],
  ['3', '4'],
  ['4', '5'],
  ['5', '6'],
  ['6', '7'],
  ['7', '8'],
  ['8', '9'],
  ['9', '10'],
  ['10', '11'],
].map(([sourceClass, targetClass]) => ({
  id: `${sourceClass}-${targetClass}`.toLowerCase(),
  label: `${ordinalClassLabel(sourceClass)} to ${ordinalClassLabel(targetClass)}`,
  sourceClass,
  targetClass,
}));

function academicYearStartFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  return m >= 3 ? y : y - 1;
}

function academicYearOptions() {
  const current = academicYearStartFromDate();
  return [0, 1, 2].map((offset) => {
    const start = current - offset;
    return {
      startYear: start,
      label: `${start} - ${start + 1}`,
    };
  });
}

function normalizeClassKey(name) {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/^CLASS\s+/i, '');
}

function classByName(classes, className) {
  const key = normalizeClassKey(className);
  return classes.find((c) => normalizeClassKey(c.name) === key) || null;
}

function sectionColumnLabel(targetClass, sectionName) {
  const roman = ROMAN[normalizeClassKey(targetClass)] || targetClass;
  return `${roman} - ${sectionName}`;
}

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function StudentCard({ student, mode, onRemove, draggingId, setDraggingId, sourceClass }) {
  const isDragging = draggingId === student.id;
  const sourceLabel = normalizeClassKey(sourceClass) || 'SRC';
  return (
    <div
      draggable
      onDragStart={(e) => {
        setDraggingId(student.id);
        e.dataTransfer.setData('text/plain', student.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setDraggingId(null)}
      className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition ${
        isDragging ? 'opacity-50 border-violet-300' : 'border-gray-200 hover:border-violet-200'
      }`}
    >
      <GripVertical size={16} className="shrink-0 text-gray-300 cursor-grab active:cursor-grabbing" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{student.name}</p>
        <p className="text-[11px] text-gray-400">
          Roll {student.rollNo ?? student.roll ?? '—'}
          {student.fromSection ? ` · ${sourceLabel}-${student.fromSection}` : ''}
        </p>
      </div>
      {mode === 'allocated' && (
        <button
          type="button"
          onClick={() => onRemove?.(student.id)}
          className="rounded-md p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-500"
          aria-label={`Remove ${student.name}`}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function DropColumn({
  title,
  count,
  tone,
  students,
  columnKey,
  dropHint,
  onDropStudent,
  onRemove,
  draggingId,
  setDraggingId,
  sourceClass,
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex h-[32rem] w-72 shrink-0 flex-col rounded-2xl border bg-white shadow-sm ${
        tone === 'unallocated' ? 'border-rose-100' : 'border-gray-200'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropStudent(id, columnKey);
      }}
    >
      <div
        className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${
          tone === 'unallocated' ? 'border-rose-50 bg-rose-50/60' : 'border-gray-100 bg-slate-50/80'
        }`}
      >
        <h3 className="truncate text-sm font-semibold text-gray-800">{title}</h3>
        <span
          className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            tone === 'unallocated' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'
          }`}
        >
          {count}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div
          className={`shrink-0 rounded-xl border-2 border-dashed px-3 py-3 text-center text-xs transition ${
            over
              ? 'border-violet-400 bg-violet-50 text-violet-600'
              : 'border-gray-200 bg-gray-50/50 text-gray-400'
          }`}
        >
          {dropHint}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {students.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              mode={tone === 'unallocated' ? 'unallocated' : 'allocated'}
              onRemove={onRemove}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              sourceClass={sourceClass}
            />
          ))}
          {students.length === 0 && (
            <p className="py-6 text-center text-xs text-gray-400">No students here</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClassSectionHandlingPage() {
  const yearOptions = useMemo(() => academicYearOptions(), []);
  const [academicYear, setAcademicYear] = useState(yearOptions[0]?.startYear);
  const [groupId, setGroupId] = useState(CLASS_GROUPS[0].id);
  const [loading, setLoading] = useState(true);
  const [sourceStudents, setSourceStudents] = useState([]);
  const [targetSections, setTargetSections] = useState([]);
  /** studentId → null (unallocated) | sectionId */
  const [allocation, setAllocation] = useState({});
  const [draggingId, setDraggingId] = useState(null);

  const group = CLASS_GROUPS.find((g) => g.id === groupId) || CLASS_GROUPS[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { classes } = await getClasses({ force: true });
      const source = classByName(classes, group.sourceClass);
      const target = classByName(classes, group.targetClass);

      const sections = target?.sections?.length
        ? [...target.sections].sort((a, b) => String(a.name).localeCompare(String(b.name)))
        : [];
      setTargetSections(sections);

      if (!source?.sections?.length) {
        setSourceStudents([]);
        setAllocation({});
        showToast(`No ${group.sourceClass} sections found`, 'error');
        return;
      }

      const results = await Promise.all(
        source.sections.map(async (sec) => {
          try {
            const data = await getStudents({ sectionId: sec.id });
            return (data.students || []).map((s) => ({
              ...s,
              fromSection: sec.name,
            }));
          } catch {
            return [];
          }
        })
      );

      const roster = results
        .flat()
        .filter((s) => String(s.status || 'Active').toLowerCase() !== 'inactive')
        .sort((a, b) => {
          const ra = Number(a.rollNo ?? a.roll) || 0;
          const rb = Number(b.rollNo ?? b.roll) || 0;
          if (ra !== rb) return ra - rb;
          return String(a.name).localeCompare(String(b.name));
        });

      setSourceStudents(roster);
      const next = {};
      for (const s of roster) next[s.id] = null;
      setAllocation(next);
    } catch (err) {
      setSourceStudents([]);
      setTargetSections([]);
      setAllocation({});
      showToast(networkErrorMessage(err, 'Could not load students'), 'error');
    } finally {
      setLoading(false);
    }
  }, [group.sourceClass, group.targetClass]);

  useEffect(() => {
    load();
  }, [load, academicYear]);

  const byBucket = useMemo(() => {
    const unallocated = [];
    const bySection = Object.fromEntries(targetSections.map((s) => [s.id, []]));
    for (const student of sourceStudents) {
      const dest = allocation[student.id];
      if (!dest || !bySection[dest]) unallocated.push(student);
      else bySection[dest].push(student);
    }
    return { unallocated, bySection };
  }, [sourceStudents, allocation, targetSections]);

  const total = sourceStudents.length;
  const allocatedCount = total - byBucket.unallocated.length;
  const unallocatedCount = byBucket.unallocated.length;
  const allAllocated = total > 0 && unallocatedCount === 0;

  const moveStudent = (studentId, columnKey) => {
    setAllocation((prev) => ({
      ...prev,
      [studentId]: columnKey === 'unallocated' ? null : columnKey,
    }));
  };

  const handleShuffle = () => {
    if (!targetSections.length) {
      showToast('No target class sections to allocate into', 'error');
      return;
    }
    const pool = shuffleArray(byBucket.unallocated.map((s) => s.id));
    if (!pool.length) {
      showToast('All students are already allocated', 'info');
      return;
    }
    setAllocation((prev) => {
      const next = { ...prev };
      pool.forEach((id, i) => {
        next[id] = targetSections[i % targetSections.length].id;
      });
      return next;
    });
  };

  const handleReset = () => {
    const next = {};
    for (const s of sourceStudents) next[s.id] = null;
    setAllocation(next);
  };

  const handleProceed = () => {
    // Intentionally no-op until promotion flow is enabled.
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(Number(e.target.value))}
              className="min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {yearOptions.map((y) => (
                <option key={y.startYear} value={y.startYear}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Class Group</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="min-w-[12rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {CLASS_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex max-w-md items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>
            Drag and drop students to allocate them to class &amp; section. All students must be
            allocated to proceed.
          </p>
        </div>
      </div>

      {/* Stats + actions */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-gray-600">
            Total Students: <strong className="text-gray-900">{total}</strong>
          </span>
          <span className="text-emerald-600">
            Allocated: <strong>{allocatedCount}</strong>
          </span>
          <span className="text-rose-600">
            Unallocated: <strong>{unallocatedCount}</strong>
          </span>
          {unallocatedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
              <AlertTriangle size={12} />
              {unallocatedCount} student{unallocatedCount === 1 ? '' : 's'} are not allocated yet.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleShuffle}
          disabled={loading || !byBucket.unallocated.length || !targetSections.length}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Shuffle size={14} />
          Automated Shuffle
        </button>
      </div>

      {/* Columns — equal fixed-width cards, scroll horizontally */}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center text-sm text-gray-500">
          Loading {group.sourceClass} students…
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex items-stretch gap-4 px-1">
            <DropColumn
              title="Unallocated Students"
              count={byBucket.unallocated.length}
              tone="unallocated"
              students={byBucket.unallocated}
              columnKey="unallocated"
              dropHint="Drop students here"
              onDropStudent={moveStudent}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              sourceClass={group.sourceClass}
            />
            {targetSections.length === 0 ? (
              <div className="flex h-[32rem] w-72 shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 text-center text-sm text-gray-500">
                No Class {group.targetClass} sections found. Add sections under Classes &amp; Sections
                first.
              </div>
            ) : (
              targetSections.map((sec) => (
                <DropColumn
                  key={sec.id}
                  title={`${sectionColumnLabel(group.targetClass, sec.name)} Students`}
                  count={(byBucket.bySection[sec.id] || []).length}
                  tone="section"
                  students={byBucket.bySection[sec.id] || []}
                  columnKey={sec.id}
                  dropHint="Drop students here"
                  onDropStudent={moveStudent}
                  onRemove={(id) => moveStudent(id, 'unallocated')}
                  draggingId={draggingId}
                  setDraggingId={setDraggingId}
                  sourceClass={group.sourceClass}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">How it works</p>
        <ol className="grid gap-3 sm:grid-cols-4">
          {[
            'Drag a student from Unallocated',
            'Drop into a class & section column',
            'Use × to move a student back',
            'Allocate everyone, then Proceed',
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Footer actions */}
      <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleReset}
          disabled={loading || allocatedCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw size={14} />
          Reset Allocation
        </button>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <button
            type="button"
            onClick={handleProceed}
            disabled={!allAllocated}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
          >
            {!allAllocated && <Lock size={14} />}
            Proceed to Next
          </button>
          {!allAllocated && (
            <p className="text-center text-xs text-rose-500 sm:text-right">
              Allocate all students to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
