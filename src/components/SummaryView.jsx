import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function SummaryView({
  summaryBreakdown,
  classPercent,
  absentStudents,
  classLabel,
  attendanceDate,
  showConfirmed,
  messagesSent,
  sentMessageCount = 0,
}) {
  const chartData = summaryBreakdown.map((item) => ({
    name: item.label,
    value: item.count,
    color: item.color,
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-gray-900">Attendance Summary</h2>
      <p className="mb-6 text-sm text-gray-500">{classLabel} · {attendanceDate}</p>

      {showConfirmed && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
          ✓ Attendance confirmed for {classLabel}
        </div>
      )}

      {messagesSent && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
          Messages sent to {sentMessageCount} parent{sentMessageCount === 1 ? '' : 's'}
        </div>
      )}

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="relative h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-900">{classPercent}%</span>
            <span className="text-sm text-gray-500">Attendance</span>
          </div>
        </div>

        <div className="w-full flex-1 space-y-3">
          {summaryBreakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium text-gray-700">{item.label}</span>
              </div>
              <span className="font-bold text-gray-900">
                {item.count} <span className="text-sm font-normal text-gray-500">({item.percent}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {absentStudents.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4">
          <h3 className="mb-3 text-sm font-bold text-red-800">
            Absent Students ({absentStudents.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {absentStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium text-red-800">{student.name}</span>
                <span className="text-xs text-red-500">Roll {student.roll}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
