import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Download,
  Eraser,
  Eye,
  FileCheck,
  FileText,
  Info,
  Loader2,
  PenLine,
  Plus,
  Printer,
  ShieldCheck,
  Upload,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import {
  approveTcRequest,
  createTcRequest,
  downloadTcRequest,
  fetchTcPreview,
  generateTcRequest,
  getTcSignatureSettings,
  listTcRequests,
  rejectTcRequest,
  TC_STATUS_FILTERS,
  tcStatusClass,
  tcStatusLabel,
  uploadTcRequest,
  verifyTcRequest,
} from '../services/tcRequestService.js';
import { getClasses } from '../services/classService.js';
import { getStudents } from '../services/studentService.js';
import { networkErrorMessage, showToast } from '../services/toast.js';
import { canApproveEditRequests } from '../data/navItems.js';
import { API_BASE, apiHeaders } from '../services/api.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function workflowSteps({ approvalRequired = true, tcMethod = 'generate' } = {}) {
  const issue =
    tcMethod === 'upload'
      ? {
          title: 'TC uploaded',
          hint: 'Prepared TC is uploaded to the system',
        }
      : tcMethod === 'both'
        ? {
            title: 'TC generated or uploaded',
            hint: 'Generate from student details or upload a prepared TC',
          }
        : {
            title: 'TC approved/generated',
            hint: 'TC is approved and generated',
          };
  const steps = [
    {
      title: 'Parent requests TC',
      hint: 'Request is raised by parent',
      tone: 'bg-sky-500',
      Icon: UserRound,
    },
  ];
  if (approvalRequired) {
    steps.push(
      {
        title: 'Teacher verifies request',
        hint: 'Teacher verifies and notifies management',
        tone: 'bg-emerald-500',
        Icon: ShieldCheck,
      },
      {
        title: 'Management approves',
        hint: 'Management reviews and approves',
        tone: 'bg-amber-500',
        Icon: CheckCircle2,
      }
    );
  }
  steps.push(
    {
      title: issue.title,
      hint: issue.hint,
      tone: 'bg-violet-600',
      Icon: FileText,
    },
    {
      title: 'Student becomes inactive',
      hint: 'Student set as inactive (record retained)',
      tone: 'bg-indigo-900',
      Icon: UserRound,
    }
  );
  return steps.map((step, idx) => ({ ...step, n: idx + 1 }));
}

function readyToIssue(status, approvalRequired) {
  const s = String(status || '').toUpperCase();
  if (s === 'APPROVED') return true;
  if (!approvalRequired && (s === 'REQUESTED' || s === 'FORWARDED')) return true;
  return false;
}

const PAGE_SIZE = 10;

export default function TcRequestsPage({ user }) {
  const canReviewRole = canApproveEditRequests(user);
  const [requests, setRequests] = useState([]);
  const [canVerify, setCanVerify] = useState(true);
  const [canReview, setCanReview] = useState(canReviewRole);
  const [canGenerate, setCanGenerate] = useState(canReviewRole);
  const [canUpload, setCanUpload] = useState(false);
  const [workflow, setWorkflow] = useState({
    managementApproval: 'required',
    tcMethod: 'generate',
    approvalRequired: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [viewRow, setViewRow] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [generateRow, setGenerateRow] = useState(null);
  const [uploadRow, setUploadRow] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listTcRequests({
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setRequests(data.requests || []);
      const nextWorkflow = data.workflow || {
        managementApproval: 'required',
        tcMethod: 'generate',
        approvalRequired: true,
      };
      setWorkflow(nextWorkflow);
      setCanVerify(Boolean(data.canVerify) && nextWorkflow.approvalRequired !== false);
      setCanReview(Boolean(data.canReview));
      setCanGenerate(Boolean(data.canGenerate ?? data.canReview));
      setCanUpload(Boolean(data.canUpload));
    } catch (err) {
      setError(networkErrorMessage(err) || err.message || 'Could not load TC requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo]);

  const total = requests.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return requests.slice(start, start + PAGE_SIZE);
  }, [requests, pageSafe]);

  const run = async (id, fn, okMessage) => {
    setBusyId(id);
    try {
      await fn(id);
      showToast(okMessage, 'success');
      setViewRow(null);
      await load();
    } catch (err) {
      showToast(networkErrorMessage(err) || err.message || 'Action failed', 'error');
    } finally {
      setBusyId('');
    }
  };

  const onDownload = async (id) => {
    setBusyId(id);
    try {
      await downloadTcRequest(id);
      showToast('TC downloaded', 'success');
    } catch (err) {
      showToast(networkErrorMessage(err) || err.message || 'Download failed', 'error');
    } finally {
      setBusyId('');
    }
  };

  const openViewOrPreview = (req) => {
    const status = String(req.status || '').toUpperCase();
    const hasDoc =
      status === 'TC_ISSUED' || status === 'INACTIVE' || req.hasTcDocument || req.hasUploadedFile;
    if (hasDoc) {
      setPreviewRow(req);
      return;
    }
    if (
      (status === 'APPROVED' || (!workflow.approvalRequired && status === 'REQUESTED')) &&
      workflow.tcMethod !== 'upload'
    ) {
      setPreviewRow(req);
      return;
    }
    setViewRow(req);
  };

  const steps = workflowSteps(workflow);
  const approvalRequired = workflow.approvalRequired !== false;
  const verifyOkMessage = approvalRequired
    ? 'Teacher verified — pending management approval'
    : workflow.tcMethod === 'upload'
      ? 'Teacher verified — ready to upload TC'
      : workflow.tcMethod === 'both'
        ? 'Teacher verified — ready to generate or upload TC'
        : 'Teacher verified — ready to generate TC';
  const approveOkMessage =
    workflow.tcMethod === 'upload'
      ? 'TC approved — ready to upload'
      : workflow.tcMethod === 'both'
        ? 'TC approved — ready to generate or upload'
        : 'TC approved — ready to generate';

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <FileCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">TC Workflow</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              {approvalRequired
                ? 'Track every request from parent request through issue — student records are never deleted.'
                : 'Verification is not required. Prepare the TC when the request is raised — student records are never deleted.'}
            </p>
          </div>
        </div>

        <div
          className={`grid gap-3 sm:grid-cols-2 ${
            steps.length >= 5 ? 'lg:grid-cols-5' : steps.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
          }`}
        >
          {steps.map((step, idx) => (
            <div key={step.n} className="relative flex gap-3 rounded-xl border border-white/80 bg-white/90 p-3 shadow-sm">
              {idx < steps.length - 1 ? (
                <div className="pointer-events-none absolute right-0 top-1/2 hidden h-px w-3 translate-x-full bg-indigo-200 lg:block" />
              ) : null}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow ${step.tone}`}
              >
                <step.Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900">
                  {step.n}. {step.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{step.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h3 className="text-base font-bold text-gray-900">TC Requests</h3>
            <p className="text-xs text-gray-500">Filter by status or date, then act on each stage.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {TC_STATUS_FILTERS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              title="From date"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              title="To date"
            />
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus size={16} />
              New TC Request
            </button>
          </div>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" /> Loading requests…
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Student Name</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Roll No.</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Class &amp; Section</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Parent Name</th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">Request Date</th>
                    <th className="min-w-[8rem] px-3 py-3 font-semibold">Reason</th>
                    {approvalRequired ? (
                      <>
                        <th className="whitespace-nowrap px-3 py-3 font-semibold">Teacher Verification</th>
                        <th className="whitespace-nowrap px-3 py-3 font-semibold">Management Approval</th>
                      </>
                    ) : null}
                    <th className="whitespace-nowrap px-3 py-3 font-semibold">TC Status</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={approvalRequired ? 10 : 8} className="px-4 py-10 text-center text-sm text-gray-500">
                        No TC requests match these filters.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((req) => (
                      <TcRow
                        key={req.id}
                        req={req}
                        busyId={busyId}
                        canVerify={canVerify}
                        canReview={canReview}
                        canGenerate={canGenerate}
                        canUpload={canUpload}
                        approvalRequired={approvalRequired}
                        onView={() => openViewOrPreview(req)}
                        onVerify={() => run(req.id, verifyTcRequest, verifyOkMessage)}
                        onApprove={() => run(req.id, approveTcRequest, approveOkMessage)}
                        onReject={() => run(req.id, rejectTcRequest, 'TC request rejected')}
                        onGenerate={() => setGenerateRow(req)}
                        onUpload={() => setUploadRow(req)}
                        onDownload={() => onDownload(req.id)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 sm:px-5">
              <p>
                Showing {total === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1} to{' '}
                {Math.min(pageSafe * PAGE_SIZE, total)} of {total} entries
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-gray-200 px-2.5 py-1 font-medium disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2">
                  {pageSafe} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={pageSafe >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="rounded-md border border-gray-200 px-2.5 py-1 font-medium disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {viewRow ? (
        <ViewModal
          req={viewRow}
          onClose={() => setViewRow(null)}
          busy={busyId === viewRow.id}
          canVerify={canVerify}
          canReview={canReview}
          canGenerate={canGenerate}
          canUpload={canUpload}
          approvalRequired={approvalRequired}
          onVerify={() => run(viewRow.id, verifyTcRequest, verifyOkMessage)}
          onApprove={() => run(viewRow.id, approveTcRequest, approveOkMessage)}
          onReject={() => run(viewRow.id, rejectTcRequest, 'TC request rejected')}
          onGenerate={() => {
            setViewRow(null);
            setGenerateRow(viewRow);
          }}
          onUpload={() => {
            setViewRow(null);
            setUploadRow(viewRow);
          }}
          onDownload={() => onDownload(viewRow.id)}
          onPreview={() => {
            setViewRow(null);
            setPreviewRow(viewRow);
          }}
        />
      ) : null}

      {previewRow ? (
        <TcPreviewModal
          req={previewRow}
          onClose={() => setPreviewRow(null)}
          busy={busyId === previewRow.id}
          canGenerate={canGenerate}
          canUpload={canUpload}
          onDownload={() => onDownload(previewRow.id)}
          onGenerate={() => {
            setPreviewRow(null);
            setGenerateRow(previewRow);
          }}
          onUpload={() => {
            setPreviewRow(null);
            setUploadRow(previewRow);
          }}
        />
      ) : null}

      {generateRow ? (
        <GenerateTcModal
          req={generateRow}
          busy={busyId === generateRow.id}
          onClose={() => setGenerateRow(null)}
          onConfirm={async (sig) => {
            setBusyId(generateRow.id);
            try {
              await generateTcRequest(generateRow.id, sig);
              showToast('TC issued — student set inactive (record kept)', 'success');
              setGenerateRow(null);
              await load();
            } catch (err) {
              showToast(networkErrorMessage(err) || err.message || 'Generate failed', 'error');
            } finally {
              setBusyId('');
            }
          }}
        />
      ) : null}

      {uploadRow ? (
        <UploadTcModal
          req={uploadRow}
          busy={busyId === uploadRow.id}
          onClose={() => setUploadRow(null)}
          onConfirm={async (file) => {
            setBusyId(uploadRow.id);
            try {
              await uploadTcRequest(uploadRow.id, file);
              showToast('TC uploaded — student set inactive (record kept)', 'success');
              setUploadRow(null);
              await load();
            } catch (err) {
              showToast(networkErrorMessage(err) || err.message || 'Upload failed', 'error');
            } finally {
              setBusyId('');
            }
          }}
        />
      ) : null}

      {showNew ? (
        <NewTcModal
          onClose={() => setShowNew(false)}
          onCreated={async () => {
            setShowNew(false);
            showToast('TC request created', 'success');
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function VerificationCell({ verified, date }) {
  if (verified) {
    return (
      <div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <Check size={12} strokeWidth={3} /> Verified
        </span>
        <p className="text-[11px] text-gray-400">{formatDate(date)}</p>
      </div>
    );
  }
  return (
    <div>
      <span className="text-xs font-semibold text-amber-600">Pending</span>
      <p className="text-[11px] text-gray-400">—</p>
    </div>
  );
}

function ApprovalCell({ approved, rejected, date }) {
  if (rejected) {
    return (
      <div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
          <X size={12} strokeWidth={3} /> Rejected
        </span>
        <p className="text-[11px] text-gray-400">{formatDate(date)}</p>
      </div>
    );
  }
  if (approved) {
    return (
      <div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <Check size={12} strokeWidth={3} /> Approved
        </span>
        <p className="text-[11px] text-gray-400">{formatDate(date)}</p>
      </div>
    );
  }
  return (
    <div>
      <span className="text-xs font-semibold text-amber-600">Pending</span>
      <p className="text-[11px] text-gray-400">—</p>
    </div>
  );
}

function TcRow({
  req,
  busyId,
  canVerify,
  canReview,
  canGenerate,
  canUpload,
  approvalRequired,
  onView,
  onVerify,
  onApprove,
  onReject,
  onGenerate,
  onUpload,
  onDownload,
}) {
  const status = String(req.status || '').toUpperCase();
  const teacherVerified = Boolean(req.forwardedOn) || ['FORWARDED', 'APPROVED', 'TC_ISSUED', 'INACTIVE'].includes(status);
  const mgmtApproved = ['APPROVED', 'TC_ISSUED', 'INACTIVE'].includes(status);
  const mgmtRejected = status === 'REJECTED';
  const busy = busyId === req.id;
  const displayStatus = status;
  const showIssue = readyToIssue(status, approvalRequired);
  const statusLabel =
    !approvalRequired && status === 'REQUESTED' ? 'Ready' : tcStatusLabel(displayStatus);
  const statusTone =
    !approvalRequired && status === 'REQUESTED' ? tcStatusClass('APPROVED') : tcStatusClass(displayStatus);

  return (
    <tr className="align-top hover:bg-slate-50/80">
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-900">{req.studentName}</p>
        <p className="text-xs text-gray-400">
          {req.tcNo ? `TC No. ${req.tcNo}` : req.admissionNo || '—'}
        </p>
      </td>
      <td className="px-3 py-3 text-gray-700">{req.rollNo || '—'}</td>
      <td className="px-3 py-3 text-gray-700">{req.classLabel || '—'}</td>
      <td className="px-3 py-3">
        <p className="font-medium text-gray-900">{req.parentName || '—'}</p>
        <p className="text-xs text-gray-400">{req.parentContact || ''}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-gray-700">{formatDate(req.createdOn)}</td>
      <td className="max-w-[12rem] px-3 py-3 text-gray-600">
        <span className="line-clamp-2">{req.reason || '—'}</span>
      </td>
      {approvalRequired ? (
        <>
          <td className="px-3 py-3">
            <VerificationCell verified={teacherVerified} date={req.forwardedOn} />
          </td>
          <td className="px-3 py-3">
            <ApprovalCell approved={mgmtApproved} rejected={mgmtRejected} date={req.reviewedOn} />
          </td>
        </>
      ) : null}
      <td className="px-3 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusTone}`}
        >
          {statusLabel}
          {(displayStatus === 'INACTIVE' ||
            (displayStatus === 'TC_ISSUED' && req.studentInactive)) && (
            <Info size={11} />
          )}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <IconBtn
            title={
              ['APPROVED', 'TC_ISSUED', 'INACTIVE'].includes(status) ||
              req.hasTcDocument ||
              showIssue
                ? 'Preview TC'
                : 'View'
            }
            onClick={onView}
            disabled={busy}
          >
            <Eye size={14} />
          </IconBtn>
          {status === 'REQUESTED' && canVerify && approvalRequired ? (
            <button
              type="button"
              disabled={busy}
              onClick={onVerify}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              <ShieldCheck size={13} />
              Verify
            </button>
          ) : null}
          {status === 'FORWARDED' && canReview ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check size={13} />
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onReject}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <XCircle size={13} />
                Reject
              </button>
            </>
          ) : null}
          {showIssue && canGenerate ? (
            <button
              type="button"
              disabled={busy}
              onClick={onGenerate}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <FileText size={13} />
              Generate TC
            </button>
          ) : null}
          {showIssue && canUpload ? (
            <button
              type="button"
              disabled={busy}
              onClick={onUpload}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <Upload size={13} />
              Upload TC
            </button>
          ) : null}
          {(status === 'TC_ISSUED' || status === 'INACTIVE' || req.hasTcDocument) && (
            <IconBtn title="Download TC" onClick={onDownload} disabled={busy} tone="sky">
              <Download size={14} />
            </IconBtn>
          )}
        </div>
      </td>
    </tr>
  );
}

function IconBtn({ title, onClick, disabled, children, tone = 'slate' }) {
  const tones = {
    slate: 'border-gray-200 text-gray-600 hover:bg-gray-50',
    sky: 'border-sky-200 text-sky-700 hover:bg-sky-50',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function ViewModal({
  req,
  onClose,
  busy,
  canVerify,
  canReview,
  canGenerate,
  canUpload,
  approvalRequired,
  onVerify,
  onApprove,
  onReject,
  onGenerate,
  onUpload,
  onDownload,
  onPreview,
}) {
  const status = String(req.status || '').toUpperCase();
  const showIssue = readyToIssue(status, approvalRequired);
  const canPreview =
    status === 'TC_ISSUED' ||
    status === 'INACTIVE' ||
    req.hasTcDocument ||
    (showIssue && canGenerate);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">TC Request</h3>
            <p className="text-xs text-gray-500">{req.id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          {[
            ['TC No.', req.tcNo || '—'],
            ['Student', req.studentName],
            ['Admission No.', req.admissionNo || '—'],
            ['Roll No.', req.rollNo || '—'],
            ['Class & Section', req.classLabel || '—'],
            ['Parent', req.parentName || '—'],
            ['Contact', req.parentContact || '—'],
            ['Request Date', formatDate(req.createdOn)],
            ['Reason', req.reason || '—'],
            ['Status', tcStatusLabel(status)],
            ['Teacher verified', approvalRequired ? (req.forwardedOn ? formatDate(req.forwardedOn) : 'Pending') : 'Not required'],
            ['Management', approvalRequired ? (req.reviewedOn ? formatDate(req.reviewedOn) : 'Pending') : 'Not required'],
            ['Issued', req.issuedOn ? formatDate(req.issuedOn) : '—'],
            ['Signed by', req.signerName || '—'],
            ['Note', req.reviewNote || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3 border-b border-gray-50 pb-2">
              <dt className="w-36 shrink-0 text-gray-500">{k}</dt>
              <dd className="font-medium text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {canPreview ? (
            <button
              type="button"
              disabled={busy}
              onClick={onPreview}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-50"
            >
              <Eye size={14} /> Preview TC
            </button>
          ) : null}
          {status === 'REQUESTED' && canVerify && approvalRequired ? (
            <button
              type="button"
              disabled={busy}
              onClick={onVerify}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Verify
            </button>
          ) : null}
          {status === 'FORWARDED' && canReview ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onReject}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          ) : null}
          {showIssue && canGenerate ? (
            <button
              type="button"
              disabled={busy}
              onClick={onGenerate}
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Generate TC
            </button>
          ) : null}
          {showIssue && canUpload ? (
            <button
              type="button"
              disabled={busy}
              onClick={onUpload}
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Upload TC
            </button>
          ) : null}
          {(status === 'TC_ISSUED' || status === 'INACTIVE' || req.hasTcDocument) && (
            <button
              type="button"
              disabled={busy}
              onClick={onDownload}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-sky-700 disabled:opacity-50"
            >
              <Download size={14} /> Download TC
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TcPreviewModal({ req, onClose, busy, canGenerate, canUpload, onDownload, onGenerate, onUpload }) {
  const [kind, setKind] = useState('html');
  const [html, setHtml] = useState('');
  const [objectUrl, setObjectUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const status = String(req.status || '').toUpperCase();
  const isDraft = status === 'APPROVED' && !req.hasTcDocument && !req.hasUploadedFile;
  const iframeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = '';
    (async () => {
      setLoading(true);
      setError('');
      setHtml('');
      setObjectUrl('');
      try {
        const doc = await fetchTcPreview(req.id);
        if (cancelled) return;
        setKind(doc.kind);
        if (doc.kind === 'html') {
          setHtml(doc.html);
        } else {
          createdUrl = URL.createObjectURL(doc.blob);
          if (cancelled) {
            URL.revokeObjectURL(createdUrl);
            return;
          }
          setObjectUrl(createdUrl);
        }
      } catch (err) {
        if (!cancelled) setError(networkErrorMessage(err) || err.message || 'Preview failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [req.id]);

  const onPrint = () => {
    if (kind === 'html') {
      const frame = iframeRef.current;
      if (!frame?.contentWindow) return;
      frame.contentWindow.focus();
      frame.contentWindow.print();
      return;
    }
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      return;
    }
    window.open(objectUrl, '_blank', 'noopener');
  };

  const canPrint = !loading && !error && (html || objectUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-indigo-50 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 sm:px-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {isDraft ? 'TC Draft Preview' : 'Transfer Certificate'}
            </h3>
            <p className="text-xs text-gray-500">
              {req.studentName}
              {req.tcNo ? ` · TC No. ${req.tcNo}` : ''}
              {isDraft ? ' · Draft (not issued)' : req.issuedOn ? ` · Issued ${formatDate(req.issuedOn)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrint}
              disabled={!canPrint}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
            >
              <Printer size={14} /> Print
            </button>
            {!isDraft ? (
              <button
                type="button"
                disabled={busy}
                onClick={onDownload}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:opacity-50"
              >
                <Download size={14} /> Download
              </button>
            ) : null}
            {isDraft && canGenerate ? (
              <button
                type="button"
                disabled={busy}
                onClick={onGenerate}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <FileText size={14} /> Generate &amp; Sign
              </button>
            ) : null}
            {isDraft && canUpload ? (
              <button
                type="button"
                disabled={busy}
                onClick={onUpload}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Upload size={14} /> Upload TC
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/80">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-4">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Loading certificate…
            </p>
          ) : error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
          ) : kind === 'html' ? (
            <iframe
              ref={iframeRef}
              title="Transfer Certificate Preview"
              srcDoc={html}
              className="mx-auto h-[70vh] w-full max-w-3xl rounded-lg border border-gray-200 bg-white shadow-sm"
            />
          ) : kind === 'image' ? (
            <img
              src={objectUrl}
              alt="Transfer Certificate"
              className="mx-auto max-h-[70vh] rounded-lg border border-gray-200 bg-white object-contain shadow-sm"
            />
          ) : (
            <iframe
              ref={iframeRef}
              title="Transfer Certificate Preview"
              src={objectUrl}
              className="mx-auto h-[70vh] w-full max-w-3xl rounded-lg border border-gray-200 bg-white shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e1b4b';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }, []);

  const pos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    onChange?.(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-28 w-full touch-none rounded-lg border border-indigo-200 bg-white"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-700"
      >
        <Eraser size={12} /> Clear pad
      </button>
    </div>
  );
}

function GenerateTcModal({ req, onClose, onConfirm, busy }) {
  const [signerName, setSignerName] = useState('');
  const [signerDesignation, setSignerDesignation] = useState('Principal');
  const [mode, setMode] = useState('default'); // default | upload | draw
  const [uploadPreview, setUploadPreview] = useState(null);
  const [drawnDataUrl, setDrawnDataUrl] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [defaultSigBlob, setDefaultSigBlob] = useState(null);
  const [loadingDefaults, setLoadingDefaults] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      setLoadingDefaults(true);
      try {
        const data = await getTcSignatureSettings();
        if (cancelled) return;
        setDefaults(data);
        if (data?.signerName) setSignerName(data.signerName);
        if (data?.signerDesignation) setSignerDesignation(data.signerDesignation);
        if (data?.hasSignature && data?.signatureUrl) {
          const res = await fetch(`${API_BASE}${data.signatureUrl}`, { headers: apiHeaders() });
          if (res.ok) {
            const blob = await res.blob();
            objectUrl = URL.createObjectURL(blob);
            if (!cancelled) setDefaultSigBlob(objectUrl);
          }
        }
      } catch {
        if (!cancelled) setDefaults(null);
      } finally {
        if (!cancelled) setLoadingDefaults(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const onFile = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      showToast('Signature must be PNG, JPEG, or WebP', 'error');
      return;
    }
    if (file.size > 1024 * 1024) {
      showToast('Signature image must be 1 MB or smaller', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(String(reader.result || ''));
      setMode('upload');
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    let signatureDataUrl = undefined;
    if (mode === 'upload' && uploadPreview) signatureDataUrl = uploadPreview;
    if (mode === 'draw' && drawnDataUrl) signatureDataUrl = drawnDataUrl;
    await onConfirm({
      signerName: signerName.trim() || undefined,
      signerDesignation: signerDesignation.trim() || 'Principal',
      signatureDataUrl,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Generate &amp; Sign TC</h3>
            <p className="text-xs text-gray-500">
              {req.studentName} · Issues certificate and sets student inactive (record kept).
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-500">
            Signer name
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. Dr. A. Kumar"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Designation
            <input
              value={signerDesignation}
              onChange={(e) => setSignerDesignation(e.target.value)}
              placeholder="Principal"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Authorized signature</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                ['default', 'School default'],
                ['upload', 'Upload'],
                ['draw', 'Draw'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    mode === id
                      ? 'bg-indigo-600 text-white'
                      : 'border border-indigo-100 bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadingDefaults ? (
              <p className="text-xs text-gray-400">Loading school signature…</p>
            ) : mode === 'default' ? (
              <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3 text-center">
                {defaultSigBlob ? (
                  <img src={defaultSigBlob} alt="School signature" className="mx-auto max-h-16 object-contain" />
                ) : (
                  <p className="text-xs text-gray-500">
                    No school signature on file. Set one in Settings, or upload / draw below.
                  </p>
                )}
                {defaults?.signerName ? (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Default: {defaults.signerName}
                    {defaults.signerDesignation ? ` · ${defaults.signerDesignation}` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === 'upload' ? (
              <div className="rounded-xl border border-gray-200 p-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="block w-full text-xs text-gray-600"
                />
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Upload preview" className="mt-2 max-h-16 object-contain" />
                ) : null}
              </div>
            ) : null}

            {mode === 'draw' ? (
              <div className="rounded-xl border border-indigo-100 p-2">
                <div className="mb-1 flex items-center gap-1 text-[11px] text-gray-500">
                  <PenLine size={12} /> Draw signature
                </div>
                <SignaturePad onChange={setDrawnDataUrl} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {busy ? 'Issuing…' : 'Issue TC'}
          </button>
        </div>
      </form>
    </div>
  );
}

function UploadTcModal({ req, onClose, onConfirm, busy }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const onFile = (chosen) => {
    setError('');
    if (!chosen) {
      setFile(null);
      return;
    }
    const mime = String(chosen.type || '').toLowerCase();
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/jpg'];
    if (!allowed.includes(mime)) {
      setError('TC file must be a PDF, PNG, JPEG, or WebP.');
      setFile(null);
      return;
    }
    if (chosen.size > 10 * 1024 * 1024) {
      setError('TC file must be 10 MB or smaller.');
      setFile(null);
      return;
    }
    setFile(chosen);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a TC file to upload.');
      return;
    }
    await onConfirm(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Upload TC</h3>
            <p className="text-xs text-gray-500">
              {req.studentName} · Issues the certificate and sets the student inactive (record kept).
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <label className="block text-xs font-medium text-gray-500">
          TC file
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="mt-1 block w-full text-sm text-gray-700"
          />
        </label>
        {file ? (
          <p className="mt-2 text-sm text-gray-700">
            {file.name}{' '}
            <span className="text-xs text-gray-400">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-400">PDF or scanned image up to 10 MB.</p>
        )}
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !file}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy ? 'Uploading…' : 'Upload & Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}

function NewTcModal({ onClose, onCreated }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [students, setStudents] = useState([]);
  const [studentClassId, setStudentClassId] = useState('');
  const [reason, setReason] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getClasses();
        if (cancelled) return;
        const list = data.classes || [];
        setClasses(list);
        if (list[0]) {
          setClassId(list[0].id);
          setSectionId(list[0].sections?.[0]?.id || '');
        }
      } catch (err) {
        showToast(networkErrorMessage(err) || 'Could not load classes', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClass = classes.find((c) => c.id === classId);
  const sections = selectedClass?.sections || [];

  useEffect(() => {
    if (!sectionId) {
      setStudents([]);
      setStudentClassId('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingStudents(true);
      try {
        const data = await getStudents({ sectionId });
        if (cancelled) return;
        setStudents(data.students || []);
        setStudentClassId('');
      } catch (err) {
        if (!cancelled) {
          setStudents([]);
          showToast(networkErrorMessage(err) || 'Could not load students', 'error');
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!studentClassId) {
      showToast('Select a student', 'error');
      return;
    }
    setSaving(true);
    try {
      await createTcRequest({
        studentClassId,
        reason: reason.trim() || 'Staff-created TC request',
        source: 'STAFF',
      });
      await onCreated();
    } catch (err) {
      showToast(networkErrorMessage(err) || err.message || 'Could not create request', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">New TC Request</h3>
            <p className="text-xs text-gray-500">Creates a request in Requested status for teacher verification.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-500">
            Class
            <select
              value={classId}
              onChange={(e) => {
                const next = e.target.value;
                setClassId(next);
                const cls = classes.find((c) => c.id === next);
                setSectionId(cls?.sections?.[0]?.id || '');
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Section
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Student
            <select
              value={studentClassId}
              onChange={(e) => setStudentClassId(e.target.value)}
              disabled={loadingStudents}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">{loadingStudents ? 'Loading…' : 'Select student'}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  Roll {s.rollNo ?? s.roll} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Moving to another city"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create request'}
          </button>
        </div>
      </form>
    </div>
  );
}
