import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileText, Search } from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { getStudents } from '../services/studentService.js';
import StudentDocumentsPanel from './StudentDocumentsPanel.jsx';

function SearchableStudentDropdown({ students, studentId, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const selected = students.find((s) => s.id === studentId);
  const filtered = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.rollNo ?? s.roll).includes(q)
    );
  }, [students, query]);

  const label = selected
    ? `Roll ${selected.rollNo ?? selected.roll} — ${selected.name}`
    : 'Select student';

  return (
    <div className="relative sm:col-span-2" ref={wrapRef}>
      <label className="text-xs font-medium text-gray-500">Student</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm disabled:opacity-50"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>{label}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-lg" style={{ minWidth: 280 }}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search size={14} className="text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or roll…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">No match</li>
            )}
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                    s.id === studentId ? 'bg-indigo-100 font-semibold text-indigo-700' : 'text-gray-700'
                  }`}
                >
                  Roll {s.rollNo ?? s.roll} — {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function LeaveLettersPage() {
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingClasses(true);
      try {
        const data = await getClasses();
        const list = data.classes || [];
        if (!cancelled) {
          setClasses(list);
          if (list.length) {
            setClassName((prev) => prev || list[0].name);
            const firstSection = list[0].sections?.[0]?.name || 'A';
            setSectionName((prev) => prev || firstSection);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load classes');
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = useMemo(() => {
    const cls = classes.find((c) => c.name === className);
    return cls?.sections || [];
  }, [classes, className]);

  const sectionId = useMemo(() => {
    const sec = sections.find((s) => s.name === sectionName);
    return sec?.id || null;
  }, [sections, sectionName]);

  const loadStudents = useCallback(async () => {
    if (!className || !sectionName) return;
    setLoadingStudents(true);
    setError('');
    try {
      const data = await getStudents({
        class: className,
        section: sectionName,
        sectionId: sectionId || undefined,
      });
      const list = data.students || [];
      setStudents(list);
      setStudentId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list[0]?.id || '';
      });
    } catch (err) {
      setError(err.message || 'Failed to load students');
      setStudents([]);
      setStudentId('');
    } finally {
      setLoadingStudents(false);
    }
  }, [className, sectionName, sectionId]);

  useEffect(() => {
    if (className && sectionName) loadStudents();
  }, [className, sectionName, loadStudents]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId) || null,
    [students, studentId]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <FileText size={22} />
            <h1 className="text-xl font-bold text-gray-900">Leave Letters</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Class teachers upload and track leave letters for students.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Class</label>
            <select
              value={className}
              disabled={loadingClasses}
              onChange={(e) => {
                const next = e.target.value;
                setClassName(next);
                const cls = classes.find((c) => c.name === next);
                setSectionName(cls?.sections?.[0]?.name || 'A');
                setStudentId('');
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id || c.name} value={c.name}>
                  {formatClassLabel(c.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Section</label>
            <select
              value={sectionName}
              onChange={(e) => {
                setSectionName(e.target.value);
                setStudentId('');
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {sections.map((s) => (
                <option key={s.id || s.name} value={s.name}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </div>
          <SearchableStudentDropdown
            students={students}
            studentId={studentId}
            disabled={loadingStudents || students.length === 0}
            onChange={setStudentId}
          />
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>

      {selectedStudent ? (
        <StudentDocumentsPanel
          studentRecordId={selectedStudent.studentRecordId}
          studentName={selectedStudent.name}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
          Select a class, section, and student to upload a leave letter.
        </div>
      )}
    </div>
  );
}
