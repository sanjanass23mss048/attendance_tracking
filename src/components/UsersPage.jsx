import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, UserPlus, X } from 'lucide-react';
import { canManageUsers } from '../data/navItems.js';
import { createUser, getUsers } from '../services/userService.js';
import { networkErrorMessage, showToast } from '../services/toast.js';

const ROLE_OPTIONS = [
  { id: 'ADMIN', label: 'Admin' },
  { id: 'INCHARGE', label: 'Incharge' },
  { id: 'TEACHER', label: 'Teacher' },
];

const ROLE_LABELS = {
  ADMIN: 'Admin',
  INCHARGE: 'Incharge',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
};

const emptyForm = () => ({
  name: '',
  email: '',
  role: 'TEACHER',
  phone: '',
});

function roleBadge(role) {
  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN') return 'bg-indigo-50 text-indigo-800 ring-indigo-200';
  if (r === 'INCHARGE') return 'bg-violet-50 text-violet-800 ring-violet-200';
  if (r === 'TEACHER') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (r === 'PARENT') return 'bg-amber-50 text-amber-800 ring-amber-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

export default function UsersPage({ user, onAccessDenied }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canManageUsers(user)) {
      onAccessDenied?.();
    }
  }, [user, onAccessDenied]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data.users || []);
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const role = String(u.role || '').toUpperCase();
      if (roleFilter !== 'ALL' && role !== roleFilter) return false;
      if (!q) return true;
      return [u.name, u.email, u.phone, u.role].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [users, query, roleFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        phone: form.phone.trim() || undefined,
      });
      const roleLabel = ROLE_LABELS[form.role] || 'User';
      showToast(`${roleLabel} account created with default password Initial1.`, 'success');
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Could not create user', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!canManageUsers(user)) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Users</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create Admin, Incharge, and Teacher login accounts. Parent accounts are created automatically when students are imported.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4" />
          Add user
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="ALL">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="INCHARGE">Incharge</option>
          <option value="TEACHER">Teacher</option>
          <option value="PARENT">Parent</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">No users match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.email}</td>
                    <td className="px-4 py-3 text-gray-600">{row.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${roleBadge(row.role)}`}>
                        {row.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Plus className="h-4 w-4 text-indigo-600" />
                New login account
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                New accounts use the default password <strong>Initial1</strong>.
                {form.role === 'TEACHER' || form.role === 'ADMIN' || form.role === 'INCHARGE' ? (
                  <> Staff accounts must change it on first login.</>
                ) : null}
                <span className="mt-1 block text-indigo-800/80">
                  Parent logins are not created here — they are added during student import using father/mother contact details.
                </span>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Role</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Phone (optional)</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
