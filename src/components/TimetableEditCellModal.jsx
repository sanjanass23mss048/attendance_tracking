import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { DEFAULT_TEACHERS, SUBJECT_STYLES } from '../data/timetableData.js';

const SUBJECTS = [...Object.keys(SUBJECT_STYLES), 'Other'];
const TEACHER_NAMES = DEFAULT_TEACHERS.map((t) => t.name);

function teacherForSubject(subject) {
  return DEFAULT_TEACHERS.find((t) => t.subject === subject)?.name || '';
}

function ComboboxInput({
  id,
  value,
  onChange,
  options,
  disabled,
  placeholder = 'Type or pick…',
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [filterActive, setFilterActive] = useState(false);

  const filtered = useMemo(() => {
    if (!filterActive || !value.trim()) return options;
    const q = value.trim().toLowerCase();
    const matches = options.filter((opt) => opt.toLowerCase().includes(q));
    return matches.length ? matches : options;
  }, [filterActive, options, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setFilterActive(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setFilterActive(false);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setFilterActive(true);
          }}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-9 text-sm disabled:bg-gray-50"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Show all options"
          onClick={() => {
            setFilterActive(false);
            setOpen((v) => !v);
          }}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                className={`flex w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50 ${
                  opt === value ? 'bg-indigo-50 font-medium text-indigo-800' : 'text-gray-800'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                  setFilterActive(false);
                }}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Edit one timetable cell (day × period).
 * cell = { dayIdx, periodIdx, day, period, time, subject, teacher }
 */
export default function TimetableEditCellModal({ open, cell, onClose, onSave, onClear }) {
  const [subject, setSubject] = useState('');
  const [subjectOther, setSubjectOther] = useState('');
  const [teacher, setTeacher] = useState('');

  useEffect(() => {
    if (!open || !cell) return;
    const existing = (cell.subject || '').trim();
    const known = SUBJECTS.filter((s) => s !== 'Other');
    if (!existing) {
      setSubject('');
      setSubjectOther('');
    } else if (known.includes(existing)) {
      setSubject(existing);
      setSubjectOther('');
    } else {
      setSubject('Other');
      setSubjectOther(existing === 'Other' ? '' : existing);
    }
    setTeacher(cell.teacher || '');
  }, [open, cell]);

  if (!open || !cell) return null;

  const handleSubjectChange = (value) => {
    setSubject(value);
    if (value !== 'Other') {
      setSubjectOther('');
      const matched = teacherForSubject(value);
      if (matched) setTeacher(matched);
    }
  };

  const resolvedSubject = subject === 'Other' ? subjectOther.trim() : subject.trim();
  const canSave = Boolean(resolvedSubject);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Edit Period</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {cell.day} · Period {cell.period}
              {cell.time ? ` · ${cell.time}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Subject</span>
            <ComboboxInput
              id="edit-cell-subject"
              value={subject}
              onChange={handleSubjectChange}
              options={SUBJECTS}
              placeholder="Type or pick subject"
            />
          </label>
          {subject === 'Other' && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-500">Specify *</span>
              <input
                type="text"
                value={subjectOther}
                onChange={(e) => setSubjectOther(e.target.value)}
                placeholder="Enter subject name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">Teacher</span>
            <ComboboxInput
              id="edit-cell-teacher"
              value={teacher}
              onChange={setTeacher}
              options={TEACHER_NAMES}
              placeholder="Type or pick teacher"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={() => onClear?.(cell)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Clear cell
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() =>
                onSave({
                  ...cell,
                  subject: resolvedSubject,
                  teacher: teacher.trim() || '—',
                })
              }
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
