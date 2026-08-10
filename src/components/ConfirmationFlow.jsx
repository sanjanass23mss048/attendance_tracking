import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Send, Check, Mail, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getStatusDisplay, getParentNotifications } from '../utils/attendance';

function FormattedMessage({ student, classLabel, status, date = '08 May 2026' }) {
  const statusInfo = getStatusDisplay(status);
  const roll = student.roll ?? student.rollNo ?? '-';

  return (
    <div className="text-sm leading-relaxed text-gray-700">
      <p>
        Name : <strong>{student.name}</strong>
      </p>
      <p>
        Roll Number : <strong>{roll}</strong>
      </p>
      <p>
        Your ward is absent on <strong>{date}</strong>
      </p>
      <p className="mt-3 text-gray-500">Regards,</p>
      <p className="text-xs font-medium text-indigo-600">RIOBizSols</p>
      <p className="mt-3 border-t border-gray-200 pt-3">
        Status: <span className={`font-bold ${statusInfo.textColor}`}>{statusInfo.label}</span>
      </p>
    </div>
  );
}

export default function ConfirmationFlow({
  summary,
  summaryBreakdown,
  classPercent,
  visible,
  classLabel,
  students,
  grid,
  absentStudents,
  messagesSent,
  onBackToClasses,
  onSendToParents,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingMessage, setEditingMessage] = useState(false);
  const [customMessages, setCustomMessages] = useState({});

  const notifications = useMemo(
    () => getParentNotifications(students, grid, classLabel),
    [students, grid, classLabel]
  );

  const current = notifications[selectedIndex] || notifications[0];

  useEffect(() => {
    if (visible) {
      setSelectedIndex(0);
      setEditingMessage(false);
      setCustomMessages({});
    }
  }, [visible]);

  const getMessageText = (notification) => {
    return customMessages[notification.student.id] ?? notification.message;
  };

  const handleSelectStudent = (index) => {
    setSelectedIndex(index);
    setEditingMessage(false);
  };

  const handleSelectByStudentId = (studentId) => {
    const idx = notifications.findIndex((n) => n.student.id === studentId);
    if (idx !== -1) handleSelectStudent(idx);
  };

  if (!visible || !current) return null;

  const statusInfo = getStatusDisplay(current.status);
  const messageText = getMessageText(current);
  const chartData = summaryBreakdown.map((item) => ({
    name: item.label,
    value: item.count,
    color: item.color,
  }));

  return (
    <div id="confirmation-flow" className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <span className="h-px flex-1 bg-gray-200" />
        <span>Parent Message Preview &amp; Summary</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-gray-900">Attendance Summary</h3>

          <div className="flex items-center gap-6">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-gray-900">{classPercent}%</span>
                <span className="text-xs text-gray-500">Attendance</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {summaryBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-600">{item.label}</span>
                  </div>
                  <span className="font-semibold text-gray-800">
                    {item.count} ({item.percent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {absentStudents.length > 0 && (
            <div className="mt-5 rounded-lg border border-red-100 bg-red-50 p-4">
              <h4 className="mb-2 text-sm font-bold text-red-800">Absent Students — click to preview message</h4>
              <ul className="space-y-1">
                {absentStudents.map((student) => (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectByStudentId(student.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-left transition-colors ${
                        current.student.id === student.id
                          ? 'bg-red-200 text-red-900 font-semibold'
                          : 'text-red-700 hover:bg-red-100'
                      }`}
                    >
                      <span>{student.name}</span>
                      <span className="text-xs">Roll No. {student.roll}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={onBackToClasses}
            className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Classes
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Message to Parents</h3>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
              <Mail size={24} className="text-indigo-600" />
            </div>
          </div>

          <p className="mb-3 text-xs text-gray-500">
            Messages are sent only for <strong>Absent, Late, Half Day, OD - Half Day, or OD - Full Day</strong> students — Present students are skipped.
          </p>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {notifications.map((n, idx) => (
              <button
                key={n.student.id}
                type="button"
                onClick={() => handleSelectStudent(idx)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedIndex === idx
                    ? `${getStatusDisplay(n.status).color} text-white`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {n.student.name.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <button
              type="button"
              onClick={() => handleSelectStudent(Math.max(0, selectedIndex - 1))}
              disabled={selectedIndex === 0}
              className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {current.student.name} · Roll {current.student.roll} · {classLabel}
            </span>
            <button
              type="button"
              onClick={() => handleSelectStudent(Math.min(notifications.length - 1, selectedIndex + 1))}
              disabled={selectedIndex === notifications.length - 1}
              className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {editingMessage ? (
            <div className="mb-4">
              <textarea
                value={messageText}
                onChange={(e) =>
                  setCustomMessages((prev) => ({
                    ...prev,
                    [current.student.id]: e.target.value,
                  }))
                }
                rows={8}
                className="w-full rounded-lg border border-indigo-200 px-4 py-3 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setEditingMessage(false)}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <Check size={14} />
                  Save
                </button>
                <button
                  onClick={() => {
                    setCustomMessages((prev) => {
                      const next = { ...prev };
                      delete next[current.student.id];
                      return next;
                    });
                    setEditingMessage(false);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600"
                >
                  <X size={14} />
                  Reset
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`mb-4 rounded-lg border p-4 transition-colors ${
                messagesSent ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <FormattedMessage
                student={current.student}
                classLabel={classLabel}
                status={current.status}
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setEditingMessage(true)}
              disabled={messagesSent}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Pencil size={16} />
              Edit Message
            </button>
            <button
              onClick={onSendToParents}
              disabled={messagesSent || notifications.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-gray-900 shadow-sm hover:bg-amber-500 disabled:bg-green-500 disabled:text-white disabled:cursor-default"
            >
              {messagesSent ? <Check size={16} /> : <Send size={16} />}
              {messagesSent
                ? 'Sent to Parents!'
                : notifications.length === 0
                  ? 'No Messages Needed'
                  : `Send to Parents (${notifications.length})`}
            </button>
          </div>

          {messagesSent && (
            <p className="mt-3 text-center text-xs font-medium text-green-600">
              {notifications.length} message(s) sent to parents (Present students skipped)
            </p>
          )}

          {!messagesSent && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Previewing {selectedIndex + 1} of {notifications.length} · Status:{' '}
              <span className={statusInfo.textColor}>{statusInfo.label}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
