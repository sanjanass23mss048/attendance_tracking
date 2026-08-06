import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { DEFAULT_TEACHERS, SUBJECT_STYLES, TIMETABLE_DAYS } from '../data/timetableData.js';

const SUBJECTS = [...Object.keys(SUBJECT_STYLES), 'Other'];
const TEACHER_NAMES = DEFAULT_TEACHERS.map((t) => t.name);

/** Typeable combobox: shows full list on open; filters only while typing. */
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
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setFilterActive(false);
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setFilterActive(false);
            }
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
                aria-selected={opt === value}
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
          {filterActive &&
            value.trim() &&
            !options.some((o) => o.toLowerCase() === value.trim().toLowerCase()) && (
              <li className="border-t border-gray-100 px-3 py-1.5 text-xs text-gray-500">
                Press Enter to use “{value.trim()}”
              </li>
            )}
        </ul>
      )}
    </div>
  );
}

function SubjectInput(props) {
  return <ComboboxInput {...props} options={SUBJECTS} placeholder={props.placeholder || 'Type or pick subject'} />;
}

function TeacherInput(props) {
  return (
    <ComboboxInput
      {...props}
      options={TEACHER_NAMES}
      placeholder={props.placeholder || 'Type or pick teacher'}
    />
  );
}

function formatRange(start, end) {
  const to12 = (t) => {
    const [hStr, mStr] = t.split(':');
    let h = Number(hStr);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  };
  return `${to12(start)} - ${to12(end)}`;
}

function teacherForSubject(subject) {
  return DEFAULT_TEACHERS.find((t) => t.subject === subject)?.name || '';
}

function emptyDayAssignments() {
  return Object.fromEntries(
    TIMETABLE_DAYS.map((day) => [day, { subject: '', subjectOther: '', teacher: '' }])
  );
}

export default function TimetableAddPeriodModal({ open, nextPeriod, onClose, onSave }) {
  const [start, setStart] = useState('14:20');
  const [end, setEnd] = useState('15:00');
  const [applyAllDays, setApplyAllDays] = useState(true);
  const [subject, setSubject] = useState('English');
  const [subjectOther, setSubjectOther] = useState('');
  const [teacher, setTeacher] = useState(() => teacherForSubject('English'));
  const [dayAssignments, setDayAssignments] = useState(emptyDayAssignments);

  useEffect(() => {
    if (!open) return;
    setStart('14:20');
    setEnd('15:00');
    setApplyAllDays(true);
    setSubject('English');
    setSubjectOther('');
    setTeacher(teacherForSubject('English'));
    setDayAssignments(emptyDayAssignments());
  }, [open]);

  if (!open) return null;

  const handleSubjectChange = (value) => {
    setSubject(value);
    if (value !== 'Other') {
      setSubjectOther('');
      const matched = teacherForSubject(value);
      if (matched) setTeacher(matched);
    }
  };

  const handleDaySubjectChange = (day, value) => {
    const matched = teacherForSubject(value);
    setDayAssignments((prev) => ({
      ...prev,
      [day]: {
        subject: value,
        subjectOther: value === 'Other' ? prev[day]?.subjectOther || '' : '',
        teacher: matched || prev[day]?.teacher || '',
      },
    }));
  };

  const handleDayTeacherChange = (day, value) => {
    setDayAssignments((prev) => ({
      ...prev,
      [day]: { ...prev[day], teacher: value },
    }));
  };

  const resolveSubject = (value, other) =>
    value === 'Other' ? (other || '').trim() : (value || '').trim();

  const handleSave = () => {
    const time = formatRange(start, end);
    const cells = TIMETABLE_DAYS.map((day) => {
      if (applyAllDays) {
        const resolved = resolveSubject(subject, subjectOther);
        if (!resolved) return null;
        return { subject: resolved, teacher: teacher.trim() || '—' };
      }
      const row = dayAssignments[day];
      const resolved = resolveSubject(row?.subject, row?.subjectOther);
      if (!resolved) return null;
      return { subject: resolved, teacher: row.teacher.trim() || '—' };
    });

    onSave({ period: nextPeriod, time, cells });
  };

  const canSave = applyAllDays
    ? Boolean(resolveSubject(subject, subjectOther))
    : TIMETABLE_DAYS.some((day) =>
        Boolean(resolveSubject(dayAssignments[day]?.subject, dayAssignments[day]?.subjectOther))
      );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900">Add Period</h3>
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
            <span className="mb-1 block text-xs font-medium text-gray-500">Period number</span>
            <input
              type="number"
              value={nextPeriod}
              readOnly
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-500">Start time</span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-500">End time</span>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Subject details
            </p>

            <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={applyAllDays}
                onChange={(e) => setApplyAllDays(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Same subject for all days
            </label>

            {applyAllDays ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-500">Subject</span>
                    <SubjectInput
                      id="add-period-subject"
                      value={subject}
                      onChange={handleSubjectChange}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-500">Teacher</span>
                    <TeacherInput
                      id="add-period-teacher"
                      value={teacher}
                      onChange={setTeacher}
                    />
                  </label>
                </div>
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
              </div>
            ) : (
              <div className="space-y-3">
                {TIMETABLE_DAYS.map((day) => (
                  <div key={day} className="space-y-2 rounded-lg border border-gray-100 bg-white p-2.5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[88px_1fr_1fr] sm:items-end">
                      <span className="text-xs font-semibold text-gray-700 sm:pb-2">{day}</span>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[11px] font-medium text-gray-500">Subject</span>
                        <SubjectInput
                          id={`add-period-subject-${day}`}
                          value={dayAssignments[day]?.subject || ''}
                          onChange={(value) => handleDaySubjectChange(day, value)}
                          placeholder="Type subject or Other"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[11px] font-medium text-gray-500">Teacher</span>
                        <TeacherInput
                          id={`add-period-teacher-${day}`}
                          value={dayAssignments[day]?.teacher || ''}
                          onChange={(value) => handleDayTeacherChange(day, value)}
                          disabled={!dayAssignments[day]?.subject}
                        />
                      </label>
                    </div>
                    {dayAssignments[day]?.subject === 'Other' && (
                      <label className="block text-sm sm:pl-[88px]">
                        <span className="mb-1 block text-[11px] font-medium text-gray-500">Specify *</span>
                        <input
                          type="text"
                          value={dayAssignments[day]?.subjectOther || ''}
                          onChange={(e) =>
                            setDayAssignments((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], subjectOther: e.target.value },
                            }))
                          }
                          placeholder="Enter subject name"
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Preview: Period {nextPeriod} · {formatRange(start, end)}
            {applyAllDays && resolveSubject(subject, subjectOther)
              ? ` · ${resolveSubject(subject, subjectOther)}${teacher ? ` (${teacher})` : ''}`
              : ''}
          </p>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">
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
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Period
          </button>
        </div>
      </div>
    </div>
  );
}
