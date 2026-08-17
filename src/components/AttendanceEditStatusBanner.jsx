import { Clock3, Lock, ShieldCheck, XCircle } from 'lucide-react';
import { editStatusClass, editStatusLabel } from '../services/attendanceEditRequestService.js';

export default function AttendanceEditStatusBanner({
  locked,
  canEdit,
  request,
  onRequestEdit,
  onEditNow,
  finalized = false,
}) {
  if (!locked && !request) return null;

  const status = request?.status;
  const label = status ? editStatusLabel(status) : locked ? 'Attendance locked' : null;
  const defaultDetail = finalized
    ? 'Parent SMS was sent. Request approval to edit again.'
    : 'Past dates are locked. Request approval to edit.';

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          {status === 'APPROVED' ? (
            <ShieldCheck className="mt-0.5 text-emerald-600" size={18} />
          ) : status === 'DENIED' ? (
            <XCircle className="mt-0.5 text-red-500" size={18} />
          ) : status === 'PENDING' ? (
            <Clock3 className="mt-0.5 text-amber-600" size={18} />
          ) : (
            <Lock className="mt-0.5 text-indigo-600" size={18} />
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {label || 'Previous-day attendance'}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {status === 'APPROVED' && request?.editExpiresAt
                ? `Permission expires at ${new Date(request.editExpiresAt).toLocaleString('en-IN')}`
                : status === 'DENIED'
                  ? request?.denyReason || 'Your edit request was denied. Attendance remains locked.'
                  : status === 'PENDING'
                    ? 'Waiting for the assigned approver (WhatsApp / in-app).'
                    : status === 'USED'
                      ? 'Changes were saved. Attendance is locked again.'
                      : status === 'EXPIRED'
                        ? 'Approval expired. Submit a new edit request.'
                        : defaultDetail}
            </p>
            {status ? (
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${editStatusClass(status)}`}
              >
                {editStatusLabel(status)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'APPROVED' && canEdit ? (
            <button
              type="button"
              onClick={onEditNow}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Approved – Edit Now
            </button>
          ) : null}
          {(locked && (!status || status === 'DENIED' || status === 'EXPIRED' || status === 'USED')) && (
            <button
              type="button"
              onClick={onRequestEdit}
              className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Request Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
