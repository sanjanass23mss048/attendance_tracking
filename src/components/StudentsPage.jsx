import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { canBulkImportStudents } from '../data/navItems.js';
import {
  createStudent,
  getStudents,
  updateStudent,
} from '../services/studentService.js';
import { exportTablePdfReport } from '../services/reportService.js';
import StudentDocumentsPanel from './StudentDocumentsPanel.jsx';

const PAGE_SIZE = 10;
const DETAIL_TABS = ['Profile', 'Attendance', 'Leave Letters', 'Guardian'];

const emptyForm = () => ({
  name: '',
  rollNo: '',
  admissionNo: '',
  parentPhone: '',
  address: '',
  dob: '',
  gender: 'Male',
  status: 'Active',
  className: '',
  sectionName: '',
  bloodGroup: '',
  nationality: 'Indian',
  motherName: '',
  fatherName: '',
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

function StatusBadge({ status }) {
  const active = (status || 'Active') === 'Active';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
      }`}
    >
      {status || 'Active'}
    </span>
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

function selectClass() {
  return inputClass();
}

export default function StudentsPage({ user = null, onNavigate } = {}) {
  const canImport = canBulkImportStudents(user);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('1');
  const [selectedSection, setSelectedSection] = useState('A');
  const [students, setStudents] = useState([]);
  const [sectionMeta, setSectionMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);

  const [drawer, setDrawer] = useState(null); // 'add' | 'details' | 'edit' | null
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailTab, setDetailTab] = useState('Profile');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const panelRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const el = panelRef.current;
      setIsFullscreen(Boolean(el && document.fullscreenElement === el));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = panelRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
        await el.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen unavailable:', err);
      alert('Fullscreen is not available in this browser.');
    }
  }, []);

  const sections =
    classes.find((c) => String(c.name) === String(selectedClass))?.sections || [];

  const reloadStudents = async () => {
    if (!selectedClass || !selectedSection) return;
    setLoading(true);
    setError('');
    try {
      const data = await getStudents({ class: selectedClass, section: selectedSection });
      setStudents(data.students || []);
      setSectionMeta(data.section || null);
    } catch (err) {
      setStudents([]);
      setSectionMeta(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getClasses()
      .then((data) => {
        setClasses(data.classes || []);
        if (data.classes?.[0]) {
          setSelectedClass(data.classes[0].name);
          setSelectedSection(data.classes[0].sections?.[0]?.name || 'A');
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedClass || !selectedSection) return undefined;
    setLoading(true);
    setError('');
    setPage(1);
    getStudents({ class: selectedClass, section: selectedSection })
      .then((data) => {
        if (cancelled) return;
        setStudents(data.students || []);
        setSectionMeta(data.section || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setStudents([]);
        setSectionMeta(null);
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClass, selectedSection]);

  const filtered = useMemo(() => {
    let list = students;
    if (statusFilter) {
      list = list.filter((s) => (s.status || 'Active') === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => {
      const hay = [
        s.name,
        String(s.rollNo ?? s.roll ?? ''),
        s.admissionNo || '',
        s.parentPhone || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [students, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const openAdd = () => {
    setForm({
      ...emptyForm(),
      className: selectedClass,
      sectionName: selectedSection,
      admissionNo: `ADM${selectedClass}${selectedSection}${String(students.length + 1).padStart(3, '0')}`,
      rollNo: String((students.reduce((m, s) => Math.max(m, Number(s.rollNo) || 0), 0) || 0) + 1),
    });
    setFormError('');
    setDrawer('add');
  };

  const openDetails = (student) => {
    setSelectedStudent(student);
    setDetailTab('Profile');
    setMenuOpenId(null);
    setDrawer('details');
  };

  const openEdit = (student) => {
    setSelectedStudent(student);
    setForm({
      name: student.name || '',
      rollNo: String(student.rollNo ?? student.roll ?? ''),
      admissionNo: student.admissionNo || '',
      parentPhone: student.parentPhone || '',
      address: student.address || '',
      dob: student.dob || '',
      gender: student.gender || 'Male',
      status: student.status || 'Active',
      className: selectedClass,
      sectionName: selectedSection,
      bloodGroup: student.bloodGroup || '',
      nationality: student.nationality || 'Indian',
      motherName: student.motherName || '',
      fatherName: student.fatherName || '',
    });
    setFormError('');
    setMenuOpenId(null);
    setDrawer('edit');
  };

  const closeDrawer = () => {
    setDrawer(null);
    setFormError('');
    setSaving(false);
  };

  const setFormField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Student name is required');
      return;
    }
    const rollNo = Number(form.rollNo);
    if (!Number.isInteger(rollNo) || rollNo < 1) {
      setFormError('Valid roll number is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        rollNo,
        admissionNo: form.admissionNo.trim() || null,
        parentPhone: form.parentPhone.trim() || null,
        address: form.address.trim() || null,
        dob: form.dob || null,
        gender: form.gender || null,
        status: form.status || 'Active',
        bloodGroup: form.bloodGroup.trim() || null,
        nationality: form.nationality.trim() || 'Indian',
        motherName: form.motherName.trim() || null,
        fatherName: form.fatherName.trim() || null,
      };

      if (drawer === 'add') {
        const className = form.className || selectedClass;
        const sectionName = form.sectionName || selectedSection;
        const sameSection =
          String(className) === String(selectedClass) &&
          String(sectionName) === String(selectedSection);
        await createStudent({
          ...payload,
          class: className,
          section: sectionName,
          ...(sameSection && sectionMeta?.id ? { sectionId: sectionMeta.id } : {}),
        });
        if (!sameSection) {
          setSelectedClass(className);
          setSelectedSection(sectionName);
        } else {
          await reloadStudents();
        }
      } else if (drawer === 'edit' && selectedStudent) {
        const updated = await updateStudent(selectedStudent.id, payload);
        setSelectedStudent(updated.student);
        await reloadStudents();
      }
      closeDrawer();
    } catch (err) {
      setFormError(err.message || 'Failed to save student');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const headers = [
      'Roll No.',
      'Section',
      'Student Name',
      'Admission No.',
      'Date of Birth',
      'Gender',
      'Parent Name',
      'Parent Phone',
      'Address',
      'Blood Group',
      'Nationality',
      'Mother Name',
      'Father Name',
      'Class',
    ];
    const rows = filtered.map((s) => {
      const parentName = [s.fatherName, s.motherName].filter(Boolean).join(' / ');
      return [
        s.rollNo ?? s.roll ?? '',
        selectedSection,
        s.name || '',
        s.admissionNo || '',
        s.dob || '',
        s.gender || '',
        parentName,
        s.parentPhone || '',
        s.address || '',
        s.bloodGroup || '',
        s.nationality || '',
        s.motherName || '',
        s.fatherName || '',
        selectedClass,
      ];
    });
    exportTablePdfReport({
      title: 'STUDENT LIST',
      pill: `Class ${formatClassLabel(selectedClass)} · Sec ${selectedSection}`,
      dateLabel: `Class ${formatClassLabel(selectedClass)} · Section ${selectedSection}`,
      headers,
      rows,
    });
  };

  const formClassSections =
    classes.find((c) => String(c.name) === String(form.className))?.sections || [];

  return (
    <div className="space-y-4">
      <div
        ref={panelRef}
        className={`space-y-4 ${
          isFullscreen ? 'h-screen overflow-y-auto rounded-none border-0 bg-white p-4' : ''
        }`}
      >
      {/* Toolbar */}
      <div className="hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:block">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedClass(next);
                const secs = classes.find((c) => String(c.name) === next)?.sections || [];
                setSelectedSection(secs[0]?.name || 'A');
              }}
              className="min-w-[120px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  {formatClassLabel(c.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="min-w-[120px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.name}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, roll no. or admission no."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus size={16} />
              Add Student
            </button>
            {canImport && typeof onNavigate === 'function' && (
              <button
                type="button"
                onClick={() => onNavigate('student-import')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <FileSpreadsheet size={16} />
                Import Students
              </button>
            )}
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
              onClick={toggleFullscreen}
              className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm hover:border-indigo-200 hover:text-indigo-600"
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Roll No.</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Admission No.</th>
                <th className="px-4 py-3">Date of Birth</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    Loading students…
                  </td>
                </tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No students found.
                  </td>
                </tr>
              )}
              {!loading &&
                pageRows.map((s) => (
                  <tr key={s.id} className="hover:bg-indigo-50/40">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.rollNo ?? s.roll}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {initials(s.name)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openDetails(s)}
                          className="text-left font-semibold text-gray-900 hover:text-indigo-700"
                        >
                          {s.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.admissionNo || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDob(s.dob)}</td>
                    <td className="px-4 py-3 text-gray-600">{s.gender || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.parentPhone || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="View"
                          onClick={() => openDetails(s)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => openEdit(s)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          title="More"
                          onClick={() => setMenuOpenId(menuOpenId === s.id ? null : s.id)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {menuOpenId === s.id && (
                          <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              onClick={() => openDetails(s)}
                            >
                              View profile
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              onClick={() => openEdit(s)}
                            >
                              Edit student
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
          <p>
            {filtered.length === 0
              ? '0 students'
              : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="px-2 text-xs font-medium text-gray-500">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-4 lg:hidden">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <GraduationCap size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1e3a8a]" />
            <select
              value={selectedClass}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedClass(next);
                const secs = classes.find((c) => String(c.name) === next)?.sections || [];
                setSelectedSection(secs[0]?.name || 'A');
              }}
              className="w-full appearance-none rounded-2xl border border-gray-200 bg-white py-2.5 pl-9 pr-7 text-sm font-semibold text-gray-800 shadow-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  {formatClassLabel(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="relative min-w-0 flex-1">
            <Users size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1e3a8a]" />
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-gray-200 bg-white py-2.5 pl-9 pr-7 text-sm font-semibold text-gray-800 shadow-sm"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.name}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowMobileFilters((v) => !v)}
            className={`flex h-11 shrink-0 items-center gap-1 rounded-2xl border px-3 text-xs font-semibold shadow-sm ${
              showMobileFilters || statusFilter
                ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filter
          </button>
        </div>

        {showMobileFilters ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm"
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        ) : null}

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, roll no. or admission no."
            className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-[#1e3a8a] focus:outline-none"
          />
        </div>

        <div className={`grid gap-2 ${canImport && typeof onNavigate === 'function' ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <button
            type="button"
            onClick={openAdd}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-violet-100 bg-violet-50 px-1 py-3 text-center shadow-sm"
          >
            <UserPlus size={18} className="text-violet-700" />
            <span className="text-[10px] font-semibold leading-tight text-violet-800">Add Student</span>
          </button>
          {canImport && typeof onNavigate === 'function' ? (
            <button
              type="button"
              onClick={() => onNavigate('student-import')}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-sky-100 bg-sky-50 px-1 py-3 text-center shadow-sm"
            >
              <FileSpreadsheet size={18} className="text-sky-700" />
              <span className="text-[10px] font-semibold leading-tight text-sky-800">Import</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleExport}
            disabled={!filtered.length}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-100 bg-emerald-50 px-1 py-3 text-center shadow-sm disabled:opacity-50"
          >
            <Download size={18} className="text-emerald-700" />
            <span className="text-[10px] font-semibold leading-tight text-emerald-800">Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setShowMobileMore((v) => !v)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-1 py-3 text-center shadow-sm"
          >
            <MoreHorizontal size={18} className="text-gray-600" />
            <span className="text-[10px] font-semibold leading-tight text-gray-700">More</span>
          </button>
        </div>

        {showMobileMore ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-sm"
          >
            {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500">Total Students</p>
            <p className="text-xl font-bold text-gray-900">{filtered.length} Students</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
            Active: {filtered.filter((s) => (s.status || 'Active') === 'Active').length}
          </span>
        </div>

        {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading…</p> : null}
        {!loading && pageRows.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
            No students found.
          </p>
        ) : null}
        {!loading &&
          pageRows.map((s) => {
            const active = (s.status || 'Active') === 'Active';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => openDetails(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-3 text-left shadow-sm active:scale-[0.99]"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800">
                  {s.rollNo ?? s.roll ?? '—'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{s.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    Admission No. {s.admissionNo || '—'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {active ? 'Active' : s.status || 'Inactive'}
                </span>
                <ChevronRight size={18} className="shrink-0 text-gray-300" />
              </button>
            );
          })}

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
            className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a8a] text-white shadow-lg"
            aria-label="Add student"
          >
            <Plus size={24} />
          </button>
        ) : null}
      </div>
      </div>

      {/* Backdrop */}
      {drawer && (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 z-40 bg-black/40"
          onClick={closeDrawer}
        />
      )}

      {/* Add / Edit drawer */}
      {(drawer === 'add' || drawer === 'edit') && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {drawer === 'add' ? 'Add New Student' : 'Edit Student'}
              </h3>
              <p className="text-xs text-gray-500">
                {formatClassLabel(form.className || selectedClass)} · Section {form.sectionName || selectedSection}
              </p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveStudent} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200">
                  <Camera size={22} />
                </span>
                <p className="text-xs text-gray-500">Photo placeholder</p>
              </div>

              {drawer === 'add' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Class</label>
                    <select
                      value={form.className}
                      onChange={(e) => {
                        const next = e.target.value;
                        const secs = classes.find((c) => String(c.name) === next)?.sections || [];
                        setForm((prev) => ({
                          ...prev,
                          className: next,
                          sectionName: secs[0]?.name || 'A',
                        }));
                      }}
                      className={selectClass()}
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.name}>
                          {formatClassLabel(c.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Section</label>
                    <select
                      value={form.sectionName}
                      onChange={(e) => setFormField('sectionName', e.target.value)}
                      className={selectClass()}
                    >
                      {formClassSections.map((s) => (
                        <option key={s.id} value={s.name}>
                          Section {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Student Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setFormField('name', e.target.value)}
                  className={inputClass()}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Roll No.</label>
                  <input
                    type="number"
                    min={1}
                    value={form.rollNo}
                    onChange={(e) => setFormField('rollNo', e.target.value)}
                    className={inputClass()}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Admission No.</label>
                  <input
                    type="text"
                    value={form.admissionNo}
                    onChange={(e) => setFormField('admissionNo', e.target.value)}
                    className={inputClass()}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Parent Phone</label>
                <input
                  type="tel"
                  value={form.parentPhone}
                  onChange={(e) => setFormField('parentPhone', e.target.value)}
                  className={inputClass()}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Address</label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setFormField('address', e.target.value)}
                  className={inputClass()}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => setFormField('dob', e.target.value)}
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setFormField('status', e.target.value)}
                    className={selectClass()}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Gender</label>
                <div className="flex gap-2">
                  {['Male', 'Female', 'Other'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setFormField('gender', g)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                        form.gender === g
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {g === 'Male' ? 'M' : g === 'Female' ? 'F' : 'Other'}
                    </button>
                  ))}
                </div>
              </div>

              {drawer === 'edit' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Blood Group</label>
                      <input
                        type="text"
                        value={form.bloodGroup}
                        onChange={(e) => setFormField('bloodGroup', e.target.value)}
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Nationality</label>
                      <input
                        type="text"
                        value={form.nationality}
                        onChange={(e) => setFormField('nationality', e.target.value)}
                        className={inputClass()}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Mother&apos;s Name</label>
                      <input
                        type="text"
                        value={form.motherName}
                        onChange={(e) => setFormField('motherName', e.target.value)}
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Father&apos;s Name</label>
                      <input
                        type="text"
                        value={form.fatherName}
                        onChange={(e) => setFormField('fatherName', e.target.value)}
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </>
              )}

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={closeDrawer}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : drawer === 'add' ? 'Save Student' : 'Save Changes'}
              </button>
            </div>
          </form>
        </aside>
      )}

      {/* Details drawer */}
      {drawer === 'details' && selectedStudent && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-base font-bold text-indigo-700">
                  {initials(selectedStudent.name)}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedStudent.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedStudent.status} />
                    <span className="text-xs text-gray-500">
                      Roll {selectedStudent.rollNo ?? selectedStudent.roll}
                      {selectedStudent.admissionNo ? ` · ${selectedStudent.admissionNo}` : ''}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
                    detailTab === tab
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {detailTab === 'Profile' && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Field label="Date of Birth" value={formatDob(selectedStudent.dob)} />
                <Field label="Gender" value={selectedStudent.gender} />
                <Field label="Parent Phone" value={selectedStudent.parentPhone} />
                <Field label="Blood Group" value={selectedStudent.bloodGroup} />
                <div className="col-span-2">
                  <Field label="Address" value={selectedStudent.address} />
                </div>
                <Field label="Nationality" value={selectedStudent.nationality} />
                <Field label="Class / Section" value={`${selectedClass}-${selectedSection}`} />
                <Field label="Mother's Name" value={selectedStudent.motherName} />
                <Field label="Father's Name" value={selectedStudent.fatherName} />
              </div>
            )}

            {detailTab === 'Attendance' && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-10 text-center">
                <User size={28} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700">Attendance history</p>
                <p className="mt-1 text-xs text-gray-500">
                  Period and daily attendance for this student will appear here.
                </p>
              </div>
            )}

            {detailTab === 'Leave Letters' && (
              <StudentDocumentsPanel
                studentRecordId={selectedStudent.studentRecordId}
                studentName={selectedStudent.name}
              />
            )}

            {detailTab === 'Guardian' && (
              <div className="space-y-4">
                <Field label="Mother's Name" value={selectedStudent.motherName} />
                <Field label="Father's Name" value={selectedStudent.fatherName} />
                <Field label="Parent Phone" value={selectedStudent.parentPhone} />
                <Field label="Address" value={selectedStudent.address} />
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={() => openEdit(selectedStudent)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Pencil size={16} />
              Edit Student
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
