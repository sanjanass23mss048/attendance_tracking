import { useState } from 'react';
import { Info, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';

export default function RollQuickEntry({
  rollInput,
  onRollInputChange,
  onMarkAbsent,
  showConfirmed,
  absentCount,
  recentAbsents = [],
  onClearAbsent,
  onViewSummary,
}) {
  const [lastMarked, setLastMarked] = useState(null);

  const handleMark = () => {
    const value = String(rollInput || '').trim();
    if (!value) return;
    onMarkAbsent?.();
    const first = value.split(/[\s,]+/).filter(Boolean)[0];
    setLastMarked(first || value);
    // Clear single-roll field after mark for mockup-style flow
    if (!value.includes(',') && !/\s/.test(value)) {
      onRollInputChange?.('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-1 text-base font-bold text-gray-900">Mark Absent by Roll</h2>
        <p className="mb-4 text-sm text-gray-500">
          Enter a roll number to mark absent (comma-separated for several).
        </p>

        <label className="mb-1 block text-xs font-medium text-gray-500">
          Enter Roll Number
        </label>
        <p className="mb-2 text-xs text-gray-400">Example: 3, 8</p>
        <input
          type="text"
          inputMode="numeric"
          value={rollInput}
          onChange={(e) => onRollInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleMark();
            }
          }}
          disabled={showConfirmed}
          placeholder="Roll number(s)"
          className="mb-3 w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-50"
        />

        <button
          type="button"
          onClick={handleMark}
          disabled={showConfirmed || !String(rollInput || '').trim()}
          className="mb-4 w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mark Absent
        </button>

        {lastMarked && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            <CheckCircle2 size={18} className="shrink-0" />
            Roll No. {lastMarked} marked as Absent.
          </div>
        )}

        <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <Info size={18} className="mt-0.5 shrink-0 text-indigo-600" />
          <p className="text-sm text-indigo-800">
            All students stay <strong>Present</strong> except the roll numbers you enter,
            which are marked <strong>Absent</strong>.
          </p>
        </div>

        {absentCount > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} />
            <span>{absentCount} student(s) currently marked absent for today.</span>
          </div>
        )}
      </div>

      {recentAbsents.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Recent Entries</h3>
          <ul className="divide-y divide-gray-100">
            {recentAbsents.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Roll {s.roll} · {s.name}
                  </p>
                  <p className="text-xs text-gray-500">{s.timeLabel || 'Just now'}</p>
                </div>
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                  Absent
                </span>
                {onClearAbsent && !showConfirmed && (
                  <button
                    type="button"
                    onClick={() => onClearAbsent(s.rowIdx)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Clear absent for roll ${s.roll}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {onViewSummary && (
        <button
          type="button"
          onClick={onViewSummary}
          className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 lg:hidden"
        >
          View Attendance Summary
        </button>
      )}
    </div>
  );
}
