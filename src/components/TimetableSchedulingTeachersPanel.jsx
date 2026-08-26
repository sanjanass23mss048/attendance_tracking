import { ChevronRight, Search } from 'lucide-react';
import { initialsFromName } from '../data/timetableScheduling.js';

export default function TimetableSchedulingTeachersPanel({
  teachers,
  search,
  onSearchChange,
  selectedTeacherId,
  onSelectTeacher,
  canEdit,
  loading,
}) {
  const q = String(search || '').trim().toLowerCase();
  const filtered = (teachers || []).filter((t) => {
    if (!q) return true;
    return [t.name, ...(t.subjectNames || [])].join(' ').toLowerCase().includes(q);
  });

  const onDragStart = (e, teacher) => {
    if (!canEdit) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(
      'application/x-timetable-drag',
      JSON.stringify({
        kind: 'teacher',
        teacherId: teacher.id,
        teacherName: teacher.name,
        subjects: teacher.subjects || [],
        subjectNames: teacher.subjectNames || [],
      })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-gray-100 px-3.5 py-3">
        <h3 className="text-sm font-bold text-slate-900">Teachers</h3>
        <div className="relative mt-2.5">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search teachers..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-6 text-center text-xs text-gray-500">Loading teachers…</p>
        ) : null}
        {!loading && !filtered.length ? (
          <p className="px-2 py-6 text-center text-xs text-gray-500">No teachers found.</p>
        ) : null}
        {filtered.map((t) => {
          const active = selectedTeacherId === t.id;
          const mapped =
            (t.subjectNames || []).length > 0
              ? (t.subjectNames || []).slice(0, 3).join(', ')
              : 'No subjects mapped';
          return (
            <button
              key={t.id}
              type="button"
              draggable={canEdit}
              onDragStart={(e) => onDragStart(e, t)}
              onClick={() => onSelectTeacher(active ? '' : t.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition ${
                active
                  ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-slate-50'
              } ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold tracking-wide text-white shadow-sm">
                {t.initials || initialsFromName(t.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{t.name}</span>
                <span
                  className={`block truncate text-[11px] ${
                    mapped === 'No subjects mapped' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {mapped}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-gray-300" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
