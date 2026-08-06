import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CloudUpload,
  Download,
  Eye,
  Info,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import {
  DOCUMENT_TYPES,
  LEAVE_REASONS,
  LEAVE_STATUSES,
  deleteDocument,
  documentTypeLabel,
  downloadDocument,
  listDocuments,
  uploadDocument,
  viewDocument,
} from '../services/documentService.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatPeriod(from, to) {
  if (!from && !to) return '—';
  if (from && to && from === to) return formatDate(from);
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  return formatDate(from || to);
}

function StatusBadge({ status }) {
  const meta = LEAVE_STATUSES[status] || LEAVE_STATUSES.pending;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

const emptyForm = () => ({
  documentType: 'leave_letter',
  leaveFrom: '',
  leaveTo: '',
  reason: '',
  reasonOther: '',
  notes: '',
});

export default function StudentDocumentsPanel({ studentRecordId, studentName }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    if (!studentRecordId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { documents: list } = await listDocuments('student', studentRecordId);
      setDocuments(list);
    } catch (err) {
      setError(err.message || 'Could not load leave letters');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [studentRecordId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  function pickFile(next) {
    if (!next) return;
    if (next.size > 10 * 1024 * 1024) {
      setError('File must be 10 MB or smaller');
      return;
    }
    setFile(next);
    setError('');
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  function resetForm() {
    setForm(emptyForm());
    setFile(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentRecordId) return;
    if (!file) {
      setError('Please choose a leave letter file');
      return;
    }
    if (!form.leaveFrom || !form.leaveTo) {
      setError('From date and to date are required');
      return;
    }
    if (!form.reason.trim()) {
      setError('Reason for leave is required');
      return;
    }
    if (form.reason === 'Other' && !form.reasonOther.trim()) {
      setError('Please specify the reason for leave');
      return;
    }
    if (form.leaveFrom > form.leaveTo) {
      setError('To date must be on or after from date');
      return;
    }

    const reasonValue =
      form.reason === 'Other' ? form.reasonOther.trim() : form.reason.trim();

    setUploading(true);
    setError('');
    try {
      await uploadDocument({
        entityType: 'student',
        entityId: studentRecordId,
        documentType: form.documentType,
        file,
        leaveFrom: form.leaveFrom,
        leaveTo: form.leaveTo,
        reason: reasonValue,
        notes: form.notes.trim() || undefined,
      });
      resetForm();
      await load();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this leave letter submission?')) return;
    setError('');
    try {
      await deleteDocument(id);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  }

  function closePreview() {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function handleView(doc) {
    setError('');
    setPreviewLoadingId(doc.id);
    try {
      const result = await viewDocument(doc.id, {
        fileName: doc.fileName,
        mimeType: doc.mimeType,
      });
      if (result.url && result.previewKind) {
        setPreview({
          url: result.url,
          previewKind: result.previewKind,
          fileName: doc.fileName,
          documentId: doc.id,
        });
      }
    } catch (err) {
      setError(err.message || 'Could not open leave letter');
    } finally {
      setPreviewLoadingId(null);
    }
  }

  async function handleDownload(doc) {
    setError('');
    try {
      await downloadDocument(doc.id, doc.fileName);
    } catch (err) {
      setError(err.message || 'Download failed');
    }
  }

  if (!studentRecordId) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        Student record id missing — cannot upload leave letters.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-bold text-gray-900">Upload Leave Letter</h4>
        <p className="mt-0.5 text-xs text-gray-500">
          Submit a leave letter for {studentName || 'this student'} (class teacher upload).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
              dragOver
                ? 'border-indigo-400 bg-indigo-50/60'
                : 'border-gray-200 bg-gray-50/50'
            }`}
          >
            <CloudUpload size={32} className="text-indigo-400" />
            <p className="mt-2 text-sm font-medium text-gray-700">
              Drag and drop leave letter here
            </p>
            <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG · max 10 MB</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              Choose file
            </button>
            {file && (
              <p className="mt-2 max-w-full truncate text-xs font-medium text-gray-800">
                {file.name}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">What to include</p>
            <ul className="mt-2 space-y-1.5">
              <li>• Reason for leave</li>
              <li>• From and to dates</li>
              <li>• Parent / guardian letter (as received by school)</li>
              <li>• Contact number (optional)</li>
            </ul>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Leave type *</label>
            <select
              value={form.documentType}
              onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Reason for leave *</label>
            <select
              value={form.reason}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reason: e.target.value,
                  reasonOther: e.target.value === 'Other' ? f.reasonOther : '',
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Select reason</option>
              {LEAVE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {form.reason === 'Other' && (
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Specify *</label>
                <input
                  type="text"
                  value={form.reasonOther}
                  onChange={(e) => setForm((f) => ({ ...f, reasonOther: e.target.value }))}
                  placeholder="Enter reason"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">From date *</label>
            <input
              type="date"
              value={form.leaveFrom}
              onChange={(e) => setForm((f) => ({ ...f, leaveFrom: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">To date *</label>
            <input
              type="date"
              value={form.leaveTo}
              onChange={(e) => setForm((f) => ({ ...f, leaveTo: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Additional notes (optional)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Add any extra details…"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>
            Ensure the leave letter is clear and includes all required details.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {uploading && <Loader2 size={16} className="animate-spin" />}
            {uploading ? 'Uploading…' : 'Upload Leave Letter'}
          </button>
        </div>
      </form>

      <div>
        <h4 className="text-sm font-bold text-gray-900">Leave letter submissions</h4>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 size={18} className="animate-spin text-indigo-500" />
            Loading…
          </div>
        ) : documents.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-500">
            No submissions yet.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Leave type</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/80">
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {documentTypeLabel(doc.documentType)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">
                      {formatPeriod(doc.leaveFrom, doc.leaveTo)}
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5 text-gray-600" title={doc.reason || undefined}>
                      <span className="line-clamp-2">{doc.reason || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="View leave letter"
                          disabled={previewLoadingId === doc.id}
                          onClick={() => handleView(doc)}
                          className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                        >
                          {previewLoadingId === doc.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Download"
                          onClick={() => handleDownload(doc)}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => handleDelete(doc.id)}
                          className="rounded p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {preview.fileName || 'Leave letter'}
                </p>
                <p className="text-xs text-gray-500">Preview</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownload({
                      id: preview.documentId,
                      fileName: preview.fileName,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-gray-100">
              {preview.previewKind === 'image' ? (
                <div className="flex max-h-[75vh] items-center justify-center overflow-auto p-4">
                  <img
                    src={preview.url}
                    alt={preview.fileName || 'Leave letter'}
                    className="max-h-[70vh] max-w-full rounded-lg object-contain shadow"
                  />
                </div>
              ) : (
                <iframe
                  title={preview.fileName || 'Leave letter preview'}
                  src={preview.url}
                  className="h-[75vh] w-full border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
