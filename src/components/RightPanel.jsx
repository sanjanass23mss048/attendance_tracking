import { Send, Check, MessageSquare, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getStatusDisplay, formatAttendanceDate, isPastAttendanceDate } from '../utils/attendance';

export default function RightPanel({
  classPercent,
  summaryBreakdown,
  absentStudents,
  showConfirmed,
  previewStudent,
  previewStatus,
  classLabel,
  selectedDate,
  onDateChange,
  dateInputKey = 0,
  onSubmitMessages,
  messagesSent,
  sendCount,
  onSendMessageToAbsent,
  onExportReport,
}) {
  const isPastDay = isPastAttendanceDate(selectedDate);
  const canSendParents = showConfirmed && !messagesSent && sendCount > 0 && !isPastDay;
  const chartData = summaryBreakdown
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.label,
      value: item.count,
      color: item.color,
    }));

  const statusInfo = previewStatus ? getStatusDisplay(previewStatus) : null;
  const displayDate = formatAttendanceDate(selectedDate);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 rounded-lg border border-gray-200 px-3 py-2">
          <input
            key={dateInputKey}
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="date-input w-full min-w-0 border-0 bg-transparent p-0 text-sm text-gray-700 focus:outline-none focus:ring-0"
          />
        </div>

        <h3 className="mb-3 text-sm font-bold text-gray-900">Attendance Summary</h3>
        <div className="flex items-center gap-3">
          <div className="relative h-28 w-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.length ? chartData : [{ name: 'Empty', value: 1, color: '#e5e7eb' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={48}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {(chartData.length ? chartData : [{ name: 'Empty', value: 1, color: '#e5e7eb' }]).map(
                    (entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    )
                  )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-gray-900">{classPercent}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            {summaryBreakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-600">{item.label}</span>
                </div>
                <span className="font-semibold text-gray-800">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-900">
          Absent Students {absentStudents.length > 0 && `(${absentStudents.length})`}
        </h3>
        {absentStudents.length === 0 ? (
          <p className="text-xs text-gray-400">No absent students in this class.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {absentStudents.map((student) => (
              <li
                key={student.id}
                className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-red-800">{student.name}</span>
                <span className="text-xs text-red-500">Roll {student.roll}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Quick Actions</h3>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onSendMessageToAbsent}
            disabled={isPastDay || !showConfirmed || absentStudents.length === 0}
            title={
              isPastDay
                ? 'Parent alerts are only sent for today’s absentees'
                : undefined
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquare size={16} />
            {isPastDay ? 'No SMS for previous days' : 'Send Message to Absent'}
          </button>
          <button
            type="button"
            onClick={onExportReport}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download size={16} />
            Export Attendance PDF
          </button>
        </div>
      </div>

      {previewStudent && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Message Preview</h3>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
            <p>
              Name : <strong>{previewStudent.name}</strong>
            </p>
            <p>
              Roll Number : <strong>{previewStudent.roll}</strong>
            </p>
            <p>
              Your ward is absent on <strong>{displayDate}</strong>
            </p>
            <p className="mt-2 text-gray-500">Regards,</p>
            <p>RIOBizSols</p>
            <p className={`mt-2 font-bold ${statusInfo?.textColor}`}>
              Status: {statusInfo?.label}
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onSubmitMessages}
        disabled={!canSendParents}
        title={
          isPastDay
            ? 'Parent alerts are only sent for today’s absentees'
            : undefined
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-sm font-bold text-gray-900 shadow-sm hover:bg-amber-500 disabled:bg-green-500 disabled:text-white disabled:opacity-90"
      >
        {messagesSent ? (
          <>
            <Check size={18} />
            Messages Submitted!
          </>
        ) : isPastDay ? (
          <>
            <Send size={18} />
            No parent alerts (past day)
          </>
        ) : (
          <>
            <Send size={18} />
            Submit Messages{sendCount > 0 ? ` (${sendCount})` : ''}
          </>
        )}
      </button>
    </div>
  );
}
