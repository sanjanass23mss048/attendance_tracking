import { Search, Calendar, MousePointerClick } from 'lucide-react';
import { ATTENDANCE_STATUS, PERIOD_COUNT } from '../data/mockData';
import StatusBadge from './StatusBadge';
import TodayStatusPicker from './TodayStatusPicker';

export default function AttendanceGrid({
  students = [],
  grid,
  onCellChange,
  searchQuery,
  onSearchChange,
  showConfirmed,
  onConfirm,
  onReset,
  onUnlock,
  classLabel,
  dateLabel,
  compact = false,
}) {
  const q = (searchQuery || '').trim().toLowerCase();
  const filteredStudents = q
    ? students.filter((s) => (s.name || '').toLowerCase().includes(q))
    : students;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">Mark Attendance — {classLabel}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600">
              <Calendar size={15} className="text-indigo-600" />
              {dateLabel || 'Select date'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => (
                <span key={key} className="flex items-center gap-1 text-xs text-gray-500">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${val.color}`}>
                    {key}
                  </span>
                  {val.label}
                </span>
              ))}
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search student"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="rounded-lg border border-gray-200 py-1.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {!showConfirmed && (
        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5">
          <MousePointerClick size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-900">
            Click <strong>P</strong>, <strong>A</strong>, <strong>L</strong>, <strong>H</strong>, <strong>OH</strong>, or <strong>OF</strong> in column{' '}
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-amber-900">10 (Today)</span> to mark each student.
          </p>
        </div>
      )}

      {compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">{classLabel}</h2>
          <div className="flex items-center gap-2">
            {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => (
              <span key={key} className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${val.color}`}>
                {key}
              </span>
            ))}
          </div>
        </div>
      )}

      {filteredStudents.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">
          No students found matching &quot;{searchQuery}&quot;
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                <th className="w-12 px-4 py-3">No.</th>
                <th className="min-w-[140px] px-4 py-3">Student Name</th>
                {Array.from({ length: PERIOD_COUNT }, (_, i) => (
                  <th
                    key={i}
                    className={`w-10 px-2 py-3 text-center ${
                      i === PERIOD_COUNT - 1 ? 'bg-amber-100 text-amber-800' : 'text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const rowIdx = students.findIndex((s) => s.id === student.id);

                return (
                  <tr key={student.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-500">{student.roll}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{student.name}</td>
                    {Array.from({ length: PERIOD_COUNT }, (_, colIdx) => {
                      const status = grid[rowIdx]?.[colIdx] || 'P';
                      const isToday = colIdx === PERIOD_COUNT - 1;
                      return (
                        <td
                          key={colIdx}
                          className={`px-2 py-2 text-center ${isToday ? 'bg-amber-50/70' : ''}`}
                        >
                          {isToday ? (
                            <TodayStatusPicker
                              status={status}
                              disabled={showConfirmed}
                              onChange={(newStatus) => onCellChange(rowIdx, colIdx, newStatus)}
                            />
                          ) : (
                            <StatusBadge status={status} size="sm" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
        {showConfirmed ? (
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-green-600">✓ Attendance confirmed</p>
            <button
              onClick={onUnlock}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Edit Again
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            Past days (1–9) are read-only · Mark today using the buttons on the right
          </p>
        )}
        <div className={`flex gap-3 ${compact ? 'ml-auto' : ''}`}>
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
    </div>
  );
}
