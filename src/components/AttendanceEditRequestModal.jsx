import { useState } from 'react';
import { X } from 'lucide-react';

export default function AttendanceEditRequestModal({
  open,
  onClose,
  onSubmit,
  teacherName,
  classLabel,
  attendanceDateLabel,
  submitting = false,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    setError('');
    await onSubmit(reason.trim());
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900">Request Edit</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-gray-700">
            <p>
              <span className="text-xs font-medium text-gray-500">Teacher</span>
              <br />
              <strong>{teacherName || '—'}</strong>
            </p>
            <p className="mt-2">
              <span className="text-xs font-medium text-gray-500">Class / Section</span>
              <br />
              <strong>{classLabel}</strong>
            </p>
            <p className="mt-2">
              <span className="text-xs font-medium text-gray-500">Attendance date</span>
              <br />
              <strong>{attendanceDateLabel}</strong>
            </p>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              Reason for requesting the change *
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this attendance needs to be edited"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <p className="text-xs text-gray-500">
            Your assigned approver will receive a WhatsApp message with Approve and Deny buttons.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
