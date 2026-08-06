import TodayStatusPicker from './TodayStatusPicker';

export default function AttendanceListView({
  students = [],
  grid,
  onStatusChange,
  searchQuery,
  onSearchChange,
  showConfirmed,
  classLabel,
}) {
  const q = (searchQuery || '').trim().toLowerCase();
  const filteredStudents = q
    ? students.filter((s) => (s.name || '').toLowerCase().includes(q))
    : students;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-bold text-gray-900">List View — {classLabel}</h2>
        <input
          type="text"
          placeholder="Search student"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {!showConfirmed && (
        <div className="border-b border-indigo-100 bg-indigo-50 px-5 py-2 text-sm font-medium text-indigo-800">
          Tap a status button next to each student to mark attendance.
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {filteredStudents.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">No students found.</p>
        ) : (
          filteredStudents.map((student) => {
            const rowIdx = students.findIndex((s) => s.id === student.id);
            const status = grid[rowIdx]?.[grid[rowIdx].length - 1] || '';
            return (
              <div
                key={student.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700">
                    {student.roll}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{student.name}</span>
                </div>
                <TodayStatusPicker
                  status={status}
                  disabled={showConfirmed}
                  onChange={(newStatus) => onStatusChange(rowIdx, newStatus)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
