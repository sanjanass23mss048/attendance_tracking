import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  FlaskConical,
  Globe,
  Languages,
  Leaf,
  Library,
  Monitor,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { formatClassLabel, SCHOOL_SECTIONS, compareClassNames } from '../data/schoolGrades.js';
import { getClasses } from '../services/classService.js';
import { getTeachers } from '../services/teacherService.js';
import { showToast } from '../services/toast.js';

const CATEGORIES = ['Language', 'Core', 'Primary', 'Skill', 'Activity'];
const BOOK_TYPES = ['Textbook', 'Workbook', 'Reference'];
const TEACHER_ROLES = ['Class Teacher', 'Subject Teacher'];
const TABS = [
  { id: 'syllabus', label: 'Syllabus' },
  { id: 'books', label: 'Books Assigned' },
  { id: 'teachers', label: 'Teachers Assigned' },
  { id: 'overview', label: 'Overview' },
];

const SUBJECT_ICONS = {
  English: BookOpen,
  Maths: Calculator,
  EVS: Leaf,
  Hindi: Languages,
  Computer: Monitor,
  Drawing: Palette,
  Games: Trophy,
  Library: Library,
  Science: FlaskConical,
  Social: Globe,
};

const SUBJECT_ACCENT = {
  English: {
    card: 'bg-sky-50 border-sky-100 text-sky-950',
    selected: 'bg-sky-100 border-sky-400 ring-1 ring-sky-300',
    icon: 'bg-sky-600',
  },
  Maths: {
    card: 'bg-violet-50 border-violet-100 text-violet-950',
    selected: 'bg-violet-100 border-violet-400 ring-1 ring-violet-300',
    icon: 'bg-violet-700',
  },
  EVS: {
    card: 'bg-emerald-50 border-emerald-100 text-emerald-950',
    selected: 'bg-emerald-100 border-emerald-300 ring-1 ring-emerald-300',
    icon: 'bg-emerald-600',
  },
  Hindi: {
    card: 'bg-rose-50 border-rose-100 text-rose-950',
    selected: 'bg-rose-100 border-rose-300 ring-1 ring-rose-300',
    icon: 'bg-rose-600',
  },
  Computer: {
    card: 'bg-orange-50 border-orange-100 text-orange-950',
    selected: 'bg-orange-100 border-orange-300 ring-1 ring-orange-300',
    icon: 'bg-orange-600',
  },
  Drawing: {
    card: 'bg-amber-50 border-amber-100 text-amber-950',
    selected: 'bg-amber-100 border-amber-300 ring-1 ring-amber-300',
    icon: 'bg-amber-500',
  },
  Games: {
    card: 'bg-lime-50 border-lime-100 text-lime-950',
    selected: 'bg-lime-100 border-lime-300 ring-1 ring-lime-300',
    icon: 'bg-lime-600',
  },
  Library: {
    card: 'bg-yellow-50 border-yellow-100 text-yellow-950',
    selected: 'bg-yellow-100 border-yellow-300 ring-1 ring-yellow-300',
    icon: 'bg-yellow-600',
  },
  Science: {
    card: 'bg-teal-50 border-teal-100 text-teal-950',
    selected: 'bg-teal-100 border-teal-300 ring-1 ring-teal-300',
    icon: 'bg-teal-600',
  },
  Social: {
    card: 'bg-indigo-50 border-indigo-100 text-indigo-950',
    selected: 'bg-indigo-100 border-indigo-300 ring-1 ring-indigo-300',
    icon: 'bg-indigo-600',
  },
};

const FALLBACK_ACCENT = {
  card: 'bg-slate-50 border-slate-100 text-slate-950',
  selected: 'bg-slate-100 border-slate-300 ring-1 ring-slate-300',
  icon: 'bg-violet-700',
};

const BOOK_TYPE_STYLES = {
  Textbook: 'bg-sky-100 text-sky-800',
  Workbook: 'bg-emerald-100 text-emerald-800',
  Reference: 'bg-violet-100 text-violet-800',
};

const MATHS_UNIT_COPY = [
  'Numbers up to 10,000',
  'Addition and Subtraction',
  'Multiplication and Division',
  'Fractions',
  'Geometry and Measurement',
];

function displayNameOf(name) {
  return name === 'Maths' ? 'Mathematics' : name;
}

function accentOf(name) {
  return SUBJECT_ACCENT[name] || FALLBACK_ACCENT;
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function codeFromName(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'SUB';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function scopeKey(subjectId, className, section) {
  return `${subjectId}::${className}::${section}`;
}

function fileSlug(label, className, section, unit) {
  const short = String(label).replace(/\s+/g, '');
  return `${short}_Unit${unit}_Class${className}${section}.pdf`;
}

function seedUnits(subject, className, section) {
  const label = displayNameOf(subject.name);
  return [1, 2, 3, 4, 5].map((unit) => ({
    id: `${subject.id}-${className}-${section}-u${unit}`,
    unit: `Unit ${unit}`,
    fileName: fileSlug(subject.code === 'MAT' ? 'Maths' : label, className, section, unit),
    description:
      subject.id.startsWith('maths') ? MATHS_UNIT_COPY[unit - 1] : `${label} — ${formatClassLabel(className)} Unit ${unit}`,
    uploadedBy: 'Admin User',
    uploadedAt: '12 May 2025',
    size: `${(1.1 + unit * 0.1).toFixed(1)} MB`,
  }));
}

function initialSubjects() {
  const defs = [
    { id: 'english-2', name: 'English', code: 'ENG', category: 'Language', className: '2' },
    { id: 'maths-2', name: 'Maths', code: 'MAT', category: 'Core', className: '2' },
    { id: 'evs-2', name: 'EVS', code: 'EVS', category: 'Primary', className: '2' },
    { id: 'hindi-2', name: 'Hindi', code: 'HIN', category: 'Language', className: '2' },
    { id: 'computer-2', name: 'Computer', code: 'CMP', category: 'Skill', className: '2' },
    { id: 'english-3', name: 'English', code: 'ENG', category: 'Language', className: '3' },
    { id: 'maths-3', name: 'Maths', code: 'MAT', category: 'Core', className: '3' },
    { id: 'evs-3', name: 'EVS', code: 'EVS', category: 'Primary', className: '3' },
    { id: 'hindi-3', name: 'Hindi', code: 'HIN', category: 'Language', className: '3' },
    { id: 'science-3', name: 'Science', code: 'SCI', category: 'Core', className: '3' },
    { id: 'social-3', name: 'Social', code: 'SST', category: 'Core', className: '3' },
    { id: 'drawing-3', name: 'Drawing', code: 'ART', category: 'Activity', className: '3' },
    { id: 'games-3', name: 'Games', code: 'PE', category: 'Activity', className: '3' },
    { id: 'library-3', name: 'Library', code: 'LIB', category: 'Activity', className: '3' },
    { id: 'computer-3', name: 'Computer', code: 'CMP', category: 'Skill', className: '3' },
  ];
  return defs;
}

function seedBooks(subject, className) {
  const label = displayNameOf(subject.name);
  const grade = formatClassLabel(className);
  if (subject.name === 'Maths') {
    return [
      { id: `${subject.id}-${className}-b1`, title: `Mathematics Textbook - ${grade}`, author: 'NCERT', type: 'Textbook' },
      { id: `${subject.id}-${className}-b2`, title: `Mathematics Workbook - ${grade}`, author: 'Oxford', type: 'Workbook' },
      { id: `${subject.id}-${className}-b3`, title: `Mental Maths - ${grade}`, author: 'R.S. Aggarwal', type: 'Reference' },
    ];
  }
  return [
    { id: `${subject.id}-${className}-b1`, title: `${label} Textbook - ${grade}`, author: 'NCERT', type: 'Textbook' },
  ];
}

function seedTeachers(subject, className, section) {
  if (subject.id.startsWith('maths') && className === '3') {
    return [
      {
        id: `mat-${className}-${section}-t1`,
        name: 'Ramesh Sharma',
        email: 'ramesh.sharma@school.edu',
        role: 'Class Teacher',
      },
      {
        id: `mat-${className}-${section}-t2`,
        name: 'Priya Sharma',
        email: 'priya.sharma@school.edu',
        role: 'Subject Teacher',
      },
      {
        id: `mat-${className}-${section}-t3`,
        name: 'Suresh Reddy',
        email: 'suresh.reddy@school.edu',
        role: 'Subject Teacher',
      },
    ];
  }
  return [];
}

function ensureScope(store, key, factory) {
  if (store[key]) return store;
  return { ...store, [key]: factory() };
}

const emptySubjectForm = (className = '2') => ({ name: '', code: '', category: 'Core', className });
const emptyBookForm = () => ({ title: '', author: '', type: 'Textbook' });
const emptySyllabusForm = () => ({ unit: '', description: '', fileName: '' });
const emptyTeacherForm = () => ({ teacherId: '', role: 'Subject Teacher' });

function inputClass() {
  return 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function RowMenu({ open, onToggle, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label="More actions"
      >
        <MoreVertical size={16} />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function TableWrap({ children, minWidth = '640px' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export default function SubjectsPage({ onNavigate }) {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [syllabus, setSyllabus] = useState({});
  const [books, setBooks] = useState({});
  const [assigned, setAssigned] = useState({});
  const [staff, setStaff] = useState([]);
  const [classesData, setClassesData] = useState([]);

  const [selectedId, setSelectedId] = useState('english-2');
  const [sidebarClass, setSidebarClass] = useState('2');
  const [section, setSection] = useState('A');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [activeTab, setActiveTab] = useState('syllabus');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [menuKey, setMenuKey] = useState(null);

  const [modal, setModal] = useState(null);
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [syllabusForm, setSyllabusForm] = useState(emptySyllabusForm);
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  const filterRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTeachers({ staffType: 'teaching' }), getClasses()])
      .then(([teacherData, classData]) => {
        if (cancelled) return;
        setStaff(teacherData.teachers || []);
        setClassesData(classData.classes || []);
      })
      .catch(() => {
        if (!cancelled) {
          setStaff([]);
          setClassesData([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showFilter) return undefined;
    const onDoc = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showFilter]);

  const selected = subjects.find((s) => s.id === selectedId) || null;
  const className = selected?.className || sidebarClass;
  const classOptions = useMemo(() => {
    const fromApi = classesData.length ? classesData.map((c) => c.name) : ['1', '2', '3', '4', '5'];
    const fromSubjects = subjects.map((s) => s.className).filter(Boolean);
    return [...new Set([...fromApi, ...fromSubjects])].sort(compareClassNames);
  }, [classesData, subjects]);
  const sectionOptions = useMemo(() => {
    const klass = classesData.find((c) => String(c.name) === String(className));
    const names = (klass?.sections || []).map((s) => s.name);
    return names.length ? names : SCHOOL_SECTIONS;
  }, [classesData, className]);

  const studentCount = useMemo(() => {
    const klass = classesData.find((c) => String(c.name) === String(className));
    const sec = klass?.sections?.find((s) => String(s.name) === String(section));
    return sec?.studentCount ?? 0;
  }, [classesData, className, section]);

  useEffect(() => {
    if (!sectionOptions.includes(section)) setSection(sectionOptions[0] || 'A');
  }, [sectionOptions, section]);

  useEffect(() => {
    const inClass = subjects.filter((s) => String(s.className) === String(sidebarClass));
    if (!inClass.length) {
      setSelectedId('');
      return;
    }
    const current = subjects.find((s) => s.id === selectedId);
    if (!current || String(current.className) !== String(sidebarClass)) {
      setSelectedId(inClass[0].id);
    }
  }, [sidebarClass, subjects, selectedId]);

  const key = selected ? scopeKey(selected.id, className, section) : '';

  useEffect(() => {
    if (!selected || !key) return;
    setSyllabus((prev) => ensureScope(prev, key, () => seedUnits(selected, className, section)));
    setBooks((prev) => ensureScope(prev, key, () => seedBooks(selected, className)));
    setAssigned((prev) => ensureScope(prev, key, () => seedTeachers(selected, className, section)));
  }, [selected, key, className, section]);

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subjects.filter((s) => {
      if (String(s.className) !== String(sidebarClass)) return false;
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (!q) return true;
      return `${s.name} ${displayNameOf(s.name)} ${s.code} ${s.category}`.toLowerCase().includes(q);
    });
  }, [subjects, sidebarClass, searchQuery, categoryFilter]);

  const units = key ? syllabus[key] || [] : [];
  const scopedBooks = key ? books[key] || [] : [];
  const scopedTeachers = key ? assigned[key] || [] : [];
  const accent = selected ? accentOf(selected.name) : FALLBACK_ACCENT;
  const Icon = selected ? SUBJECT_ICONS[selected.name] || BookOpen : BookOpen;
  const classSectionLabel = `${formatClassLabel(className)} - ${section}`;

  const selectSubject = (id) => {
    setSelectedId(id);
    setMobileShowDetail(true);
    setActiveTab('syllabus');
    setMenuKey(null);
  };

  const selectSidebarClass = (nextClass) => {
    setSidebarClass(nextClass);
    setSearchQuery('');
    setCategoryFilter('');
    setMobileShowDetail(false);
  };

  const openAddSubject = () => {
    setSubjectForm(emptySubjectForm(sidebarClass || classOptions[0] || '2'));
    setModal('add-subject');
  };

  const saveSubject = () => {
    const name = subjectForm.name.trim();
    if (!name) {
      showToast('Enter a subject name', 'error');
      return;
    }
    const subjectClass = String(subjectForm.className || '').trim();
    if (!subjectClass) {
      showToast('Select a class for this subject', 'error');
      return;
    }
    const code = (subjectForm.code.trim() || codeFromName(name)).toUpperCase();
    const category = subjectForm.category || 'Core';
    const duplicate = subjects.some(
      (s) =>
        s.id !== selected?.id &&
        String(s.className) === subjectClass &&
        s.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      showToast(`${name} already exists for ${formatClassLabel(subjectClass)}`, 'error');
      return;
    }
    if (modal === 'add-subject') {
      const id = nextId('sub');
      setSubjects((prev) => [...prev, { id, name, code, category, className: subjectClass }]);
      setSidebarClass(subjectClass);
      setSelectedId(id);
      setMobileShowDetail(true);
      showToast(`${name} added for ${formatClassLabel(subjectClass)}`, 'success');
    } else if (selected) {
      setSubjects((prev) =>
        prev.map((s) => (s.id === selected.id ? { ...s, name, code, category, className: subjectClass } : s))
      );
      setSidebarClass(subjectClass);
      showToast('Subject updated', 'success');
    }
    setModal(null);
  };

  const deleteSubject = () => {
    if (!selected) return;
    const id = selected.id;
    const label = displayNameOf(selected.name);
    const subjectClass = selected.className;
    const remaining = subjects.filter((s) => s.id !== id);
    setSubjects(remaining);
    const nextInClass = remaining.find((s) => String(s.className) === String(subjectClass));
    setSelectedId(nextInClass?.id || remaining[0]?.id || '');
    setModal(null);
    setMobileShowDetail(Boolean(nextInClass));
    showToast(`${label} deleted`, 'success');
  };

  const saveSyllabus = () => {
    if (!selected || !key) return;
    const unitLabel = syllabusForm.unit.trim() || `Unit ${units.length + 1}`;
    const fileName = syllabusForm.fileName.trim() || fileSlug(selected.code, className, section, units.length + 1);
    const row = {
      id: nextId('syl'),
      unit: unitLabel,
      fileName: fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      description: syllabusForm.description.trim() || '—',
      uploadedBy: 'Admin User',
      uploadedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      size: '1.0 MB',
    };
    setSyllabus((prev) => ({ ...prev, [key]: [...(prev[key] || []), row] }));
    setModal(null);
    showToast('Syllabus unit added', 'success');
  };

  const saveBook = () => {
    if (!selected || !key) return;
    if (!bookForm.title.trim()) {
      showToast('Enter a book title', 'error');
      return;
    }
    const row = {
      id: nextId('book'),
      title: bookForm.title.trim(),
      author: bookForm.author.trim() || '—',
      type: bookForm.type,
    };
    setBooks((prev) => ({ ...prev, [key]: [...(prev[key] || []), row] }));
    setModal(null);
    showToast('Book assigned', 'success');
  };

  const saveTeacher = () => {
    if (!selected || !key) return;
    if (editingTeacherId) {
      setAssigned((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((t) => (t.id === editingTeacherId ? { ...t, role: teacherForm.role } : t)),
      }));
      setModal(null);
      setEditingTeacherId(null);
      showToast('Teacher assignment updated', 'success');
      return;
    }
    const staffMember = staff.find((t) => t.id === teacherForm.teacherId);
    if (!staffMember) {
      showToast('Select a teacher', 'error');
      return;
    }
    const already = (assigned[key] || []).some(
      (t) => t.email === staffMember.email || t.name === staffMember.name
    );
    if (already) {
      showToast('This teacher is already assigned', 'error');
      return;
    }
    const row = {
      id: nextId('as'),
      name: staffMember.name,
      email: staffMember.email || '',
      role: teacherForm.role,
    };
    setAssigned((prev) => ({ ...prev, [key]: [...(prev[key] || []), row] }));
    setModal(null);
    showToast(`${staffMember.name} assigned`, 'success');
  };

  const removeRow = (kind, id) => {
    if (!key) return;
    if (kind === 'syllabus') {
      setSyllabus((prev) => ({ ...prev, [key]: (prev[key] || []).filter((r) => r.id !== id) }));
      showToast('Syllabus unit removed', 'info');
    } else if (kind === 'books') {
      setBooks((prev) => ({ ...prev, [key]: (prev[key] || []).filter((r) => r.id !== id) }));
      showToast('Book removed', 'info');
    } else {
      setAssigned((prev) => ({ ...prev, [key]: (prev[key] || []).filter((r) => r.id !== id) }));
      showToast('Teacher unassigned', 'info');
    }
    setMenuKey(null);
  };

  const downloadNamed = (fileName) => {
    showToast(`Downloading ${fileName}`, 'info');
    setMenuKey(null);
  };

  const syllabusTable = (
    <section>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-bold text-gray-900">Syllabus for {classSectionLabel}</h3>
        <button
          type="button"
          onClick={() => {
            setSyllabusForm({
              unit: `Unit ${units.length + 1}`,
              description: '',
              fileName: selected ? fileSlug(selected.code === 'MAT' ? 'Maths' : selected.code, className, section, units.length + 1) : '',
            });
            setModal('upload-syllabus');
          }}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Upload size={15} />
          Upload Syllabus
        </button>
      </div>
      <TableWrap minWidth="760px">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Unit / Term</th>
            <th className="px-4 py-3">Syllabus Document</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Uploaded By</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {units.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                No syllabus units for this class and section.
              </td>
            </tr>
          ) : (
            units.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/80">
                <td className="px-4 py-3 font-semibold text-gray-900">{row.unit}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <FileText size={16} />
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{row.fileName}</p>
                      <p className="text-xs text-gray-500">{row.size}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{row.description}</td>
                <td className="px-4 py-3 text-gray-600">{row.uploadedBy}</td>
                <td className="px-4 py-3 text-gray-600">{row.uploadedAt}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      title="Download"
                      onClick={() => downloadNamed(row.fileName)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-violet-700"
                    >
                      <Download size={16} />
                    </button>
                    <RowMenu
                      open={menuKey === `syl-${row.id}`}
                      onToggle={() => setMenuKey((k) => (k === `syl-${row.id}` ? null : `syl-${row.id}`))}
                      onClose={() => setMenuKey(null)}
                    >
                      <button
                        type="button"
                        onClick={() => downloadNamed(row.fileName)}
                        className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow('syllabus', row.id)}
                        className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </RowMenu>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>
      <button
        type="button"
        onClick={() => {
          setSyllabusForm({
            unit: `Unit ${units.length + 1}`,
            description: '',
            fileName: '',
          });
          setModal('upload-syllabus');
        }}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900"
      >
        <Plus size={15} />
        Add More Units / Terms
      </button>
    </section>
  );

  const booksTable = (compact = false) => (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-gray-900">Books Assigned</h3>
        <button
          type="button"
          onClick={() => {
            setBookForm(emptyBookForm());
            setModal('assign-book');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-800"
        >
          <Plus size={14} />
          Assign Book
        </button>
      </div>
      <TableWrap minWidth={compact ? '420px' : '560px'}>
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Book Title</th>
            <th className="px-4 py-3">Author / Publisher</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {scopedBooks.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                No books assigned for this class.
              </td>
            </tr>
          ) : (
            scopedBooks.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/80">
                <td className="px-4 py-3 font-semibold text-gray-900">{row.title}</td>
                <td className="px-4 py-3 text-gray-600">{row.author}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      BOOK_TYPE_STYLES[row.type] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => {
                        setBookForm({ title: row.title, author: row.author, type: row.type });
                        setModal('assign-book');
                      }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-violet-700"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => removeRow('books', row.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>
    </section>
  );

  const teachersTable = (compact = false) => (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-gray-900">Teachers Assigned</h3>
        <button
          type="button"
          onClick={() => {
            setEditingTeacherId(null);
            setTeacherForm(emptyTeacherForm());
            setModal('assign-teacher');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-800"
        >
          <Plus size={14} />
          Assign Teacher
        </button>
      </div>
      <TableWrap minWidth={compact ? '420px' : '560px'}>
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Teacher</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {scopedTeachers.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                No teachers assigned for this class and section.
              </td>
            </tr>
          ) : (
            scopedTeachers.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">
                      {initials(row.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="truncate text-xs text-gray-500">{row.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{row.role}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => {
                        setEditingTeacherId(row.id);
                        setTeacherForm({ teacherId: '', role: row.role });
                        setModal('assign-teacher');
                      }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-violet-700"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => removeRow('teachers', row.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>
    </section>
  );

  const summaryPanel = (
    <aside className="w-full shrink-0 space-y-4 lg:w-[240px]">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Class Summary</h3>
        <p className="mt-0.5 text-xs text-gray-500">{classSectionLabel}</p>
        <dl className="mt-3 space-y-2 text-sm">
          {[
            ['Syllabus Documents', units.length],
            ['Books Assigned', scopedBooks.length],
            ['Teachers Assigned', scopedTeachers.length],
            ['Students', studentCount || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-semibold text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Quick Links</h3>
        <div className="mt-3 space-y-1.5">
          {[
            { label: 'View Timetable', page: 'regular-timetable', icon: CalendarClock },
            { label: 'View Attendance', page: 'attendance', icon: ClipboardCheck },
            { label: 'View Exam Schedule', page: 'exam-timetable', icon: FileText },
          ].map((link) => (
            <button
              key={link.page}
              type="button"
              onClick={() => onNavigate?.(link.page)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-violet-700 hover:bg-violet-50"
            >
              <link.icon size={15} />
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );

  const subjectList = (
    <aside className="flex h-full min-h-0 w-full flex-col border-gray-200 bg-white lg:w-[260px] lg:shrink-0 lg:border-r">
      <div className="space-y-3 border-b border-gray-100 p-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Class</span>
          <select
            value={sidebarClass}
            onChange={(e) => selectSidebarClass(e.target.value)}
            className={inputClass()}
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {formatClassLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${formatClassLabel(sidebarClass)}…`}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setShowFilter((v) => !v)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                categoryFilter
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
              aria-label="Filter subjects"
            >
              <SlidersHorizontal size={16} />
            </button>
            {showFilter ? (
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('');
                    setShowFilter(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    !categoryFilter ? 'bg-violet-50 font-semibold text-violet-800' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All categories
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(c);
                      setShowFilter(false);
                    }}
                    className={`block w-full px-3 py-1.5 text-left text-sm ${
                      categoryFilter === c ? 'bg-violet-50 font-semibold text-violet-800' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {filteredSubjects.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-gray-500">No subjects for {formatClassLabel(sidebarClass)} yet.</p>
            <button
              type="button"
              onClick={openAddSubject}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900"
            >
              <Plus size={15} />
              Add subject for this class
            </button>
          </div>
        ) : (
          filteredSubjects.map((s) => {
            const isActive = s.id === selected?.id;
            const a = accentOf(s.name);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSubject(s.id)}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                  isActive ? a.selected : `${a.card} hover:brightness-[0.98]`
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{s.code}</p>
                  <p className="truncate text-sm font-bold">{displayNameOf(s.name)}</p>
                  <p className="text-xs font-medium opacity-70">{s.category}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 opacity-40" />
              </button>
            );
          })
        )}
      </div>
    </aside>
  );

  const detailPanel = !selected ? (
    <div className="flex flex-1 items-center justify-center bg-white p-8 text-sm text-gray-500">
      Select a subject to manage syllabus, books and teachers.
    </div>
  ) : (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-gray-50/60">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileShowDetail(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
                aria-label="Back to subjects"
              >
                <ArrowLeft size={18} />
              </button>
              <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${accent.icon}`}>
                <Icon size={22} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {selected.code} {displayNameOf(selected.name)}
                </p>
                <h2 className="text-xl font-bold text-gray-900">{displayNameOf(selected.name)}</h2>
                <p className="text-sm text-gray-500">
                  {selected.category} Subject · {formatClassLabel(className)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubjectForm({
                    name: displayNameOf(selected.name),
                    code: selected.code,
                    category: selected.category,
                    className: selected.className,
                  });
                  setModal('edit-subject');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={15} />
                Edit Subject
              </button>
              <button
                type="button"
                onClick={() => setModal('delete-subject')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <Trash2 size={15} />
                Delete Subject
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-500">Class</span>
              <div className="flex h-[42px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-800">
                {formatClassLabel(className)}
              </div>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-500">Select Section</span>
              <select value={section} onChange={(e) => setSection(e.target.value)} className={inputClass()}>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end sm:col-span-2 xl:col-span-1">
              <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5">
                <div>
                  <p className="text-xs font-medium text-violet-700">Total Students</p>
                  <p className="text-xl font-bold text-violet-950">{studentCount || '—'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate?.('students')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-violet-800 shadow-sm ring-1 ring-violet-200 hover:bg-violet-50"
                >
                  <Users size={14} />
                  View Class Students
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex gap-5 overflow-x-auto border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-semibold ${
                    activeTab === tab.id
                      ? 'border-violet-700 text-violet-800'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'syllabus' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{syllabusTable}</div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{booksTable(true)}</div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{teachersTable(true)}</div>
                </div>
              </div>
            ) : null}
            {activeTab === 'books' ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{booksTable(false)}</div>
            ) : null}
            {activeTab === 'teachers' ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{teachersTable(false)}</div>
            ) : null}
            {activeTab === 'overview' ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{booksTable(true)}</div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{teachersTable(true)}</div>
              </div>
            ) : null}
          </div>
          <div className="hidden xl:block">{summaryPanel}</div>
        </div>
        <div className="xl:hidden">{summaryPanel}</div>
      </div>
    </div>
  );

  return (
    <div className="-mx-3 -mt-1 flex min-h-[calc(100vh-7.5rem)] flex-col sm:-mx-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Subjects</h2>
          <p className="hidden text-sm text-gray-500 sm:block">
            Manage syllabus, books and teachers for each class &amp; section.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddSubject}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
        >
          <Plus size={16} />
          Add Subject
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-white">
        <div className={`${mobileShowDetail ? 'hidden lg:flex' : 'flex'} h-full min-h-0 w-full lg:w-auto`}>
          {subjectList}
        </div>
        <div className={`${mobileShowDetail ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-1 flex-col`}>
          {detailPanel}
        </div>
      </div>

      {modal === 'add-subject' || modal === 'edit-subject' ? (
        <Modal
          title={modal === 'add-subject' ? 'Add Subject' : 'Edit Subject'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={saveSubject} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                Save
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Class</span>
              <select
                value={subjectForm.className}
                onChange={(e) => setSubjectForm((p) => ({ ...p, className: e.target.value }))}
                className={inputClass()}
              >
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {formatClassLabel(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Subject name</span>
              <input
                value={subjectForm.name}
                onChange={(e) =>
                  setSubjectForm((p) => ({ ...p, name: e.target.value, code: p.code || codeFromName(e.target.value) }))
                }
                className={inputClass()}
                placeholder="e.g. Mathematics"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Code</span>
              <input
                value={subjectForm.code}
                onChange={(e) => setSubjectForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                className={inputClass()}
                placeholder="MAT"
                maxLength={6}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Category</span>
              <select
                value={subjectForm.category}
                onChange={(e) => setSubjectForm((p) => ({ ...p, category: e.target.value }))}
                className={inputClass()}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      ) : null}

      {modal === 'delete-subject' ? (
        <Modal
          title="Delete Subject"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={deleteSubject} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            Delete <span className="font-semibold text-gray-900">{displayNameOf(selected?.name)}</span>? This removes it from
            the subjects list.
          </p>
        </Modal>
      ) : null}

      {modal === 'upload-syllabus' ? (
        <Modal
          title="Upload Syllabus"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={saveSyllabus} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                Save
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Unit / Term</span>
              <input
                value={syllabusForm.unit}
                onChange={(e) => setSyllabusForm((p) => ({ ...p, unit: e.target.value }))}
                className={inputClass()}
                placeholder="Unit 1"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Description</span>
              <input
                value={syllabusForm.description}
                onChange={(e) => setSyllabusForm((p) => ({ ...p, description: e.target.value }))}
                className={inputClass()}
                placeholder="Numbers up to 10,000"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Document</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) =>
                  setSyllabusForm((p) => ({ ...p, fileName: e.target.files?.[0]?.name || p.fileName }))
                }
                className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-violet-800"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">File name</span>
              <input
                value={syllabusForm.fileName}
                onChange={(e) => setSyllabusForm((p) => ({ ...p, fileName: e.target.value }))}
                className={inputClass()}
                placeholder="Maths_Unit1_Class3A.pdf"
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {modal === 'assign-book' ? (
        <Modal
          title="Assign Book"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={saveBook} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                Assign
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Book title</span>
              <input
                value={bookForm.title}
                onChange={(e) => setBookForm((p) => ({ ...p, title: e.target.value }))}
                className={inputClass()}
                placeholder="Mathematics Textbook - Class 3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Author / Publisher</span>
              <input
                value={bookForm.author}
                onChange={(e) => setBookForm((p) => ({ ...p, author: e.target.value }))}
                className={inputClass()}
                placeholder="NCERT"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Type</span>
              <select
                value={bookForm.type}
                onChange={(e) => setBookForm((p) => ({ ...p, type: e.target.value }))}
                className={inputClass()}
              >
                {BOOK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      ) : null}

      {modal === 'assign-teacher' ? (
        <Modal
          title={editingTeacherId ? 'Edit Assignment' : 'Assign Teacher'}
          onClose={() => {
            setModal(null);
            setEditingTeacherId(null);
          }}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setModal(null);
                  setEditingTeacherId(null);
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button type="button" onClick={saveTeacher} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                Save
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {!editingTeacherId ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-600">Teacher</span>
                <select
                  value={teacherForm.teacherId}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, teacherId: e.target.value }))}
                  className={inputClass()}
                >
                  <option value="">Select teacher</option>
                  {staff.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-600">Role</span>
              <select
                value={teacherForm.role}
                onChange={(e) => setTeacherForm((p) => ({ ...p, role: e.target.value }))}
                className={inputClass()}
              >
                {TEACHER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
