import { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  clearHomeworkAssignments,
  listHomeworkAssignments,
} from '../services/homeworkService.js';
import { SUBJECT_STYLES } from '../data/timetableData.js';
import { showToast } from '../services/toast.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function subjectDisplay(name) {
  if (!name) return '—';
  return name === 'Maths' ? 'Mathematics' : name;
}

function subjectIconClass(subject) {
  const style = SUBJECT_STYLES[subject];
  if (style) return style;
  return 'bg-violet-100 text-violet-900 border-violet-200';
}

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return null;
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(hw) {
  const name = hw.attachmentName || '';
  const mime = (hw.attachmentMime || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop().toUpperCase() : '';
  if (mime.includes('pdf') || ext === 'PDF') return 'PDF Document';
  if (mime.includes('word') || ext === 'DOC' || ext === 'DOCX') return 'Word Document';
  if (mime.startsWith('image/') || ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(ext)) {
    return 'Image';
  }
  return ext ? `${ext} File` : 'Document';
}

function attachmentMetaLine(hw) {
  const type = fileTypeLabel(hw);
  const size = formatBytes(hw.attachmentSize);
  return size ? `${type} · ${size}` : type;
}

function openAttachment(hw, { download = false } = {}) {
  if (!hw.attachmentDataUrl && !hw.attachmentName) {
    showToast('No attachment on this homework', 'info');
    return;
  }
  if (!hw.attachmentDataUrl) {
    showToast('Attachment preview not available for this entry. Re-assign with the file to enable View / Download.', 'info');
    return;
  }
  if (download) {
    const a = document.createElement('a');
    a.href = hw.attachmentDataUrl;
    a.download = hw.attachmentName || 'homework-attachment';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const win = window.open(hw.attachmentDataUrl, '_blank', 'noopener,noreferrer');
  if (!win) showToast('Pop-up blocked — allow pop-ups to view the file', 'error');
}

function MetaField({ label, value }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value || '—'}</p>
    </div>
  );
}

function HomeworkCard({ hw, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasAttachment = Boolean(hw.attachmentName);

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5"
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${subjectIconClass(hw.subject)}`}
        >
          <BookOpen size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">
            {subjectDisplay(hw.subject)}
            <span className="mx-1.5 text-indigo-300">•</span>
            <span className="font-semibold text-indigo-500">{hw.classLabel || '—'}</span>
          </p>
          <h3 className="mt-0.5 truncate text-base font-bold text-gray-900">
            {hw.title || 'Untitled homework'}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1 text-xs font-semibold text-amber-700 sm:inline-flex">
            <Calendar size={13} /> Due {formatDate(hw.dueDate)}
          </span>
          <span className="text-gray-400">
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-gray-100 px-4 pb-5 pt-4 sm:px-5">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Details
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                <MetaField label="Title" value={hw.title} />
                <MetaField label="Subject" value={subjectDisplay(hw.subject)} />
                <MetaField label="Class / Section" value={hw.classLabel} />
                <MetaField label="Due Date" value={formatDate(hw.dueDate)} />
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Instructions (Optional)
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {hw.description?.trim() || 'No instructions provided.'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Attachment
            </p>
            {hasAttachment ? (
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {hw.attachmentName}
                    </p>
                    <p className="text-xs text-gray-500">{attachmentMetaLine(hw)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openAttachment(hw, { download: false })}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 sm:flex-none"
                  >
                    <Eye size={15} /> View
                  </button>
                  <button
                    type="button"
                    onClick={() => openAttachment(hw, { download: true })}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 sm:flex-none"
                  >
                    <Download size={15} /> Download
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No attachment for this homework.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function HomeworkListPage({ onAssign }) {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const items = useMemo(() => listHomeworkAssignments(), [tick]);

  const subjects = useMemo(() => {
    const set = new Set(items.map((h) => h.subject).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((hw) => {
      if (subjectFilter !== 'All' && hw.subject !== subjectFilter) return false;
      if (!q) return true;
      const hay = [
        hw.title,
        hw.subject,
        subjectDisplay(hw.subject),
        hw.classLabel,
        hw.description,
        hw.attachmentName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, subjectFilter]);

  const clearAll = () => {
    clearHomeworkAssignments();
    setTick((t) => t + 1);
    showToast('Homework list cleared', 'info');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Homework List</h2>
          <p className="text-sm text-gray-500">Assignments you have given to your classes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 size={14} /> Clear all
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAssign}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Plus size={16} /> Assign Homework
          </button>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, subject, class…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => {
              const active = subjectFilter === s;
              const label = s === 'All' ? 'All' : subjectDisplay(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubjectFilter(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <BookOpen className="mx-auto mb-3 text-indigo-400" size={32} />
          <p className="font-semibold text-gray-800">No homework assigned yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Use Assign Homework to create your first assignment.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No homework matches your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((hw, i) => (
            <HomeworkCard key={hw.id} hw={hw} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
