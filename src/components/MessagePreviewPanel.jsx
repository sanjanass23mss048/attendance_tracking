import { useState, useEffect, useMemo } from 'react';
import { Send, Check, Mail, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getStatusDisplay, getAllStudentNotifications } from '../utils/attendance';

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

export default function MessagePreviewPanel({
  students,
  grid,
  classLabel,
  attendanceDate,
  messagesSent,
  onSendToParents,
  compact = false,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingMessage, setEditingMessage] = useState(false);
  const [customMessages, setCustomMessages] = useState({});

  const notifications = useMemo(
    () => getAllStudentNotifications(students, grid, classLabel),
    [students, grid, classLabel]
  );

  const absentNotifications = notifications.filter((n) =>
    n.status === 'A' || n.status === 'L' || n.status === 'H' || n.status === 'OH' || n.status === 'OF' || n.status === 'O'
  );
  const displayList = absentNotifications.length > 0 ? absentNotifications : notifications;
  const current = displayList[selectedIndex] || displayList[0];

  useEffect(() => {
    setSelectedIndex(0);
    setEditingMessage(false);
  }, [grid, classLabel]);

  if (!current) return null;

  const statusInfo = getStatusDisplay(current.status);
  const messageText = customMessages[current.student.id] ?? current.message;

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${compact ? 'p-5' : 'p-6'}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Message to Parents</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Messages only for Absent, Late, Half Day, OD - Half Day, or OD - Full Day — Present students are skipped
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
          <Mail size={24} className="text-indigo-600" />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {displayList.map((n, idx) => (
          <button
            key={n.student.id}
            type="button"
            onClick={() => { setSelectedIndex(idx); setEditingMessage(false); }}
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
          onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
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
          onClick={() => setSelectedIndex(Math.min(displayList.length - 1, selectedIndex + 1))}
          disabled={selectedIndex === displayList.length - 1}
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
              setCustomMessages((prev) => ({ ...prev, [current.student.id]: e.target.value }))
            }
            rows={8}
            className="w-full rounded-lg border border-indigo-200 px-4 py-3 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setEditingMessage(false)}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              <Check size={14} /> Save
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
              <X size={14} /> Reset
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
            date={attendanceDate}
          />
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setEditingMessage(true)}
          disabled={messagesSent}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Pencil size={16} /> Edit Message
        </button>
        <button
          onClick={onSendToParents}
          disabled={messagesSent}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-gray-900 shadow-sm hover:bg-amber-500 disabled:bg-green-500 disabled:text-white"
        >
          {messagesSent ? <Check size={16} /> : <Send size={16} />}
          {messagesSent ? 'Sent to Parents!' : 'Send to Parents'}
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-gray-400">
        {messagesSent
          ? `${notifications.length} personalized messages sent`
          : `Preview ${selectedIndex + 1} of ${displayList.length} · Status: ${statusInfo.label}`}
      </p>
    </div>
  );
}
