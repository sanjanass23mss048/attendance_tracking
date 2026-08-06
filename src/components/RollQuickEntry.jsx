import { Info, AlertCircle } from 'lucide-react';

export default function RollQuickEntry({
  rollInput,
  onRollInputChange,
  onMarkAbsent,
  showConfirmed,
  absentCount,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-bold text-gray-900">Mark Absent by Roll Numbers</h2>
      <p className="mb-4 text-sm text-gray-500">Quickly mark students absent using their roll numbers</p>

      <label className="mb-1 block text-xs font-medium text-gray-500">
        Enter roll numbers (comma separated)
      </label>
      <textarea
        value={rollInput}
        onChange={(e) => onRollInputChange(e.target.value)}
        disabled={showConfirmed}
        placeholder="e.g. 3, 8, 15, 21"
        rows={3}
        className="mb-3 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
      />

      <button
        onClick={onMarkAbsent}
        disabled={showConfirmed || !rollInput.trim()}
        className="mb-4 rounded-lg bg-amber-400 px-6 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Mark Absent
      </button>

      <div className="flex gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <Info size={18} className="shrink-0 text-indigo-600 mt-0.5" />
        <p className="text-sm text-indigo-800">
          All students will be marked <strong>Present</strong>, except the roll numbers entered above
          will be marked <strong>Absent</strong>.
        </p>
      </div>

      {absentCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          <span>{absentCount} student(s) currently marked absent for today.</span>
        </div>
      )}
    </div>
  );
}
