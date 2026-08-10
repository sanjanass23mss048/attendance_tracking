import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageCircle, Shield } from 'lucide-react';
import {
  editStatusClass,
  editStatusLabel,
  getPendingEditRequests,
} from '../services/attendanceEditRequestService.js';
import { formatAttendanceDate } from '../utils/attendance.js';
import { canApproveEditRequests } from '../data/navItems.js';

export default function EditApprovalsPage({ user, onAccessDenied }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const allowed = canApproveEditRequests(user);

  useEffect(() => {
    if (!allowed) {
      onAccessDenied?.();
    }
  }, [allowed, onAccessDenied]);

  const load = useCallback(async () => {
    if (!canApproveEditRequests(user)) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPendingEditRequests();
      setRequests(data.requests || []);
    } catch (err) {
      const msg = err.message || 'Failed to load pending requests';
      if (/forbidden/i.test(msg)) {
        onAccessDenied?.();
        return;
      }
      setError(msg);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [user, onAccessDenied]);

  useEffect(() => {
    if (!allowed) return undefined;
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load, allowed]);

  if (!allowed) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800 p-6 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <Shield size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Edit Approvals</h2>
            <p className="mt-1 text-sm text-indigo-100">
              Pending requests assigned to you
              {user?.name ? ` (${user.name})` : ''}. Approve or deny only from the WhatsApp
              message — not from this screen.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <MessageCircle className="mt-0.5 shrink-0 text-emerald-600" size={18} />
        <div>
          <p className="font-semibold">WhatsApp-only approval</p>
          <p className="mt-1 text-emerald-800">
            When a teacher requests an edit, you receive a WhatsApp message with{' '}
            <strong>Approve</strong> and <strong>Deny</strong> buttons. Use those buttons to
            respond. This page refreshes automatically to show the latest status.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="animate-spin text-indigo-500" size={18} />
          Loading pending requests…
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
          No pending edit requests. New requests will appear here until you act on WhatsApp.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {[req.className, req.sectionName].filter(Boolean).join('-') || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {req.attendanceDate ? formatAttendanceDate(req.attendanceDate) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{req.teacherName || '—'}</td>
                  <td className="max-w-xs px-4 py-3 text-gray-600">
                    <span className="line-clamp-2">{req.reason || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${editStatusClass(
                        req.status
                      )}`}
                    >
                      {editStatusLabel(req.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
