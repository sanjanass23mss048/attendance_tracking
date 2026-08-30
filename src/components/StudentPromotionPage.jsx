import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Info,
  Lock,
  MessageSquare,
  RotateCcw,
  Search,
  Shuffle,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { getStudents, notifyPromotionParents } from '../services/studentService.js';
import { createTcRequest } from '../services/tcRequestService.js';
import { networkErrorMessage, showToast } from '../services/toast.js';
import { useBranding } from '../lib/branding.jsx';

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

const SECTION_PAGE_SIZE = 4;

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

function formatClassDisplay(className) {
  const key = normalizeClassKey(className);
  if (key === 'LKG' || key === 'UKG') return key;
  return `Class ${key}`;
}

function sectionColumnLabel(targetClass, sectionName) {
  const roman = ROMAN[normalizeClassKey(targetClass)] || targetClass;
  return `${roman} - ${sectionName}`;
}

/**
 * Meta template already says "Grade {{n}}" — send only the class key
 * (e.g. "1", "UKG"), never "Grade 1".
 */
function gradeLabel(className) {
  return normalizeClassKey(className) || String(className || '').trim() || '-';
}

/**
 * Approved Meta promotion_message:
 * Header: school name
 * Body: … promoted from Grade {{2}} to Grade {{3}} …
 */
export const PROMOTION_MESSAGE_TEMPLATE = `{{school_name}}

Dear Parent,
We are pleased to inform you that your ward {{student_name}} has been promoted from Grade {{from_grade}} to Grade {{to_grade}} for the new academic year.
Congratulations and best wishes for continued success!`;

function fillPromotionPreview({ studentName, fromGrade, toGrade, schoolName }) {
  return PROMOTION_MESSAGE_TEMPLATE.replace(/\{\{school_name\}\}/g, schoolName || 'School')
    .replace(/\{\{student_name\}\}/g, studentName || 'Student Name')
    .replace(/\{\{from_grade\}\}/g, fromGrade || '—')
    .replace(/\{\{to_grade\}\}/g, toGrade || '—');
}

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function StudentCard({ student, cardMode, onRemove, draggingId, setDraggingId, sourceClass }) {
  const isDragging = draggingId === student.id;
  const sourceLabel = normalizeClassKey(sourceClass) || 'SRC';
  return (
    <div
      draggable={cardMode !== 'demoted'}
      onDragStart={(e) => {
        if (cardMode === 'demoted') return;
        setDraggingId(student.id);
        e.dataTransfer.setData('text/plain', student.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setDraggingId(null)}
      className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition ${
        isDragging ? 'opacity-50 border-violet-300' : 'border-gray-200 hover:border-violet-200'
      }`}
    >
      {cardMode !== 'demoted' ? (
        <GripVertical size={16} className="shrink-0 text-gray-300 cursor-grab active:cursor-grabbing" />
      ) : (
        <UserMinus size={16} className="shrink-0 text-amber-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{student.name}</p>
        <p className="text-[11px] text-gray-400">
          Roll {student.rollNo ?? student.roll ?? '—'}
          {student.fromSection ? ` · ${sourceLabel}-${student.fromSection}` : ''}
        </p>
      </div>
      {cardMode === 'allocated' && (
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
  compact = false,
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex h-[32rem] ${compact ? 'w-60' : 'w-72'} shrink-0 flex-col rounded-2xl border bg-white shadow-sm ${
        tone === 'unallocated'
          ? 'border-rose-100'
          : tone === 'demoted'
            ? 'border-amber-100'
            : 'border-gray-200'
      }`}
      onDragOver={(e) => {
        if (tone === 'demoted') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (tone === 'demoted') return;
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropStudent(id, columnKey);
      }}
    >
      <div
        className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${
          tone === 'unallocated'
            ? 'border-rose-50 bg-rose-50/60'
            : tone === 'demoted'
              ? 'border-amber-50 bg-amber-50/70'
              : 'border-gray-100 bg-slate-50/80'
        }`}
      >
        <h3 className="truncate text-sm font-semibold text-gray-800">{title}</h3>
        <span
          className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            tone === 'unallocated'
              ? 'bg-rose-100 text-rose-700'
              : tone === 'demoted'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-violet-100 text-violet-700'
          }`}
        >
          {count}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        {tone !== 'demoted' && (
          <div
            className={`shrink-0 rounded-xl border-2 border-dashed px-3 py-3 text-center text-xs transition ${
              over
                ? 'border-violet-400 bg-violet-50 text-violet-600'
                : 'border-gray-200 bg-gray-50/50 text-gray-400'
            }`}
          >
            {dropHint}
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {students.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              cardMode={
                tone === 'unallocated' ? 'unallocated' : tone === 'demoted' ? 'demoted' : 'allocated'
              }
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

export default function StudentPromotionPage() {
  const { schoolName } = useBranding();
  const yearOptions = useMemo(() => academicYearOptions(), []);
  const [step, setStep] = useState(1);
  const [academicYear, setAcademicYear] = useState(yearOptions[0]?.startYear);
  const [groupId, setGroupId] = useState(CLASS_GROUPS[0].id);
  const [triageMode, setTriageMode] = useState('all'); // all | some
  const [demotedIds, setDemotedIds] = useState(() => new Set());
  /** For demoted/non-promoting students: continuing | tc */
  const [leavingIntent, setLeavingIntent] = useState(() => ({}));
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [sourceStudents, setSourceStudents] = useState([]);
  const [targetSections, setTargetSections] = useState([]);
  const [allocation, setAllocation] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionPage, setSectionPage] = useState(0);
  const [sending, setSending] = useState(false);

  const group = CLASS_GROUPS.find((g) => g.id === groupId) || CLASS_GROUPS[0];
  const yearLabel =
    yearOptions.find((y) => y.startYear === academicYear)?.label || String(academicYear);

  const filteredTargetSections = useMemo(() => {
    const query = sectionSearch.trim().toLowerCase();
    if (!query) return targetSections;
    return targetSections.filter((section) => {
      const name = String(section.name || '').toLowerCase();
      const label = sectionColumnLabel(group.targetClass, section.name).toLowerCase();
      return name.includes(query) || label.includes(query);
    });
  }, [group.targetClass, sectionSearch, targetSections]);

  const sectionPageCount = Math.ceil(filteredTargetSections.length / SECTION_PAGE_SIZE);
  const safeSectionPage = Math.min(sectionPage, Math.max(sectionPageCount - 1, 0));
  const visibleTargetSections = useMemo(
    () =>
      filteredTargetSections.slice(
        safeSectionPage * SECTION_PAGE_SIZE,
        (safeSectionPage + 1) * SECTION_PAGE_SIZE
      ),
    [filteredTargetSections, safeSectionPage]
  );
  const sectionWindowStart = filteredTargetSections.length
    ? safeSectionPage * SECTION_PAGE_SIZE + 1
    : 0;
  const sectionWindowEnd = Math.min(
    (safeSectionPage + 1) * SECTION_PAGE_SIZE,
    filteredTargetSections.length
  );

  useEffect(() => {
    setSectionPage(0);
  }, [groupId, sectionSearch]);

  useEffect(() => {
    setSectionPage((current) => Math.min(current, Math.max(sectionPageCount - 1, 0)));
  }, [sectionPageCount]);

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
        showToast(`No ${formatClassDisplay(group.sourceClass)} sections found`, 'error');
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
      setDemotedIds(new Set());
      setLeavingIntent({});
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

  const demotedStudents = useMemo(
    () => sourceStudents.filter((s) => demotedIds.has(s.id)),
    [sourceStudents, demotedIds]
  );

  const tcLeavingStudents = useMemo(
    () => demotedStudents.filter((s) => leavingIntent[s.id] === 'tc'),
    [demotedStudents, leavingIntent]
  );

  const continuingStudents = useMemo(
    () => demotedStudents.filter((s) => leavingIntent[s.id] !== 'tc'),
    [demotedStudents, leavingIntent]
  );

  const promoteStudents = useMemo(
    () => sourceStudents.filter((s) => !demotedIds.has(s.id)),
    [sourceStudents, demotedIds]
  );

  const byBucket = useMemo(() => {
    const unallocated = [];
    const bySection = Object.fromEntries(targetSections.map((s) => [s.id, []]));
    for (const student of promoteStudents) {
      const dest = allocation[student.id];
      if (!dest || !bySection[dest]) unallocated.push(student);
      else bySection[dest].push(student);
    }
    return { unallocated, bySection };
  }, [promoteStudents, allocation, targetSections]);

  const hiddenAllocatedCount = useMemo(() => {
    const visibleIds = new Set(visibleTargetSections.map((section) => section.id));
    return promoteStudents.filter(
      (student) => allocation[student.id] && !visibleIds.has(allocation[student.id])
    ).length;
  }, [allocation, promoteStudents, visibleTargetSections]);

  const total = sourceStudents.length;
  const promoteCount = promoteStudents.length;
  const demotedCount = demotedStudents.length;
  const allocatedCount = promoteCount - byBucket.unallocated.length;
  const unallocatedCount = byBucket.unallocated.length;
  const allPromoteesAllocated = promoteCount > 0 && unallocatedCount === 0;

  const filteredForTriage = useMemo(() => {
    if (!search.trim()) return sourceStudents;
    const q = search.toLowerCase();
    return sourceStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.rollNo ?? s.roll).includes(q) ||
        String(s.fromSection || '')
          .toLowerCase()
          .includes(q)
    );
  }, [sourceStudents, search]);

  const previewMessage = fillPromotionPreview({
    studentName: promoteStudents[0]?.name || 'Sanjana',
    fromGrade: gradeLabel(group.sourceClass),
    toGrade: gradeLabel(group.targetClass),
    schoolName: schoolName || 'Bright Future Public School',
  });

  const moveStudent = (studentId, columnKey) => {
    if (demotedIds.has(studentId)) return;
    setAllocation((prev) => ({
      ...prev,
      [studentId]: columnKey === 'unallocated' ? null : columnKey,
    }));
  };

  const toggleDemoted = (id) => {
    setDemotedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setLeavingIntent((intent) => {
          const copy = { ...intent };
          delete copy[id];
          return copy;
        });
      } else {
        next.add(id);
        setLeavingIntent((intent) => ({ ...intent, [id]: intent[id] || 'continuing' }));
      }
      return next;
    });
  };

  const selectAllDemoted = () => {
    setDemotedIds(new Set(sourceStudents.map((s) => s.id)));
    setLeavingIntent((prev) => {
      const next = { ...prev };
      for (const s of sourceStudents) {
        if (!next[s.id]) next[s.id] = 'continuing';
      }
      return next;
    });
  };

  const clearDemoted = () => {
    setDemotedIds(new Set());
    setLeavingIntent({});
  };

  const setStudentLeavingIntent = (id, intent) => {
    setLeavingIntent((prev) => ({ ...prev, [id]: intent }));
  };

  const createTcForLeavers = async (students) => {
    let created = 0;
    let skipped = 0;
    let failed = 0;
    for (const s of students) {
      try {
        await createTcRequest({
          studentClassId: s.id,
          reason: 'Requesting for TC (recorded during promotion)',
          source: 'PROMOTION',
        });
        created += 1;
      } catch (err) {
        if (err?.status === 409) skipped += 1;
        else failed += 1;
      }
    }
    return { created, skipped, failed };
  };

  const handleContinueToAssign = async () => {
    if (triageMode === 'all') {
      setDemotedIds(new Set());
      setLeavingIntent({});
    }
    const effectiveDemoted = triageMode === 'all' ? new Set() : demotedIds;
    if (triageMode === 'some' && effectiveDemoted.size === sourceStudents.length) {
      showToast('Select at least one student to promote, or choose “All promoting”.', 'error');
      return;
    }

    if (triageMode === 'some') {
      const leavers = sourceStudents.filter(
        (s) => effectiveDemoted.has(s.id) && leavingIntent[s.id] === 'tc'
      );
      if (leavers.length) {
        const result = await createTcForLeavers(leavers);
        const parts = [];
        if (result.created) parts.push(`${result.created} TC request(s) created`);
        if (result.skipped) parts.push(`${result.skipped} already in progress`);
        if (result.failed) parts.push(`${result.failed} failed`);
        showToast(
          parts.length ? parts.join(', ') : 'TC requests processed',
          result.failed ? 'error' : 'success'
        );
      }
    }

    const next = {};
    for (const s of sourceStudents) next[s.id] = null;
    setAllocation(next);
    setStep(2);
  };

  const handleShuffle = () => {
    if (!targetSections.length) {
      showToast('No target class sections to allocate into', 'error');
      return;
    }
    const pool = shuffleArray(byBucket.unallocated.map((s) => s.id));
    if (!pool.length) {
      showToast('All promoting students are already allocated', 'info');
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
    const next = { ...allocation };
    for (const s of promoteStudents) next[s.id] = null;
    setAllocation(next);
  };

  const handleProceed = async () => {
    if (!allPromoteesAllocated || promoteCount === 0) return;
    setSending(true);
    try {
      const recipients = promoteStudents.map((s) => ({
        studentClassId: s.id,
        studentName: s.name,
      }));

      const result = await notifyPromotionParents({
        fromGrade: gradeLabel(group.sourceClass),
        toGrade: gradeLabel(group.targetClass),
        schoolName: schoolName || undefined,
        recipients,
      });

      const parts = [];
      if (result.sent) parts.push(`${result.sent} sent`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      if (result.failed) parts.push(`${result.failed} failed`);
      showToast(
        parts.length
          ? `Promotion messages: ${parts.join(', ')}`
          : 'Promotion messages processed',
        result.failed ? 'error' : 'success'
      );
    } catch (err) {
      showToast(networkErrorMessage(err, 'Could not send promotion messages'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Steps */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {[
          { n: 1, label: 'Who is promoting?' },
          { n: 2, label: 'Assign class & section' },
        ].map((s, idx) => (
          <div key={s.n} className="flex items-center gap-2">
            {idx > 0 && <span className="text-gray-300">/</span>}
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                step === s.n
                  ? 'bg-violet-600 text-white'
                  : step > s.n
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {step > s.n ? <CheckCircle2 size={12} className="shrink-0" /> : <span>{s.n}</span>}
              <span>{s.label}</span>
            </span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
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
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setTriageMode('all');
                    setDemotedIds(new Set());
                    setLeavingIntent({});
                    setSectionSearch('');
                    setSectionPage(0);
                    setStep(1);
                  }}
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
                First choose whether everyone in {formatClassDisplay(group.sourceClass)} is
                promoting to {formatClassDisplay(group.targetClass)}, or mark students who will be
                demoted / retained.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setTriageMode('all');
                setDemotedIds(new Set());
                setLeavingIntent({});
              }}
              className={`rounded-2xl border p-5 text-left shadow-sm transition ${
                triageMode === 'all'
                  ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                  : 'border-gray-200 bg-white hover:border-violet-200'
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-violet-700">
                <Users size={18} />
                <span className="text-sm font-semibold">All students are promoting</span>
              </div>
              <p className="text-xs text-gray-600">
                Every student in {formatClassDisplay(group.sourceClass)} will be assigned into{' '}
                {formatClassDisplay(group.targetClass)} sections next.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setTriageMode('some')}
              className={`rounded-2xl border p-5 text-left shadow-sm transition ${
                triageMode === 'some'
                  ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                  : 'border-gray-200 bg-white hover:border-amber-200'
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-amber-700">
                <UserMinus size={18} />
                <span className="text-sm font-semibold">Some students are demoted / retained</span>
              </div>
              <p className="text-xs text-gray-600">
                Select who is not promoting. They stay out of the promotion board; the rest are
                assigned to the next class.
              </p>
            </button>
          </div>

          {triageMode === 'some' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Select students not promoting</p>
                  <p className="text-xs text-gray-500">
                    {demotedCount} selected · {continuingStudents.length} continuing ·{' '}
                    {tcLeavingStudents.length} requesting TC · {total - demotedCount} will promote
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllDemoted}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearDemoted}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, roll, or section…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading students…</p>
              ) : (
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {filteredForTriage.map((s) => {
                    const checked = demotedIds.has(s.id);
                    const intent = leavingIntent[s.id] || 'continuing';
                    return (
                      <li key={s.id}>
                        <div
                          className={`rounded-xl px-3 py-2 text-sm ${
                            checked ? 'bg-amber-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <label className="flex cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDemoted(s.id)}
                              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="min-w-0 flex-1 truncate font-medium text-gray-900">
                              {s.name}
                            </span>
                            <span className="shrink-0 text-xs text-gray-400">
                              Roll {s.rollNo ?? s.roll} · {normalizeClassKey(group.sourceClass)}-
                              {s.fromSection}
                            </span>
                          </label>
                          {checked ? (
                            <div className="ml-7 mt-2 flex flex-wrap gap-3 text-xs">
                              <label className="inline-flex items-center gap-1.5 text-gray-700">
                                <input
                                  type="radio"
                                  name={`leave-${s.id}`}
                                  checked={intent === 'continuing'}
                                  onChange={() => setStudentLeavingIntent(s.id, 'continuing')}
                                  className="text-emerald-600 focus:ring-emerald-500"
                                />
                                Continuing in School
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-indigo-800">
                                <input
                                  type="radio"
                                  name={`leave-${s.id}`}
                                  checked={intent === 'tc'}
                                  onChange={() => setStudentLeavingIntent(s.id, 'tc')}
                                  className="text-indigo-600 focus:ring-indigo-500"
                                />
                                Requesting for TC
                              </label>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                  {filteredForTriage.length === 0 && (
                    <li className="py-6 text-center text-sm text-gray-400">No matching students</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800">
              <MessageSquare size={16} />
              Promotion message template
            </div>
            <p className="mb-2 text-xs text-violet-700/80">
              Sent via WhatsApp template <code className="rounded bg-white/80 px-1">promotion_message</code>{' '}
              to parents of promoted students after class assignment.
            </p>
            <pre className="whitespace-pre-wrap rounded-xl border border-violet-100 bg-white p-3 text-xs text-gray-700">
              {previewMessage}
            </pre>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={loading || total === 0}
              onClick={handleContinueToAssign}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
            >
              Continue to class assignment
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:underline"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <span className="text-gray-600">
                {group.label} · <strong>{yearLabel}</strong>
              </span>
              <span className="text-emerald-600">
                Promoting: <strong>{promoteCount}</strong>
              </span>
              {demotedCount > 0 && (
                <span className="text-amber-700">
                  Demoted / retained: <strong>{demotedCount}</strong>
                </span>
              )}
              <span className="text-rose-600">
                Unallocated: <strong>{unallocatedCount}</strong>
              </span>
              {unallocatedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                  <AlertTriangle size={12} />
                  Allocate all promoting students to continue.
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleShuffle}
              disabled={!byBucket.unallocated.length || !targetSections.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Shuffle size={14} />
              Automated Shuffle
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Target sections</p>
                <p className="text-xs text-gray-500">
                  View a few sections at a time, then search or navigate to reach the rest.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="relative min-w-0 sm:w-64">
                  <label htmlFor="promotion-section-search" className="mb-1 block text-xs font-medium text-gray-500">
                    Find a section
                  </label>
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-[2.1rem] -translate-y-1/2 text-gray-400"
                  />
                  <input
                    id="promotion-section-search"
                    value={sectionSearch}
                    onChange={(e) => setSectionSearch(e.target.value)}
                    placeholder="Search section name…"
                    disabled={!targetSections.length}
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-9 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                  {sectionSearch && (
                    <button
                      type="button"
                      onClick={() => setSectionSearch('')}
                      className="absolute right-2 top-[2.1rem] -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      aria-label="Clear section search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-1.5 sm:min-w-[11rem]">
                  <button
                    type="button"
                    onClick={() => setSectionPage((current) => Math.max(current - 1, 0))}
                    disabled={safeSectionPage === 0 || !sectionPageCount}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Show previous sections"
                    title="Previous sections"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="whitespace-nowrap text-xs font-medium text-gray-600">
                    {sectionWindowStart}-{sectionWindowEnd} of {filteredTargetSections.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSectionPage((current) =>
                        Math.min(current + 1, Math.max(sectionPageCount - 1, 0))
                      )
                    }
                    disabled={safeSectionPage >= sectionPageCount - 1 || !sectionPageCount}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Show next sections"
                    title="Next sections"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>
                {filteredTargetSections.length === targetSections.length
                  ? `${targetSections.length} target section${targetSections.length === 1 ? '' : 's'}`
                  : `${filteredTargetSections.length} matching of ${targetSections.length} target sections`}
              </span>
              {hiddenAllocatedCount > 0 && (
                <span className="font-medium text-violet-700">
                  {hiddenAllocatedCount} assigned outside this view
                </span>
              )}
            </div>
          </div>

          <div className="-mx-1 overflow-x-auto pb-2">
            <div className="flex items-stretch gap-4 px-1">
              {demotedCount > 0 && (
                <DropColumn
                  title={`Demoted / retained (${formatClassDisplay(group.sourceClass)})`}
                  count={demotedCount}
                  tone="demoted"
                  students={demotedStudents}
                  columnKey="demoted"
                  dropHint=""
                  onDropStudent={() => {}}
                  draggingId={draggingId}
                  setDraggingId={setDraggingId}
                  sourceClass={group.sourceClass}
                  compact
                />
              )}
              <DropColumn
                title="Unallocated (promoting)"
                count={byBucket.unallocated.length}
                tone="unallocated"
                students={byBucket.unallocated}
                columnKey="unallocated"
                dropHint="Drop students here"
                onDropStudent={moveStudent}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
                sourceClass={group.sourceClass}
                compact
              />
              {targetSections.length === 0 ? (
                <div className="flex h-[32rem] w-72 shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 text-center text-sm text-gray-500">
                  No {formatClassDisplay(group.targetClass)} sections found. Add sections under
                  Classes &amp; Sections first.
                </div>
              ) : filteredTargetSections.length === 0 ? (
                <div className="flex h-[32rem] w-60 shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 text-center text-sm text-gray-500">
                  No sections match “{sectionSearch}”.
                </div>
              ) : (
                visibleTargetSections.map((sec) => (
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
                    compact
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800">
              <MessageSquare size={16} />
              Parent message (promoted students only)
            </div>
            <pre className="whitespace-pre-wrap rounded-xl border border-violet-100 bg-white p-3 text-xs text-gray-700">
              {previewMessage}
            </pre>
          </div>

          <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleReset}
              disabled={allocatedCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={14} />
              Reset Allocation
            </button>
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <button
                type="button"
                onClick={handleProceed}
                disabled={!allPromoteesAllocated || sending || promoteCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
              >
                {!allPromoteesAllocated && <Lock size={14} />}
                <MessageSquare size={14} />
                {sending ? 'Sending…' : 'Send promotion messages'}
              </button>
              {!allPromoteesAllocated && (
                <p className="text-center text-xs text-rose-500 sm:text-right">
                  Allocate all promoting students to continue.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
