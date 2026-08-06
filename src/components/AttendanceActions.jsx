export default function AttendanceActions({ showConfirmed, onReset, onConfirm, hint }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <div className={`flex gap-3 ${!hint ? 'ml-auto w-full justify-end' : ''}`}>
        <button
          onClick={onReset}
          disabled={showConfirmed}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
        <button
          onClick={onConfirm}
          disabled={showConfirmed}
          className="flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-2.5 text-sm font-bold text-gray-900 shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {showConfirmed ? 'Confirmed' : 'Confirm Attendance'}
        </button>
      </div>
    </div>
  );
}
