import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Calculator,
  ChevronRight,
  FlaskConical,
  Globe,
  Languages,
  Leaf,
  Library,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  Sparkles,
  Trophy,
} from 'lucide-react';

const SLOT_TABS = [
  { id: 'teacher', label: 'Teacher' },
  { id: 'subject', label: 'Subject' },
  { id: 'library', label: 'Library' },
  { id: 'activity', label: 'Activity' },
];

const SUBJECT_ICONS = {
  English: BookOpen,
  Mathematics: Calculator,
  Maths: Calculator,
  Math: Calculator,
  EVS: Leaf,
  Hindi: Languages,
  Computer: Monitor,
  Drawing: Palette,
  Games: Trophy,
  Library: Library,
  Science: FlaskConical,
  Social: Globe,
  Music: Palette,
};

const HINT_ICONS = {
  library: Library,
  activity: Palette,
  subject: BookOpen,
  teacher: Sparkles,
};

function iconForSubject(subject) {
  const byName = SUBJECT_ICONS[subject?.name];
  if (byName) return byName;
  const key = Object.keys(SUBJECT_ICONS).find(
    (k) => k.toLowerCase() === String(subject?.name || '').toLowerCase()
  );
  if (key) return SUBJECT_ICONS[key];
  return HINT_ICONS[subject?.slotTypeHint] || BookOpen;
}

function typeLabel(subject, activeSlotType) {
  // Prefer the active tab so Teacher never shows SUBJECT-labeled rows
  if (activeSlotType === 'teacher') return 'TEACHER';
  if (activeSlotType === 'library') return 'LIBRARY';
  if (activeSlotType === 'activity') return 'ACTIVITY';
  const hint = subject?.slotTypeHint || 'subject';
  if (hint === 'library') return 'LIBRARY';
  if (hint === 'activity') return 'ACTIVITY';
  return 'SUBJECT';
}

export default function TimetableSchedulingSubjectsPanel({
  subjects,
  canEdit,
  loading,
  activeSlotType,
  onSlotTypeChange,
  selectedTeacherName = '',
  filteredByTeacher = false,
}) {
  const panelRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const el = panelRef.current;
      setIsFullscreen(Boolean(el && document.fullscreenElement === el));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = panelRef.current;
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
    }
  }, []);

  const onDragStart = (e, subject) => {
    if (!canEdit) {
      e.preventDefault();
      return;
    }
    const slotType =
      subject.slotTypeHint === 'library' || subject.slotTypeHint === 'activity'
        ? subject.slotTypeHint
        : activeSlotType === 'library' || activeSlotType === 'activity'
          ? activeSlotType
          : 'subject';
    e.dataTransfer.setData(
      'application/x-timetable-drag',
      JSON.stringify({
        kind: 'subject',
        subjectId: subject.id,
        subjectName: subject.name,
        slotType,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  const list = subjects || [];

  return (
    <div
      ref={panelRef}
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${
        isFullscreen ? 'h-screen rounded-none border-0' : ''
      }`}
    >
      <div className="shrink-0 border-b border-gray-100 px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Subjects</h3>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-slate-100 hover:text-indigo-600"
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
        {filteredByTeacher && selectedTeacherName ? (
          <p className="mt-1 text-[11px] font-medium text-indigo-600">
            Showing subjects for {selectedTeacherName}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SLOT_TABS.map((t) => {
            const active = activeSlotType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSlotTypeChange(t.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  active
                    ? 'bg-yellow-400 text-slate-900 shadow-sm'
                    : 'bg-slate-100 text-gray-500 hover:bg-slate-200 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-6 text-center text-xs text-gray-500">Loading subjects…</p>
        ) : null}
        {!loading && !list.length ? (
          <p className="px-2 py-6 text-center text-xs text-gray-500">
            {activeSlotType === 'teacher' && !selectedTeacherName
              ? 'Select a teacher to see mapped subjects.'
              : activeSlotType === 'teacher' || filteredByTeacher
                ? 'No subjects mapped to this teacher.'
                : activeSlotType === 'library'
                  ? 'No library slots found.'
                  : activeSlotType === 'activity'
                    ? 'No activity slots found.'
                    : 'No subjects found.'}
          </p>
        ) : null}
        {list.map((s) => {
          const Icon = iconForSubject(s);
          return (
            <div
              key={s.id}
              draggable={canEdit}
              onDragStart={(e) => onDragStart(e, s)}
              className={`flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-2.5 py-2.5 transition ${
                canEdit
                  ? 'cursor-grab active:cursor-grabbing hover:border-indigo-200 hover:bg-indigo-50/50'
                  : ''
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{s.name}</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {typeLabel(s, activeSlotType)}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-gray-300" aria-hidden />
            </div>
          );
        })}
      </div>
    </div>
  );
}
