import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Layers,
  School,
  Upload,
  UserRound,
  Users,
} from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { saveHomeworkAssignment } from '../services/homeworkService.js';
import { SUBJECT_STYLES } from '../data/timetableData.js';
import { showToast } from '../services/toast.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import ManageTimetablesPanel from './ManageTimetablesPanel.jsx';

const RECIPIENTS = [
  { id: 'ENTIRE_CLASS', label: 'Entire Class', icon: Users },
  { id: 'SPECIFIC_STUDENTS', label: 'Specific Students', icon: UserRound },
  { id: 'CLASS_GROUP', label: 'Class Group', icon: Layers },
  { id: 'ALL_STUDENTS', label: 'All Students', icon: School },
];

const SUBJECTS = Object.keys(SUBJECT_STYLES);

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function StepBadge({ n }) {
  return (
    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
      {n}
    </span>
  );
}

/**
 * Teacher Academic Management — Assign Homework + Manage Timetables.
 */
export default function TeacherPanelPage({ mode = 'assign-homework' }) {
  const showHomework = mode === 'assign-homework';
  const timetableOnly =
    mode === 'regular-timetable' ||
    mode === 'test-timetable' ||
    mode === 'exam-timetable' ||
    mode === 'update-timetable';

  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [recipientType, setRecipientType] = useState('ENTIRE_CLASS');
  const [classSectionKey, setClassSectionKey] = useState('');
  const [subject, setSubject] = useState('Maths');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(() => addDaysIso(todayIso(), 2));
  const [description, setDescription] = useState('');
  const [notifyParents, setNotifyParents] = useState(true);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentSize, setAttachmentSize] = useState(null);
  const [attachmentMime, setAttachmentMime] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingClasses(true);
      try {
        const data = await getClasses();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.classes || [];
        setClasses(list);
        const first = list[0];
        const firstSec = first?.sections?.[0];
        if (first && firstSec) {
          const key = `${first.name}||${firstSec.name}||${firstSec.id || ''}`;
          setClassSectionKey((prev) => prev || key);
        }
      } catch {
        if (!cancelled) {
          setClasses([]);
          showToast('Could not load classes', 'error');
        }
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sectionOptions = useMemo(() => {
    const out = [];
    const list = Array.isArray(classes) ? classes : [];
    for (const klass of list) {
      for (const sec of klass.sections || []) {
        out.push({
          key: `${klass.name}||${sec.name}||${sec.id || ''}`,
          label: `${formatClassLabel(klass.name)} - ${sec.name}`,
          className: klass.name,
          sectionName: sec.name,
          sectionId: sec.id,
        });
      }
    }
    return out;
  }, [classes]);

  const selectedHw = sectionOptions.find((o) => o.key === classSectionKey);

  const clearHomework = () => {
    setRecipientType('ENTIRE_CLASS');
    setSubject('Maths');
    setTitle('');
    setDueDate(addDaysIso(todayIso(), 2));
    setDescription('');
    setNotifyParents(true);
    setAttachmentName('');
    setAttachmentSize(null);
    setAttachmentMime('');
    setAttachmentDataUrl('');
  };

  const onAttachmentChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachmentName('');
      setAttachmentSize(null);
      setAttachmentMime('');
      setAttachmentDataUrl('');
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    setAttachmentName(file.name);
    setAttachmentSize(file.size);
    setAttachmentMime(file.type || '');
    if (file.size > maxBytes) {
      setAttachmentDataUrl('');
      showToast('File saved by name only (over 2 MB — View/Download unavailable)', 'info');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachmentDataUrl(String(reader.result || ''));
    reader.onerror = () => {
      setAttachmentDataUrl('');
      showToast('Could not read attachment file', 'error');
    };
    reader.readAsDataURL(file);
  };

  const assignHomework = () => {
    if (!selectedHw) {
      showToast('Select a class / section', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Enter a homework title', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Enter description / instructions', 'error');
      return;
    }
    saveHomeworkAssignment({
      recipientType,
      classLabel: selectedHw.label,
      className: selectedHw.className,
      sectionName: selectedHw.sectionName,
      sectionId: selectedHw.sectionId,
      subject,
      title: title.trim(),
      dueDate,
      description: description.trim(),
      notifyParents,
      attachmentName: attachmentName || null,
      attachmentSize: attachmentSize || null,
      attachmentMime: attachmentMime || null,
      attachmentDataUrl: attachmentDataUrl || null,
    });
    showToast(
      notifyParents
        ? 'Homework assigned — parents will be notified'
        : 'Homework assigned',
      'success'
    );
    clearHomework();
  };

  const timetableMode =
    mode === 'test-timetable'
      ? 'test'
      : mode === 'exam-timetable'
        ? 'exam'
        : 'regular';

  return (
    <div className="space-y-4">
      <div
        className={`grid grid-cols-1 gap-5 ${
          showHomework && !timetableOnly ? 'xl:grid-cols-2' : ''
        }`}
      >
        {showHomework ? (
          <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm ring-1 ring-indigo-100 sm:p-6">
            <h2 className="mb-5 text-lg font-bold text-gray-900">Assign Homework</h2>

            <div className="mb-5">
              <p className="mb-2 flex items-center text-sm font-semibold text-gray-800">
                <StepBadge n={1} /> Select Recipients
              </p>
              <div className="grid grid-cols-2 gap-2">
                {RECIPIENTS.map((opt) => {
                  const Icon = opt.icon;
                  const active = recipientType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRecipientType(opt.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                        active
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={16} className={active ? 'text-indigo-600' : 'text-gray-400'} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-2 flex items-center text-sm font-semibold text-gray-800">
                <StepBadge n={2} /> Select Class / Section
              </p>
              <select
                value={classSectionKey}
                onChange={(e) => setClassSectionKey(e.target.value)}
                disabled={loadingClasses}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {sectionOptions.length === 0 ? (
                  <option value="">No classes loaded</option>
                ) : (
                  sectionOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-1 text-[11px] text-gray-400">
                Only classes assigned to your account are listed.
              </p>
            </div>

            <div className="mb-4">
              <p className="mb-2 flex items-center text-sm font-semibold text-gray-800">
                <StepBadge n={3} /> Subject
              </p>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'Maths' ? 'Mathematics' : s}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <p className="mb-2 flex items-center text-sm font-semibold text-gray-800">
                <StepBadge n={4} /> Homework Details
              </p>
              <label className="mb-1 block text-xs font-medium text-gray-500">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chapter 5 worksheet"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <label className="mb-1 block text-xs font-medium text-gray-500">Due Date</label>
              <div className="relative mb-3">
                <Calendar
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Description / Instructions
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Write instructions for students…"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Attachment (optional)
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:border-indigo-400 hover:bg-indigo-50/40">
                <Upload size={22} className="mb-2 text-indigo-500" />
                <span className="text-sm font-medium text-gray-700">
                  {attachmentName || 'Drop file or click to upload'}
                </span>
                <span className="mt-1 text-xs text-gray-400">PDF, DOC, images</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={onAttachmentChange}
                />
              </label>
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={notifyParents}
                onChange={(e) => setNotifyParents(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Send notification to parents
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={clearHomework}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={assignHomework}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Assign Homework
              </button>
            </div>
          </section>
        ) : null}

        <ManageTimetablesPanel
          mode={timetableMode}
          sectionOptions={sectionOptions}
          loadingClasses={loadingClasses}
        />
      </div>
    </div>
  );
}
