import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CloudRain,
  FileText,
  Layers,
  Loader2,
  Minus,
  Paperclip,
  Plus,
  Save,
  School,
  Search,
  Send,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import {
  getNotificationComposerOptions,
  getNotificationStudents,
  saveTeacherNotification,
} from '../services/teacherNotificationService.js';
import { getBrowserTenantSlug } from '../lib/tenantHost.js';
import { useBranding } from '../lib/branding.jsx';
import {
  APPLICABLE_OPTIONS,
  buildSuddenHolidayMessage,
} from '../data/calendarData.js';
import { createSuddenHoliday } from '../services/calendarService.js';

const RECIPIENT_OPTIONS = [
  {
    id: 'ENTIRE_CLASS',
    label: 'Entire Class',
    hint: 'Send to all students in selected class sections',
    icon: Users,
  },
  {
    id: 'SPECIFIC_STUDENTS',
    label: 'Specific Students',
    hint: 'Pick students from a class with checkboxes',
    icon: UserRound,
  },
  {
    id: 'CLASS_GROUP',
    label: 'Class Group',
    hint: 'Preset bands or pick classes manually',
    icon: Layers,
  },
  {
    id: 'ALL_STUDENTS',
    label: 'All Students',
    hint: 'Everyone in classes you can access',
    icon: School,
  },
];

function formatClassName(name) {
  const c = String(name || '').trim();
  const upper = c.toUpperCase();
  if (upper === 'LKG' || upper === 'UKG') return upper;
  if (/^class\s+/i.test(c)) return c;
  return `Class ${c}`;
}

function sectionChipLabel(klassName, sectionName) {
  const left = formatClassName(klassName).replace(/^Class\s+/i, 'Class ');
  return `${left}-${sectionName}`;
}

function formatBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesGroup(className, groupId) {
  const raw = String(className || '').replace(/^class\s+/i, '');
  const upper = raw.toUpperCase();
  if (groupId === 'preprimary') return upper === 'LKG' || upper === 'UKG';
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  if (groupId === '1-5') return n >= 1 && n <= 5;
  if (groupId === '1-9') return n >= 1 && n <= 9;
  if (groupId === '6-9') return n >= 6 && n <= 9;
  if (groupId === '10-12') return n >= 10 && n <= 12;
  return true;
}

function formatWhatsAppToast(whatsapp) {
  if (!whatsapp) return '';
  if (whatsapp.reason === 'not_configured') {
    return ' WhatsApp skipped (not configured).';
  }
  const parts = [];
  if (whatsapp.sent) parts.push(`${whatsapp.sent} sent`);
  if (whatsapp.skipped) parts.push(`${whatsapp.skipped} skipped`);
  if (whatsapp.failed) parts.push(`${whatsapp.failed} failed`);
  if (!parts.length) {
    if (whatsapp.attempted === 0) return ' WhatsApp: no parent phones found.';
    return '';
  }
  let msg = ` WhatsApp: ${parts.join(', ')}.`;
  if (whatsapp.error) msg += ` Meta: ${whatsapp.error}`;
  return msg;
}

export default function SendNotificationPage({ user, onNavigate }) {
  const { schoolName } = useBranding();
  const tenantSlug = getBrowserTenantSlug();
  // Sudden Holiday lives on Notify (moved from Academic Calendar). Show for all school tenants.
  const showSuddenHoliday = Boolean(tenantSlug) && tenantSlug !== 'apex';
  const displaySchool = schoolName || 'School';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [composerMode, setComposerMode] = useState('notify'); // notify | sudden
  const [options, setOptions] = useState({
    classes: [],
    groups: [],
    categories: [],
    canSendAllStudents: false,
    allStudentsIsSchoolWide: false,
  });

  const [recipientType, setRecipientType] = useState('ENTIRE_CLASS');
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [filterChip, setFilterChip] = useState('all');
  const [classSearch, setClassSearch] = useState('');
  const [expandedClasses, setExpandedClasses] = useState(() => new Set());

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [students, setStudents] = useState([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [individualId, setIndividualId] = useState('');

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('General');
  const [delivery, setDelivery] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [sendViaWhatsApp, setSendViaWhatsApp] = useState(true);
  const [attachment, setAttachment] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addClassOpen, setAddClassOpen] = useState(false);

  const [holidayDate, setHolidayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [holidayDateTo, setHolidayDateTo] = useState('');
  const [holidayReason, setHolidayReason] = useState('Heavy Rain');
  const [holidayApplicableTo, setHolidayApplicableTo] = useState('All Classes');
  const [holidayMessage, setHolidayMessage] = useState('');
  const [holidaySaving, setHolidaySaving] = useState(false);

  useEffect(() => {
    setHolidayMessage(
      buildSuddenHolidayMessage(holidayReason, holidayDate, holidayDateTo, displaySchool)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed when school name loads
  }, [displaySchool]);

  const refreshHolidayMessage = (reason, from, to) => {
    setHolidayMessage(buildSuddenHolidayMessage(reason, from, to, displaySchool));
  };

  const submitSuddenHoliday = async (e) => {
    e?.preventDefault?.();
    if (!holidayReason.trim()) {
      setError('Please enter a reason for the sudden holiday.');
      return;
    }
    if (!holidayDate) {
      setError('Please select a from date.');
      return;
    }
    setHolidaySaving(true);
    setError('');
    setToast('');
    try {
      const { whatsapp } = await createSuddenHoliday({
        date: holidayDate,
        dateTo: holidayDateTo || holidayDate,
        reason: holidayReason.trim(),
        applicableTo: holidayApplicableTo,
        message: holidayMessage,
      });
      let notice = 'Sudden holiday saved to calendar.';
      if (whatsapp?.mock) notice = 'Holiday saved locally (mock mode). WhatsApp is not sent.';
      else if (whatsapp && whatsapp.attempted === 0) {
        notice = 'Holiday saved, but no parent phone numbers were found.';
      } else if (whatsapp && whatsapp.skipped && whatsapp.skipped === whatsapp.attempted) {
        notice =
          'Holiday saved, but WhatsApp was skipped (token not configured, or sudden_holiday template not approved).';
      } else if (whatsapp && (whatsapp.sent || whatsapp.failed)) {
        notice = `Holiday saved.${formatWhatsAppToast(whatsapp)}`;
      }
      setToast(notice);
    } catch (err) {
      setError(err.message || 'Failed to save sudden holiday');
    } finally {
      setHolidaySaving(false);
    }
  };

  const sectionMeta = useMemo(() => {
    const map = new Map();
    for (const klass of options.classes || []) {
      for (const sec of klass.sections || []) {
        map.set(sec.id, {
          sectionId: sec.id,
          classId: klass.id,
          className: klass.name,
          sectionName: sec.name,
          label: sectionChipLabel(klass.name, sec.name),
          studentCount: sec.studentCount || 0,
        });
      }
    }
    return map;
  }, [options.classes]);

  const selectedSections = useMemo(
    () => selectedSectionIds.map((id) => sectionMeta.get(id)).filter(Boolean),
    [selectedSectionIds, sectionMeta]
  );

  const selectedStudentCount = useMemo(
    () => selectedSections.reduce((n, s) => n + (s.studentCount || 0), 0),
    [selectedSections]
  );

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    return (options.classes || []).filter((klass) => {
      if (filterChip !== 'all' && !matchesGroup(klass.name, filterChip)) return false;
      if (!q) return true;
      const name = String(klass.name || '').toLowerCase();
      if (name.includes(q)) return true;
      return (klass.sections || []).some((s) =>
        String(s.name || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [options.classes, filterChip, classSearch]);

  const sectionsForClass = useMemo(() => {
    const klass = (options.classes || []).find((c) => c.id === classId);
    return klass?.sections || [];
  }, [options.classes, classId]);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getNotificationComposerOptions();
      setOptions(data);
      const firstIds = (data.classes || []).slice(0, 3).map((c) => c.id);
      setExpandedClasses(new Set(firstIds));
    } catch (err) {
      setError(err.message || 'Could not load options');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (
        (recipientType === 'SPECIFIC_STUDENTS' || recipientType === 'INDIVIDUAL') &&
        sectionId
      ) {
        try {
          const data = await getNotificationStudents({ sectionId, q: studentQuery });
          if (!cancelled) setStudents(data.students || []);
        } catch (err) {
          if (!cancelled) setError(err.message || 'Could not load students');
        }
      } else if (!cancelled) setStudents([]);
    }
    const t = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [recipientType, sectionId, studentQuery]);

  const toggleExpand = (id) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (sid) => {
    setGroupId('');
    setSelectedSectionIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const toggleWholeClass = (klass) => {
    const ids = (klass.sections || []).map((s) => s.id);
    const allOn = ids.every((id) => selectedSectionIds.includes(id));
    setGroupId('');
    setSelectedSectionIds((prev) => {
      if (allOn) return prev.filter((id) => !ids.includes(id));
      const set = new Set(prev);
      ids.forEach((id) => set.add(id));
      return [...set];
    });
  };

  const classCheckState = (klass) => {
    const ids = (klass.sections || []).map((s) => s.id);
    if (!ids.length) return 'none';
    const count = ids.filter((id) => selectedSectionIds.includes(id)).length;
    if (count === 0) return 'none';
    if (count === ids.length) return 'all';
    return 'partial';
  };

  const applyFilterChip = (chipId) => {
    setFilterChip(chipId);
    setAddClassOpen(false);
    if (chipId === 'all') return;
    const ids = [];
    for (const klass of options.classes || []) {
      if (!matchesGroup(klass.name, chipId)) continue;
      for (const sec of klass.sections || []) ids.push(sec.id);
    }
    setGroupId(chipId);
    setSelectedSectionIds(ids);
  };

  const applyPresetGroup = (gid) => {
    setAddClassOpen(false);
    setFilterChip(gid);
    setGroupId(gid);
    const ids = [];
    for (const klass of options.classes || []) {
      if (!matchesGroup(klass.name, gid)) continue;
      for (const sec of klass.sections || []) ids.push(sec.id);
    }
    setSelectedSectionIds(ids);
  };

  const classesAvailableToAdd = useMemo(() => {
    return (options.classes || []).filter((klass) => {
      const ids = (klass.sections || []).map((s) => s.id);
      if (!ids.length) return false;
      // Offer classes that are not fully included yet
      return !ids.every((id) => selectedSectionIds.includes(id));
    });
  }, [options.classes, selectedSectionIds]);

  const addClassToSelection = (klass) => {
    const ids = (klass.sections || []).map((s) => s.id);
    setSelectedSectionIds((prev) => [...new Set([...prev, ...ids])]);
    setAddClassOpen(false);
  };

  const buildPayload = (asDraft = false) => {
    let sectionIds = [];
    let studentIds = [];
    let payloadGroupId = null;

    if (recipientType === 'ENTIRE_CLASS') {
      sectionIds = selectedSectionIds;
    } else if (recipientType === 'CLASS_GROUP') {
      if (selectedSectionIds.length) sectionIds = selectedSectionIds;
      else payloadGroupId = groupId || null;
    } else if (recipientType === 'SPECIFIC_STUDENTS') {
      sectionIds = sectionId ? [sectionId] : [];
      studentIds = selectedStudentIds;
    } else if (recipientType === 'INDIVIDUAL') {
      sectionIds = sectionId ? [sectionId] : [];
      studentIds = individualId ? [individualId] : [];
    }

    let scheduledAt = null;
    if (!asDraft && delivery === 'later') {
      if (!scheduleDate || !scheduleTime) throw new Error('Enter schedule date and time');
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    }

    return {
      title: title.trim(),
      message: message.trim(),
      category,
      recipientType,
      sectionIds,
      studentIds,
      groupId: payloadGroupId,
      delivery: asDraft ? 'now' : delivery,
      scheduledAt,
      asDraft,
      sendViaWhatsApp: asDraft ? false : sendViaWhatsApp,
    };
  };

  const validateLocal = (asDraft) => {
    if (!title.trim()) return 'Title is required';
    if (!message.trim()) return 'Message is required';
    if (asDraft) return '';
    if (recipientType === 'ENTIRE_CLASS' && !selectedSectionIds.length) {
      return 'Select at least one class section';
    }
    if (
      recipientType === 'CLASS_GROUP' &&
      !groupId &&
      !selectedSectionIds.length
    ) {
      return 'Select a class group or choose classes manually';
    }
    if (recipientType === 'SPECIFIC_STUDENTS') {
      if (!sectionId) return 'Select class and section';
      if (!selectedStudentIds.length) return 'Select at least one student';
    }
    if (recipientType === 'INDIVIDUAL') {
      if (!sectionId) return 'Select class and section';
      if (!individualId) return 'Select a student';
    }
    return '';
  };

  const askSend = (asDraft) => {
    setError('');
    setToast('');
    const err = validateLocal(asDraft);
    if (err) return setError(err);
    if (asDraft) return doSave(true);
    if (recipientType === 'ALL_STUDENTS') {
      const ok = window.confirm(
        options.allStudentsIsSchoolWide
          ? 'This notifies students across accessible school classes. Continue?'
          : 'This notifies all students in your assigned classes. Continue?'
      );
      if (!ok) return;
    }
    setConfirmOpen(true);
  };

  const doSave = async (asDraft) => {
    setConfirmOpen(false);
    setBusy(asDraft ? 'draft' : 'send');
    setError('');
    try {
      const data = await saveTeacherNotification(buildPayload(asDraft), attachment);
      const status = data.notification?.status;
      const waNote =
        !asDraft && status === 'SENT' && sendViaWhatsApp
          ? formatWhatsAppToast(data.whatsapp)
          : '';
      setToast(
        asDraft
          ? 'Draft saved.'
          : status === 'SCHEDULED'
            ? 'Notification scheduled.'
            : `Sent to ${data.notification?.recipientCount || 0} recipient(s) (notice board).${waNote}`
      );
      setTitle('');
      setMessage('');
      setSelectedSectionIds([]);
      setSelectedStudentIds([]);
      setIndividualId('');
      setAttachment(null);
      setGroupId('');
    } catch (e) {
      setError(e.message || 'Could not save notification');
    } finally {
      setBusy('');
    }
  };

  const livePreviewRecipients = useMemo(() => {
    if (recipientType === 'INDIVIDUAL' && individualId) {
      const s = students.find((x) => x.id === individualId);
      return s ? `Roll No. ${s.rollNo} – ${s.name}` : 'One student';
    }
    if (recipientType === 'SPECIFIC_STUDENTS') {
      return `${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? '' : 's'} selected`;
    }
    if (recipientType === 'ALL_STUDENTS') return 'All accessible students';
    if (recipientType === 'CLASS_GROUP' && groupId && !selectedSectionIds.length) {
      const g = (options.groups || []).find((x) => x.id === groupId);
      return g?.label || 'Class group';
    }
    if (selectedSections.length === 1) return selectedSections[0].label;
    if (selectedSections.length > 1) {
      return selectedSections
        .slice(0, 4)
        .map((s) => s.label)
        .join(', ');
    }
    return 'No recipients selected';
  }, [
    recipientType,
    individualId,
    students,
    selectedStudentIds,
    selectedSections,
    groupId,
    options.groups,
  ]);

  const recipientCards = RECIPIENT_OPTIONS.filter(
    (o) => o.id !== 'ALL_STUDENTS' || options.canSendAllStudents
  );

  const filterChips = useMemo(() => {
    const chips = [{ id: 'all', label: 'All' }];
    for (const g of options.groups || []) {
      chips.push({ id: g.id, label: g.label });
    }
    return chips;
  }, [options.groups]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-indigo-700">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="-mx-1 pb-28 lg:pb-24">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {toast && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {toast}
        </div>
      )}

      {showSuddenHoliday ? (
        <div className="mb-5 overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setComposerMode('sudden');
              setError('');
              refreshHolidayMessage(holidayReason, holidayDate, holidayDateTo);
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-amber-100/60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <CloudRain size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-amber-950">Sudden Holiday</span>
              <span className="mt-0.5 block text-xs text-amber-900/80">
                School closure + WhatsApp parents (rain, strike, etc.) — tap to open
              </span>
            </span>
            <span className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">
              Open
            </span>
          </button>
        </div>
      ) : null}

      {showSuddenHoliday ? (
        <div className="mb-5 inline-flex rounded-xl border border-indigo-100 bg-indigo-50 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => {
              setComposerMode('notify');
              setError('');
            }}
            className={`rounded-lg px-4 py-2 ${
              composerMode === 'notify' ? 'bg-indigo-700 text-white' : 'text-indigo-900 hover:bg-white/70'
            }`}
          >
            Send Notification
          </button>
          <button
            type="button"
            onClick={() => {
              setComposerMode('sudden');
              setError('');
              refreshHolidayMessage(holidayReason, holidayDate, holidayDateTo);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 ${
              composerMode === 'sudden' ? 'bg-indigo-700 text-white' : 'text-indigo-900 hover:bg-white/70'
            }`}
          >
            <CloudRain size={16} />
            Sudden Holiday
          </button>
        </div>
      ) : null}

      {showSuddenHoliday && composerMode === 'sudden' ? (
        <form
          onSubmit={submitSuddenHoliday}
          className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div>
            <h2 className="text-lg font-bold text-gray-900">Sudden Holiday Configuration</h2>
            <p className="mt-1 text-sm text-gray-500">
              For rain, strike, or other unplanned closures at {displaySchool}. Saves to the academic
              calendar and sends the WhatsApp <span className="font-semibold">sudden_holiday</span>{' '}
              template to parents.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                From date *
              </span>
              <input
                type="date"
                required
                value={holidayDate}
                onChange={(e) => {
                  const date = e.target.value;
                  setHolidayDate(date);
                  refreshHolidayMessage(holidayReason, date, holidayDateTo);
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                To date (optional)
              </span>
              <input
                type="date"
                min={holidayDate}
                value={holidayDateTo}
                onChange={(e) => {
                  const dateTo = e.target.value;
                  setHolidayDateTo(dateTo);
                  refreshHolidayMessage(holidayReason, holidayDate, dateTo);
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Reason *
            </span>
            <input
              type="text"
              required
              value={holidayReason}
              placeholder="e.g. Heavy Rain"
              onChange={(e) => {
                const reason = e.target.value;
                setHolidayReason(reason);
                refreshHolidayMessage(reason, holidayDate, holidayDateTo);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Applicable to
            </span>
            <select
              value={holidayApplicableTo}
              onChange={(e) => setHolidayApplicableTo(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            >
              {APPLICABLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Message to parents
            </span>
            <textarea
              rows={5}
              value={holidayMessage}
              onChange={(e) => setHolidayMessage(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Preview for notice board / SMS wording. WhatsApp uses the approved Meta template with
              reason + dates.
            </span>
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={holidaySaving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
            >
              {holidaySaving ? <Loader2 className="animate-spin" size={16} /> : <CloudRain size={16} />}
              Save &amp; Notify Parents
            </button>
            <button
              type="button"
              onClick={() => setComposerMode('notify')}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
            >
              Back to Notify
            </button>
            {typeof onNavigate === 'function' ? (
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800"
              >
                Open Academic Calendar
              </button>
            ) : null}
          </div>
        </form>
      ) : (
      <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        {/* LEFT */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-semibold text-gray-900">
              Who do you want to notify?
            </h2>
            <div className="mt-4 space-y-2.5">
              {showSuddenHoliday ? (
                <button
                  type="button"
                  onClick={() => {
                    setComposerMode('sudden');
                    setError('');
                    refreshHolidayMessage(holidayReason, holidayDate, holidayDateTo);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                    composerMode === 'sudden'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-amber-200 bg-amber-50/50 hover:border-amber-400'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      composerMode === 'sudden'
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <CloudRain size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-amber-950">
                      Sudden Holiday
                    </span>
                    <span className="mt-0.5 block text-xs text-amber-900/70">
                      School closure + WhatsApp parents (rain, strike, etc.)
                    </span>
                  </span>
                </button>
              ) : null}
              {recipientCards.map((opt) => {
                const Icon = opt.icon;
                const active = composerMode === 'notify' && recipientType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setComposerMode('notify');
                      setRecipientType(opt.id);
                      setError('');
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                      active
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-semibold ${
                          active ? 'text-indigo-900' : 'text-gray-900'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">{opt.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            {(recipientType === 'ENTIRE_CLASS' || recipientType === 'CLASS_GROUP') && (
              <>
                <h2 className="text-base font-semibold text-gray-900">
                  {recipientType === 'CLASS_GROUP'
                    ? 'Select class group or classes'
                    : 'Select Classes / Sections'}
                </h2>

                {recipientType === 'CLASS_GROUP' && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Preset groups
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {(options.groups || []).map((g) => {
                        const on = groupId === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => applyPresetGroup(g.id)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              on
                                ? 'bg-indigo-600 text-white'
                                : 'border border-indigo-200 bg-white text-indigo-700'
                            }`}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                      {groupId && selectedSectionIds.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            title="Add another class"
                            onClick={() => setAddClassOpen((v) => !v)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          >
                            <Plus size={16} strokeWidth={2.5} />
                          </button>
                          {addClassOpen && (
                            <div className="absolute left-0 top-10 z-20 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Add class
                              </p>
                              {classesAvailableToAdd.length ? (
                                classesAvailableToAdd.map((klass) => (
                                  <button
                                    key={klass.id}
                                    type="button"
                                    onClick={() => addClassToSelection(klass)}
                                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium text-gray-800 hover:bg-indigo-50"
                                  >
                                    <span>{formatClassName(klass.name)}</span>
                                    <Plus size={14} className="text-indigo-600" />
                                  </button>
                                ))
                              ) : (
                                <p className="px-2 py-2 text-xs text-gray-500">
                                  No more classes to add.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Select a band (e.g. 1–9), then tap <strong>+</strong> to add another
                      class like 10.
                    </p>
                    <p className="pt-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Or select classes manually
                    </p>
                  </div>
                )}

                <div className="relative mt-3">
                  <input
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    placeholder="Search class or section..."
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-indigo-500"
                  />
                  <Search
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {filterChips.map((chip) => {
                    const on = filterChip === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => applyFilterChip(chip.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          on
                            ? 'bg-indigo-600 text-white'
                            : 'border border-gray-200 bg-white text-indigo-700'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                  {recipientType === 'ENTIRE_CLASS' &&
                    filterChip !== 'all' &&
                    selectedSectionIds.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          title="Add another class"
                          onClick={() => setAddClassOpen((v) => !v)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                        {addClassOpen && (
                          <div className="absolute left-0 top-10 z-20 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                              Add class
                            </p>
                            {classesAvailableToAdd.length ? (
                              classesAvailableToAdd.map((klass) => (
                                <button
                                  key={klass.id}
                                  type="button"
                                  onClick={() => addClassToSelection(klass)}
                                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium text-gray-800 hover:bg-indigo-50"
                                >
                                  <span>{formatClassName(klass.name)}</span>
                                  <Plus size={14} className="text-indigo-600" />
                                </button>
                              ))
                            ) : (
                              <p className="px-2 py-2 text-xs text-gray-500">
                                No more classes to add.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </div>

                {selectedSections.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">
                        Selected ({selectedSections.length})
                      </p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-600"
                        onClick={() => {
                          setSelectedSectionIds([]);
                          setGroupId('');
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedSections.map((s) => (
                        <span
                          key={s.sectionId}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          {s.label}
                          <button type="button" onClick={() => toggleSection(s.sectionId)}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs font-medium text-indigo-700">
                      {selectedSections.length} sections selected • {selectedStudentCount}{' '}
                      students
                    </p>
                  </div>
                )}

                <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                  {filteredClasses.map((klass) => {
                    const expanded = expandedClasses.has(klass.id);
                    const state = classCheckState(klass);
                    const totalStudents = (klass.sections || []).reduce(
                      (n, s) => n + (s.studentCount || 0),
                      0
                    );
                    return (
                      <div key={klass.id} className="bg-white">
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleWholeClass(klass)}
                            className="flex h-5 w-5 items-center justify-center rounded border border-gray-300"
                            aria-label={`Toggle ${klass.name}`}
                          >
                            {state === 'all' ? (
                              <span className="h-3 w-3 rounded-sm bg-indigo-600" />
                            ) : state === 'partial' ? (
                              <Minus size={12} className="text-indigo-600" />
                            ) : null}
                          </button>
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            onClick={() => toggleExpand(klass.id)}
                          >
                            <span className="truncate text-sm font-semibold text-gray-900">
                              {formatClassName(klass.name)}
                            </span>
                            <span className="ml-auto shrink-0 text-xs text-gray-500">
                              {totalStudents} students
                            </span>
                            {expanded ? (
                              <ChevronDown size={16} className="text-gray-400" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-400" />
                            )}
                          </button>
                        </div>
                        {expanded && (
                          <div className="space-y-1 bg-slate-50 px-3 pb-3 pl-10">
                            <label className="flex items-center gap-2 py-1 text-xs font-medium text-indigo-700">
                              <input
                                type="checkbox"
                                checked={state === 'all'}
                                onChange={() => toggleWholeClass(klass)}
                              />
                              Select all sections
                            </label>
                            {(klass.sections || []).map((sec) => {
                              const on = selectedSectionIds.includes(sec.id);
                              return (
                                <label
                                  key={sec.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white"
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleSection(sec.id)}
                                  />
                                  <span className="flex-1 text-gray-800">
                                    {sectionChipLabel(klass.name, sec.name)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {sec.studentCount || 0}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!filteredClasses.length && (
                    <p className="px-4 py-6 text-center text-sm text-gray-500">
                      No classes match this filter.
                    </p>
                  )}
                </div>
              </>
            )}

            {(recipientType === 'SPECIFIC_STUDENTS' || recipientType === 'INDIVIDUAL') && (
              <>
                <h2 className="text-base font-semibold text-gray-900">Select students</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Class *</label>
                    <select
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                      value={classId}
                      onChange={(e) => {
                        setClassId(e.target.value);
                        setSectionId('');
                        setSelectedStudentIds([]);
                        setIndividualId('');
                      }}
                    >
                      <option value="">Select class</option>
                      {(options.classes || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatClassName(c.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Section *
                    </label>
                    <select
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                      value={sectionId}
                      disabled={!classId}
                      onChange={(e) => {
                        setSectionId(e.target.value);
                        setSelectedStudentIds([]);
                        setIndividualId('');
                      }}
                    >
                      <option value="">Select section</option>
                      {sectionsForClass.map((s) => (
                        <option key={s.id} value={s.id}>
                          Section {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {sectionId && (
                  <>
                    <div className="relative mt-3">
                      <input
                        value={studentQuery}
                        onChange={(e) => setStudentQuery(e.target.value)}
                        placeholder="Search by name or roll number"
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-3 pr-10 text-sm"
                      />
                      <Search
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                    </div>
                    {recipientType === 'SPECIFIC_STUDENTS' && (
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="font-semibold text-indigo-700">
                          {selectedStudentIds.length} Students Selected
                        </span>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className="font-semibold text-indigo-600"
                            onClick={() => setSelectedStudentIds(students.map((s) => s.id))}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="font-semibold text-gray-500"
                            onClick={() => setSelectedStudentIds([])}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
                      {students.map((s) => {
                        const label = `Roll No. ${s.rollNo} – ${s.name}`;
                        if (recipientType === 'INDIVIDUAL') {
                          return (
                            <label
                              key={s.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                                individualId === s.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="individual"
                                checked={individualId === s.id}
                                onChange={() => setIndividualId(s.id)}
                              />
                              {label}
                            </label>
                          );
                        }
                        const on = selectedStudentIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                              on ? 'bg-indigo-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setSelectedStudentIds((prev) =>
                                  on ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                                )
                              }
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {recipientType === 'ALL_STUDENTS' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This notifies a large audience
                {options.allStudentsIsSchoolWide
                  ? ' across accessible school classes'
                  : ' across all your assigned classes'}
                . Confirm carefully before sending.
              </div>
            )}
          </section>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-semibold text-gray-900">Notification Details</h2>
            <label className="mt-4 mb-1 block text-xs font-medium text-gray-500">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              placeholder="e.g. Classwork reminder – Class 6"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{title.length}/100</p>

            <label className="mt-2 mb-1 block text-xs font-medium text-gray-500">Message *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={6}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              placeholder="Write your message…"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{message.length}/500</p>

            <p className="mt-3 text-xs font-medium text-gray-500">Attachment (optional)</p>
            {attachment && (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{attachment.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(attachment.size)}</p>
                </div>
                <button type="button" onClick={() => setAttachment(null)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            )}
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
              <Paperclip size={16} />
              {attachment ? 'Replace file' : '+ Add Another File'}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              />
            </label>
            <p className="mt-1 text-xs text-gray-400">PDF, DOC/DOCX, images, Excel</p>

            <label className="mt-4 mb-1 block text-xs font-medium text-gray-500">
              Category (Optional)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            >
              {(options.categories || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-semibold text-gray-900">When to send</h2>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="radio"
                  checked={delivery === 'now'}
                  onChange={() => setDelivery('now')}
                  className="accent-indigo-600"
                />
                Send Now
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="radio"
                  checked={delivery === 'later'}
                  onChange={() => setDelivery('later')}
                  className="accent-indigo-600"
                />
                Schedule for Later
              </label>
            </div>
            {delivery === 'later' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Delivery channels</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Always published to the parent Notice Board. WhatsApp uses the school’s
                  approved Meta template.
                </p>
              </div>
              {sendViaWhatsApp && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  WhatsApp on
                </span>
              )}
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-3">
              <input
                type="checkbox"
                checked={sendViaWhatsApp}
                onChange={(e) => setSendViaWhatsApp(e.target.checked)}
                className="mt-0.5 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  Send via WhatsApp
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  Parents with a registered phone receive the notice on WhatsApp (same
                  integration as sudden holiday alerts). Missing numbers are skipped.
                </span>
              </span>
            </label>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-semibold text-gray-900">Preview</h2>
            <div className="mt-3 rounded-2xl border border-gray-100 bg-gradient-to-b from-slate-50 to-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  {(user?.name || 'T').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{user?.name || 'Teacher'}</p>
                  <p className="text-xs text-gray-500">
                    {user?.role || 'Teacher'} · Just now
                  </p>
                  <p className="mt-2 text-xs font-medium text-indigo-700">
                    To: {livePreviewRecipients}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {title.trim() || 'Notification title'}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                    {message.trim() || 'Your message will appear here…'}
                  </p>
                  {attachment && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700">
                      <FileText size={14} />
                      {attachment.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* FOOTER */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-indigo-100 bg-indigo-50/95 px-3 py-3 backdrop-blur lg:left-[var(--sidebar-w,0px)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm text-indigo-900">
            <div className="flex items-center gap-2 font-semibold">
              <Users size={16} />
              {recipientType === 'SPECIFIC_STUDENTS'
                ? `${selectedStudentIds.length} Students Selected`
                : recipientType === 'INDIVIDUAL'
                  ? individualId
                    ? '1 Student Selected'
                    : 'No student selected'
                  : recipientType === 'ALL_STUDENTS'
                    ? 'All accessible students'
                    : groupId && !selectedSectionIds.length
                      ? (options.groups || []).find((g) => g.id === groupId)?.label ||
                        'Class group'
                      : `${selectedSections.length} Sections Selected`}
            </div>
            <p className="truncate text-xs text-indigo-700/80">
              {recipientType === 'ENTIRE_CLASS' ||
              (recipientType === 'CLASS_GROUP' && selectedSections.length)
                ? selectedSections.map((s) => s.label).join(', ') || '—'
                : livePreviewRecipients}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {(recipientType === 'ENTIRE_CLASS' ||
              (recipientType === 'CLASS_GROUP' && selectedSections.length > 0)) && (
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                  Total Students
                </p>
                <p className="text-2xl font-bold text-indigo-700">{selectedStudentCount}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => askSend(true)}
              disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-indigo-600 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 disabled:opacity-50"
            >
              {busy === 'draft' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => askSend(false)}
              disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy === 'send' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Send Notification
            </button>
          </div>
        </div>
      </div>


      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Send Notification?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This notification will be sent to{' '}
              <span className="font-semibold text-gray-900">{livePreviewRecipients}</span>
              {delivery === 'later' ? ' at the scheduled time' : ' now'}
              {sendViaWhatsApp
                ? ' via the parent Notice Board and WhatsApp'
                : ' via the parent Notice Board'}
              .
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white"
                onClick={() => doSave(false)}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
