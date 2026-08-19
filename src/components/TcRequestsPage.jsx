import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck, Loader2 } from 'lucide-react';
import {
  approveTcRequest,
  forwardTcRequest,
  listTcRequests,
  rejectTcRequest,
  tcStatusClass,
  tcStatusLabel,
} from '../services/tcRequestService.js';
import { networkErrorMessage, showToast } from '../services/toast.js';
import { canApproveEditRequests } from '../data/navItems.js';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function TcRequestsPage({ user }) {
  const [requests, setRequests] = useState([]);
  const [canReview, setCanReview] = useState(canApproveEditRequests(user));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listTcRequests();
      setRequests(data.requests || []);
      setCanReview(Boolean(data.canReview));
    } catch (err) {
      setError(networkErrorMessage(err) || err.message || 'Could not load TC requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inbox = useMemo(
    () => requests.filter((r) => r.status === 'REQUESTED'),
    [requests]
  );
  const forManagement = useMemo(
    () => requests.filter((r) => r.status === 'FORWARDED'),
    [requests]
  );
  const history = useMemo(
    () => requests.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED'),
    [requests]
  );

  const run = async (id, fn, okMessage) => {
    setBusyId(id);
    try {
      await fn(id);
      showToast(okMessage, 'success');
      await load();
    } catch (err) {
      showToast(networkErrorMessage(err) || err.message || 'Action failed', 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800 p-6 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <FileCheck size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Transfer Certificate</h2>
            <p className="mt-1 text-sm text-indigo-100">
              Parent requests a TC → teacher notifies management → management approves.
              The student is set <strong>inactive</strong> and is not deleted.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading requests…
        </p>
      ) : (
        <>
          <RequestGroup
            title="Waiting on teacher"
            hint="Notify management so they can approve the TC."
            empty="No parent TC requests waiting."
            items={inbox}
            busyId={busyId}
            actionLabel="Notify management"
            onAction={(id) =>
              run(id, forwardTcRequest, 'Management has been notified')
            }
          />

          {canReview ? (
            <RequestGroup
              title="Waiting on management"
              hint="Approve to mark the student inactive. The record stays in the database."
              empty="No TC requests waiting for approval."
              items={forManagement}
              busyId={busyId}
              approve
              onApprove={(id) =>
                run(id, approveTcRequest, 'TC approved — student is inactive')
              }
              onReject={(id) => run(id, rejectTcRequest, 'TC request rejected')}
            />
          ) : (
            <RequestGroup
              title="Sent to management"
              hint="These requests are with school management."
              empty="Nothing forwarded yet."
              items={forManagement}
              busyId={busyId}
            />
          )}

          <RequestGroup
            title="History"
            empty="No approved or rejected TC requests yet."
            items={history}
            busyId={busyId}
          />
        </>
      )}
    </div>
  );
}

function RequestGroup({
  title,
  hint,
  empty,
  items,
  busyId,
  actionLabel,
  onAction,
  approve,
  onApprove,
  onReject,
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((req) => (
            <li
              key={req.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{req.studentName}</p>
                <p className="text-xs text-gray-500">
                  {req.classLabel || 'Class'} · {formatWhen(req.createdOn)}
                </p>
                {req.reason ? (
                  <p className="mt-1 text-sm text-gray-700">{req.reason}</p>
                ) : null}
                <span
                  className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tcStatusClass(
                    req.status
                  )}`}
                >
                  {tcStatusLabel(req.status)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {onAction ? (
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => onAction(req.id)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {busyId === req.id ? 'Sending…' : actionLabel}
                  </button>
                ) : null}
                {approve ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => onApprove(req.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => onReject(req.id)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
