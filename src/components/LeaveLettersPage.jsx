import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { getStudents } from '../services/studentService.js';
import StudentDocumentsPanel from './StudentDocumentsPanel.jsx';

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
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">Student</label>
            <select
              value={studentId}
              disabled={loadingStudents || students.length === 0}
              onChange={(e) => setStudentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {students.length === 0 ? (
                <option value="">No students loaded</option>
              ) : (
                students.map((s) => (
                  <option key={s.id} value={s.id}>
                    Roll {s.rollNo ?? s.roll} — {s.name}
                  </option>
                ))
              )}
            </select>
          </div>
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
