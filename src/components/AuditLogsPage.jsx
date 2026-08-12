import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCw,
  ScrollText,
  Search,
  X,
} from 'lucide-react';
import { canViewAuditLogs } from '../data/navItems.js';
import {
  categoryBadgeClass,
  formatAuditWhen,
  listAuditLogs,
} from '../services/auditLogService.js';

const PAGE_SIZE = 40;

const EMPTY_FILTERS = {
  category: '',
  action: '',
  actor: '',
  q: '',
  from: '',
  to: '',
  success: '',
};

function toStartIso(dateStr) {
  if (!dateStr) return '';
  return `${dateStr}T00:00:00.000`;
}

function toEndIso(dateStr) {
  if (!dateStr) return '';
  return `${dateStr}T23:59:59.999`;
}

function actorLabel(log) {
  const name = log.actorName || log.actorEmail || log.actorUserId;
  if (!name) return 'System / unknown';
  const role = log.actorRole ? ` · ${log.actorRole}` : '';
  return `${name}${role}`;
}

export default function AuditLogsPage({ user, onAccessDenied }) {
  const allowed = canViewAuditLogs(user);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!allowed) onAccessDenied?.();
  }, [allowed, onAccessDenied]);

  const queryParams = useMemo(
    () => ({
      category: applied.category || undefined,
      action: applied.action || undefined,
      actor: applied.actor || undefined,
      q: applied.q || undefined,
      from: applied.from ? toStartIso(applied.from) : undefined,
      to: applied.to ? toEndIso(applied.to) : undefined,
      success: applied.success === '' ? undefined : applied.success,
      limit: PAGE_SIZE,
      offset,
    }),
    [applied, offset]
  );

  const load = useCallback(async () => {
    if (!canViewAuditLogs(user)) return;
    setLoading(true);
    setError('');
    try {
      const data = await listAuditLogs(queryParams);
      setLogs(data.logs || []);
      setTotal(data.total ?? 0);
      if (Array.isArray(data.categories) && data.categories.length) {
        setCategories(data.categories);
      }
    } catch (err) {
      const msg = err.message || 'Failed to load audit logs';
      if (/forbidden|unauthorized/i.test(msg)) {
        onAccessDenied?.();
        return;
      }
      setError(msg);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [user, onAccessDenied, queryParams]);

  useEffect(() => {
    if (!allowed) return undefined;
    load();
    return undefined;
  }, [load, allowed]);

  const applyFilters = (e) => {
    e?.preventDefault?.();
    setOffset(0);
    setApplied({ ...draft });
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setOffset(0);
  };

  const hasActiveFilters = Object.values(applied).some((v) => v !== '');
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  if (!allowed) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-700 p-6 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <ScrollText size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Audit Logs</h2>
            <p className="mt-1 text-sm text-slate-200">
              Who did what across attendance, notifications, notices, students, and more.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={applyFilters}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Filter size={16} className="text-slate-500" />
          Filters
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="block text-xs font-medium text-gray-600">
            Category
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Action
            <input
              type="text"
              placeholder="e.g. ATTENDANCE_SAVE_DAILY"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={draft.action}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Actor (name / email / id)
            <input
              type="text"
              placeholder="Who performed the action"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={draft.actor}
              onChange={(e) => setDraft((d) => ({ ...d, actor: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Keyword
            <div className="relative mt-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search summary, entity…"
                className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm"
                value={draft.q}
                onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              />
            </div>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            From date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            To date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Result
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
              value={draft.success}
              onChange={(e) => setDraft((d) => ({ ...d, success: e.target.value }))}
            >
              <option value="">All</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Filter size={14} />
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <X size={14} />
            Clear
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <span className="ml-auto text-xs text-gray-500">
            {total} event{total === 1 ? '' : 's'}
            {hasActiveFilters ? ' (filtered)' : ''}
          </span>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="animate-spin text-slate-500" size={18} />
          Loading audit logs…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
          No audit events match these filters yet. New actions will appear here automatically.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-3 w-8" />
                  <th className="px-3 py-3">When</th>
                  <th className="px-3 py-3">Who</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Summary</th>
                  <th className="px-3 py-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const open = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className="border-t border-gray-100 hover:bg-slate-50/80 cursor-pointer"
                        onClick={() => setExpandedId(open ? null : log.id)}
                      >
                        <td className="px-3 py-3 text-gray-400">
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                          {formatAuditWhen(log.createdOn)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">{actorLabel(log)}</div>
                          {log.actorEmail && log.actorName ? (
                            <div className="text-xs text-gray-500">{log.actorEmail}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${categoryBadgeClass(
                              log.category
                            )}`}
                          >
                            {log.category || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-700">
                          {log.action || '—'}
                        </td>
                        <td className="max-w-md px-3 py-3 text-gray-700">
                          <span className="line-clamp-2">{log.summary || '—'}</span>
                        </td>
                        <td className="px-3 py-3">
                          {log.success === false ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                              Failed
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="border-t border-gray-50 bg-slate-50/60">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-3 text-xs text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <div className="font-semibold text-gray-500">Actor user id</div>
                                <div className="mt-0.5 font-mono">{log.actorUserId || '—'}</div>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-500">Entity</div>
                                <div className="mt-0.5">
                                  {log.entityType || '—'}
                                  {log.entityId ? (
                                    <span className="font-mono"> · {log.entityId}</span>
                                  ) : null}
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-500">IP / User agent</div>
                                <div className="mt-0.5 break-all">
                                  {log.ipAddress || '—'}
                                  {log.userAgent ? (
                                    <div className="mt-1 line-clamp-2 text-gray-500">{log.userAgent}</div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            {log.details != null ? (
                              <div className="mt-3">
                                <div className="text-xs font-semibold text-gray-500">Details</div>
                                <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white p-3 text-[11px] leading-relaxed text-gray-800">
                                  {typeof log.details === 'string'
                                    ? log.details
                                    : JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
