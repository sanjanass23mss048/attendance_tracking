import { Check } from 'lucide-react';

/**
 * Floating footer for the attendance grid: counts + Submit.
 */
export default function AttendanceFooterBar({
  studentsLoadedCount,
  isDirty,
  showConfirmed,
  saving = false,
  onCheckAndSave,
  onUnlock,
  editLocked = false,
  editApproved = false,
  onRequestEdit,
}) {
  return (
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-gray-100 bg-white/95 px-3 py-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-4 lg:px-3 lg:py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>
            <strong className="font-semibold text-gray-800">{studentsLoadedCount}</strong> Students Loaded
          </span>
          {showConfirmed ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-medium text-green-600">✓ Attendance confirmed</span>
              {editLocked ? (
                <button
                  type="button"
                  onClick={onRequestEdit}
                  className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  Request Edit
                </button>
              ) : editApproved ? (
                <button
                  type="button"
                  onClick={onUnlock}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Approved – Edit Now
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onUnlock}
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  Edit
                </button>
              )}
            </div>
          ) : (
            isDirty && (
              <span className="mt-1 block font-medium text-amber-600">Unsaved changes</span>
            )
          )}
        </div>

        <button
          type="button"
          onClick={onCheckAndSave}
          disabled={showConfirmed || saving || editLocked}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-gray-900 shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-lg sm:px-5 sm:py-2"
        >
          <Check size={16} strokeWidth={2.5} />
          {showConfirmed ? 'Submitted' : saving ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
