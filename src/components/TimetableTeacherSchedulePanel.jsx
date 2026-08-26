import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function TimetableTeacherSchedulePanel({
  teacher,
  availability,
  dayIndex,
  onDayChange,
  loading,
}) {
  const days = availability?.days || [];
  const current = days[dayIndex] || null;
  const dayCount = days.length || 1;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900">Teacher Schedule</h3>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {teacher?.name || 'Select a teacher'}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!teacher || dayIndex <= 0}
            onClick={() => onDayChange(Math.max(0, dayIndex - 1))}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[4rem] text-center text-sm font-semibold text-indigo-900">
            {current?.dayName || '—'}
          </span>
          <button
            type="button"
            disabled={!teacher || dayIndex >= dayCount - 1}
            onClick={() => onDayChange(Math.min(dayCount - 1, dayIndex + 1))}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!teacher ? (
          <div className="flex flex-col items-center justify-center gap-3 px-2 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
              <CalendarClock size={32} strokeWidth={1.5} />
            </span>
            <p className="max-w-[200px] text-xs leading-relaxed text-gray-500">
              Click a teacher to see occupied / unoccupied periods across all classes.
            </p>
          </div>
        ) : loading ? (
          <p className="py-8 text-center text-xs text-gray-500">Loading schedule…</p>
        ) : !current ? (
          <p className="py-8 text-center text-xs text-gray-500">No schedule data.</p>
        ) : (
          <ul className="space-y-2">
            {(current.periods || []).map((p) => {
              const occupied = p.status === 'O';
              return (
                <li
                  key={p.period}
                  className={`rounded-xl border px-3 py-2 ${
                    occupied
                      ? 'border-indigo-200 bg-indigo-50'
                      : 'border-emerald-200 bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-900">Period {p.period}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        occupied ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          occupied ? 'bg-indigo-200' : 'bg-emerald-200'
                        }`}
                      />
                      {occupied ? 'Occupied' : 'Unoccupied'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-gray-500">{p.time}</p>
                  {occupied ? (
                    <p className="mt-1 text-[11px] font-medium text-indigo-900">
                      {(p.assignments || [])
                        .map((a) => `${a.classLabel}${a.subject ? ` · ${a.subject}` : ''}`)
                        .join(', ')}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-emerald-800">Free</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-1.5 border-t border-gray-100 px-4 py-3 text-[11px] text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>Unoccupied</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-600" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
          <span>Free Period</span>
        </div>
      </div>
    </div>
  );
}
