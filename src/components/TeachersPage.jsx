import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  School,
  Search,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import {
  createTeacher,
  deleteTeacher,
  getTeachers,
  updateTeacher,
} from '../services/teacherService.js';
import { SCHOOL_GRADES, formatClassLabel, compareClassNames } from '../data/schoolGrades.js';
import { exportTablePdfReport } from '../services/reportService.js';
import { canManageTeachers } from '../data/navItems.js';

const PAGE_SIZE = 8;
const STAFF_TABS = [
  { id: 'all', label: 'All Staff' },
  { id: 'teaching', label: 'Teaching Staff' },
  { id: 'non-teaching', label: 'Non-Teaching Staff' },
];

const ROLES = [
  'Class Teacher',
  'Subject Teacher',
  'Librarian',
  'Admin Staff',
  'Accountant',
  'Office Assistant',
  'Support Staff',
];

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Other'];

const emptyForm = () => ({
  name: '',
  email: '',
  employeeId: '',
  phone: '',
  staffType: 'teaching',
  role: 'Subject Teacher',
  subjects: '',
  classesAssigned: '',
  status: 'Active',
  dob: '',
  gender: 'Female',
  address: '',
  joinDate: '',
});

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDob(value) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StaffStatusBadge({ status }) {
  const s = status || 'Active';
  const onLeave = s === 'On Leave';
  const inactive = s === 'Inactive';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
        onLeave
          ? 'bg-amber-50 text-amber-800 ring-amber-200'
          : inactive
            ? 'bg-gray-100 text-gray-600 ring-gray-200'
            : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      }`}
    >
      {s}
    </span>
  );
}

function staffRoleChip(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('class teacher')) return 'bg-violet-100 text-violet-800';
  if (r.includes('subject teacher')) return 'bg-sky-100 text-sky-800';
  if (r.includes('admin')) return 'bg-emerald-100 text-emerald-800';
  return 'bg-gray-100 text-gray-700';
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent || 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value || '—'}</p>
    </div>
  );
}

function inputClass() {
  return 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
}

/** Pull class grades from a teacher classesAssigned string like "1-A, UKG-B". */
function classGradesFromAssigned(classesAssigned) {
  if (!classesAssigned) return [];
  return String(classesAssigned)
    .split(/[,;/|]+/)
    .map((part) =>
      part
        .trim()
        .replace(/^class\s+/i, '')
        .split(/[-–—]/)[0]
        ?.trim()
    )
    .filter(Boolean);
}

function teacherHasClass(classesAssigned, className) {
  if (!className) return true;
  return classGradesFromAssigned(classesAssigned).some(
    (grade) => String(grade).toUpperCase() === String(className).toUpperCase()
  );
}

export default function TeachersPage({ user, onAccessDenied }) {
  const allowed = canManageTeachers(user);
  const [teachers, setTeachers] = useState([]);
  const [summary, setSummary] = useState({
    teachingStaff: 0,
    nonTeachingStaff: 0,
    totalSubjects: 0,
    classesAssigned: 0,
    leavesToday: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffTab, setStaffTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [drawer, setDrawer] = useState(null); // 'add' | 'edit' | 'details' | null
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [leaveForm, setLeaveForm] = useState({
    from: '',
    to: '',
    type: 'Casual Leave',
    reason: '',
  });
  const [leaveMsg, setLeaveMsg] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const staffListRef = useRef(null);

  const reload = async () => {
    if (!canManageTeachers(user)) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTeachers();
      setTeachers(data.teachers || []);
      setSummary(
        data.summary || {
          teachingStaff: 0,
          nonTeachingStaff: 0,
          totalSubjects: 0,
          classesAssigned: 0,
          leavesToday: 0,
          total: 0,
        }
      );
    } catch (err) {
      const msg = err.message || 'Failed to load staff';
      if (/forbidden/i.test(msg)) {
        onAccessDenied?.();
        return;
      }
      setTeachers([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) {
      onAccessDenied?.();
      return;
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when allowed
  }, [allowed]);

  const classOptions = useMemo(() => {
    const fromTeachers = new Set();
    for (const t of teachers) {
      for (const grade of classGradesFromAssigned(t.classesAssigned)) {
        fromTeachers.add(grade);
      }
    }
    const merged = new Set([...SCHOOL_GRADES, ...fromTeachers]);
    return [...merged].sort(compareClassNames);
  }, [teachers]);

  const filtered = useMemo(() => {
    let list = teachers;
    if (staffTab === 'teaching') list = list.filter((t) => t.staffType === 'teaching');
    if (staffTab === 'non-teaching') list = list.filter((t) => t.staffType === 'non-teaching');

    if (roleFilter) list = list.filter((t) => t.role === roleFilter);
    if (classFilter) list = list.filter((t) => teacherHasClass(t.classesAssigned, classFilter));
    if (statusFilter) list = list.filter((t) => t.status === statusFilter);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        [t.name, t.email, t.employeeId, t.role, t.subjects, t.classesAssigned]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return list;
  }, [teachers, staffTab, roleFilter, classFilter, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [staffTab, searchQuery, roleFilter, classFilter, statusFilter]);

  const openAdd = () => {
    const nextNum = teachers.length + 1;
    setForm({
      ...emptyForm(),
      employeeId: `EMP${String(nextNum).padStart(3, '0')}`,
    });
    setFormError('');
    setSelected(null);
    setDrawer('add');
  };

  const openEdit = (t) => {
    setSelected(t);
    setForm({
      name: t.name || '',
      email: t.email || '',
      employeeId: t.employeeId || '',
      phone: t.phone || '',
      staffType: t.staffType || 'teaching',
      role: t.role || 'Subject Teacher',
      subjects: t.subjects || '',
      classesAssigned: t.classesAssigned || '',
      status: t.status || 'Active',
      dob: t.dob || '',
      gender: t.gender || 'Female',
      address: t.address || '',
      joinDate: t.joinDate || '',
    });
    setFormError('');
    setDrawer('edit');
  };

  const openDetails = (t) => {
    setSelected(t);
    setDrawer('details');
  };

  const closeDrawer = () => {
    setDrawer(null);
    setFormError('');
    setSaving(false);
  };

  const setFormField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!form.email.trim()) {
      setFormError('Email is required');
      return;
    }
    if (!form.employeeId.trim()) {
      setFormError('Employee ID is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        employeeId: form.employeeId.trim(),
        phone: form.phone.trim() || null,
        staffType: form.staffType,
        role: form.role,
        subjects: form.subjects.trim() || null,
        classesAssigned: form.classesAssigned.trim() || null,
        status: form.status,
        dob: form.dob || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
        joinDate: form.joinDate || null,
      };

      if (drawer === 'add') {
        await createTeacher(payload);
      } else if (drawer === 'edit' && selected) {
        await updateTeacher(selected.id, payload);
      }
      closeDrawer();
      await reload();
    } catch (err) {
      setFormError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Remove ${t.name} from the staff directory?`)) return;
    try {
      await deleteTeacher(t.id);
      if (selected?.id === t.id) closeDrawer();
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    const list = filtered.length ? filtered : teachers;
    if (!list.length) {
      setActionNotice('No staff to export.');
      return;
    }
    setActionNotice('');
    const headers = [
      'Employee ID',
      'Name',
      'Email',
      'Phone',
      'Staff Type',
      'Role',
      'Subjects',
      'Classes Assigned',
      'Status',
    ];
    const rows = list.map((t) => [
      t.employeeId,
      t.name,
      t.email,
      t.phone || '',
      t.staffType,
      t.role,
      t.subjects || '',
      t.classesAssigned || '',
      t.status,
    ]);
    try {
      exportTablePdfReport({
        title: 'STAFF DIRECTORY',
        pill: 'Staff',
        headers,
        rows,
      });
      setActionNotice('Print dialog opened — choose Save as PDF.');
    } catch (err) {
      setError(err.message || 'Failed to export directory');
    }
  };

  const handleViewTeachingStaff = () => {
    setStaffTab('teaching');
    setSearchQuery('');
    setRoleFilter('');
    setClassFilter('');
    setStatusFilter('');
    setPage(1);
    setActionNotice('Showing teaching staff.');
    requestAnimationFrame(() => {
      staffListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleApplyLeave = (e) => {
    e.preventDefault();
    if (!leaveForm.from || !leaveForm.to) {
      setLeaveMsg('Please choose from and to dates.');
      return;
    }
    setLeaveMsg('Leave request submitted (demo).');
    setLeaveForm({ from: '', to: '', type: 'Casual Leave', reason: '' });
  };

  if (!allowed) return null;

  const mobileStats = [
    { label: 'Teaching Staff', value: loading ? '—' : summary.teachingStaff, icon: Users, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', cardBg: 'bg-violet-50/80' },
    { label: 'Non-Teaching Staff', value: loading ? '—' : summary.nonTeachingStaff, icon: UserRound, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', cardBg: 'bg-sky-50/80' },
    { label: 'Total Subjects', value: loading ? '—' : summary.totalSubjects, icon: BookOpen, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', cardBg: 'bg-emerald-50/80' },
    { label: 'Classes Assigned', value: loading ? '—' : summary.classesAssigned, icon: School, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', cardBg: 'bg-amber-50/80' },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-4 lg:hidden">
        <div className="grid grid-cols-2 gap-3">
          {mobileStats.map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border border-white/80 ${card.cardBg} p-3.5 shadow-sm`}
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
                <card.icon size={18} className={card.iconColor} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          {STAFF_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStaffTab(tab.id)}
              className={`flex-1 rounded-full px-1 py-2 text-[11px] font-semibold transition-colors ${
                staffTab === tab.id ? 'bg-[#1e3a8a] text-white' : 'text-[#1e3a8a]'
              }`}
            >
              {tab.label.replace(' Staff', '')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, ID…"
              className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-[#1e3a8a] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowMobileFilters((v) => !v)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${
              showMobileFilters ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white' : 'border-gray-200 bg-white text-gray-600'
            }`}
            aria-label="Filters"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {showMobileFilters ? (
          <div className="grid grid-cols-3 gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs"
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs"
            >
              <option value="">All Classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>{formatClassLabel(c)}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        ) : null}

        {actionNotice ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {actionNotice}
          </p>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Staff Directory</h3>
          <button
            type="button"
            onClick={handleExport}
            disabled={!filtered.length}
            className="text-xs font-semibold text-[#1e3a8a] disabled:opacity-40"
          >
            Export PDF
          </button>
        </div>

        <ul className="space-y-2.5">
          {loading ? (
            <li className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
              Loading staff…
            </li>
          ) : null}
          {!loading && pageRows.length === 0 ? (
            <li className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
              No staff members found.
            </li>
          ) : null}
          {!loading &&
            pageRows.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openDetails(t)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-3 text-left shadow-sm active:scale-[0.99]"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                    {initials(t.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="truncate text-xs text-gray-500">{t.email}</p>
                    <span className={`mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${staffRoleChip(t.role)}`}>
                      {t.role}
                    </span>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-gray-300" />
                </button>
              </li>
            ))}
        </ul>

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 text-sm text-gray-600">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}

        {!drawer ? (
          <button
            type="button"
            onClick={openAdd}
            className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a8a] text-white shadow-lg lg:hidden"
            aria-label="Add staff"
          >
            <Plus size={24} />
          </button>
        ) : null}
      </div>

      <div className="hidden space-y-4 lg:block">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Teaching Staff"
          value={loading ? '—' : summary.teachingStaff}
          accent="text-indigo-700"
        />
        <StatCard
          label="Non-Teaching Staff"
          value={loading ? '—' : summary.nonTeachingStaff}
          accent="text-violet-700"
        />
        <StatCard label="Total Subjects" value={loading ? '—' : summary.totalSubjects} />
        <StatCard label="Classes Assigned" value={loading ? '—' : summary.classesAssigned} />
        <StatCard
          label="Leaves Today"
          value={loading ? '—' : summary.leavesToday}
          accent="text-amber-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        <div ref={staffListRef} className="space-y-4 min-w-0">
          {actionNotice ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {actionNotice}
            </p>
          ) : null}
          {/* Tabs + toolbar */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3">
              {STAFF_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStaffTab(tab.id)}
                  className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    staffTab === tab.id
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, email, employee ID…"
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">All Roles</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Class</label>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="min-w-[130px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">All Classes</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      {formatClassLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="min-w-[120px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!filtered.length}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download size={16} />
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={openAdd}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                  <Plus size={16} />
                  Add Staff
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Subjects</th>
                    <th className="px-4 py-3">Classes</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        Loading staff…
                      </td>
                    </tr>
                  )}
                  {!loading && pageRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        No staff members found.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    pageRows.map((t) => (
                      <tr key={t.id} className="hover:bg-indigo-50/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                              {initials(t.name)}
                            </span>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => openDetails(t)}
                                className="block truncate text-left font-semibold text-gray-900 hover:text-indigo-700"
                              >
                                {t.name}
                              </button>
                              <p className="truncate text-xs text-gray-500">{t.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">{t.employeeId}</td>
                        <td className="px-4 py-3 text-gray-700">{t.role}</td>
                        <td className="px-4 py-3 text-gray-600">{t.subjects || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{t.classesAssigned || '—'}</td>
                        <td className="px-4 py-3">
                          <StaffStatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="View"
                              onClick={() => openDetails(t)}
                              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => openEdit(t)}
                              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => handleDelete(t)}
                              className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
              <p>
                {filtered.length === 0
                  ? '0 staff'
                  : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                      currentPage * PAGE_SIZE,
                      filtered.length
                    )} of ${filtered.length}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs font-medium text-gray-500">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Quick Actions</h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={openAdd}
                className="flex w-full items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"
              >
                <UserPlus size={16} />
                Add Staff
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('leave-form-widget')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <CalendarDays size={16} />
                Apply Leave
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FileText size={16} />
                Export Directory
              </button>
              <button
                type="button"
                onClick={handleViewTeachingStaff}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Users size={16} />
                View Teaching Staff
              </button>
            </div>
          </div>

          <div
            id="leave-form-widget"
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <ClipboardList size={16} className="text-indigo-600" />
              Apply Leave
            </h3>
            <form onSubmit={handleApplyLeave} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-gray-500">From</span>
                  <input
                    type="date"
                    value={leaveForm.from}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, from: e.target.value }))}
                    className={inputClass()}
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-gray-500">To</span>
                  <input
                    type="date"
                    value={leaveForm.to}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, to: e.target.value }))}
                    className={inputClass()}
                  />
                </label>
              </div>
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-gray-500">Leave Type</span>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm((p) => ({ ...p, type: e.target.value }))}
                  className={inputClass()}
                >
                  {LEAVE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {lt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-gray-500">Reason</span>
                <textarea
                  rows={2}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Brief reason…"
                  className={inputClass()}
                />
              </label>
              {leaveMsg && (
                <p className="text-xs text-indigo-700">{leaveMsg}</p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Submit Leave
              </button>
            </form>
          </div>
        </aside>
      </div>
      </div>

      {/* Drawer: add / edit / details */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button type="button" className="flex-1" aria-label="Close" onClick={closeDrawer} />
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">
                {drawer === 'add' && 'Add Staff'}
                {drawer === 'edit' && 'Edit Staff'}
                {drawer === 'details' && 'Staff Profile'}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {drawer === 'details' && selected && (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-700">
                      {initials(selected.name)}
                    </span>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{selected.name}</p>
                      <p className="text-sm text-gray-500">{selected.email}</p>
                      <div className="mt-1">
                        <StaffStatusBadge status={selected.status} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Employee ID" value={selected.employeeId} />
                    <Field label="Role" value={selected.role} />
                    <Field label="Staff Type" value={selected.staffType} />
                    <Field label="Subjects" value={selected.subjects} />
                    <Field label="Classes" value={selected.classesAssigned} />
                    <Field label="Phone" value={selected.phone} />
                    <Field label="Gender" value={selected.gender} />
                    <Field label="Date of Birth" value={formatDob(selected.dob)} />
                    <Field label="Join Date" value={formatDob(selected.joinDate)} />
                  </div>
                  <Field label="Address" value={selected.address} />
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => openEdit(selected)}
                      className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selected)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {(drawer === 'add' || drawer === 'edit') && (
                <form id="teacher-form" onSubmit={handleSave} className="space-y-3">
                  {formError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError}
                    </div>
                  )}
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-gray-500">Full Name *</span>
                    <input
                      value={form.name}
                      onChange={(e) => setFormField('name', e.target.value)}
                      className={inputClass()}
                      required
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-gray-500">Email *</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setFormField('email', e.target.value)}
                      className={inputClass()}
                      required
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-gray-500">Employee ID *</span>
                      <input
                        value={form.employeeId}
                        onChange={(e) => setFormField('employeeId', e.target.value)}
                        className={inputClass()}
                        required
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-gray-500">Phone</span>
                      <input
                        value={form.phone}
                        onChange={(e) => setFormField('phone', e.target.value)}
                        className={inputClass()}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-gray-500">Staff Type</span>
                      <select
                        value={form.staffType}
                        onChange={(e) => setFormField('staffType', e.target.value)}
                        className={inputClass()}
                      >
                        <option value="teaching">Teaching</option>
                        <option value="non-teaching">Non-Teaching</option>
                      </select>
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-gray-500">Status</span>
                      <select
                        value={form.status}
                        onChange={(e) => setFormField('status', e.target.value)}
                        className={inputClass()}
                      >
                        <option value="Active">Active</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-gray-500">Role</span>
                    <select
                      value={form.role}
                      onChange={(e) => setFormField('role', e.target.value)}
                      className={inputClass()}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-gray-500">Subjects</span>
                    <input
                      value={form.subjects}
                      onChange={(e) => setFormField('subjects', e.target.value)}
                      placeholder="e.g. English, Maths"
                      className={inputClass()}
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-gray-500">Classes Assigned</span>
                    <input
                      value={form.classesAssigned}
                      onChange={(e) => setFormField('classesAssigned', e.target.value)}
                      placeholder="e.g. 1-A, 2-B"
                      className={inputClass()}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-gray-500">Date of Birth</span>
                      <input
                        type="date"
                        value={form.dob}
                        onChange={(e) => setFormField('dob', e.target.value)}
                        className={inputClass()}
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-gray-500">Join Date</span>
                      <input
                        type="date"
                        value={form.joinDate}
                        onChange={(e) => setFormField('joinDate', e.target.value)}
                        className={inputClass()}
                      />
                    </label>
                  </div>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-gray-500">Gender</span>
                    <select
                      value={form.gender}
                      onChange={(e) => setFormField('gender', e.target.value)}
                      className={inputClass()}
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-gray-500">Address</span>
                    <textarea
                      rows={2}
                      value={form.address}
                      onChange={(e) => setFormField('address', e.target.value)}
                      className={inputClass()}
                    />
                  </label>
                </form>
              )}
            </div>

            {(drawer === 'add' || drawer === 'edit') && (
              <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="teacher-form"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : drawer === 'add' ? 'Add Staff' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
