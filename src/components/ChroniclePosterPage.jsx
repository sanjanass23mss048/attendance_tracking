import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  ImagePlus,
  Layers,
  LoaderCircle,
  Minus,
  Pencil,
  RefreshCw,
  School,
  Search,
  Send,
  Share2,
  Sparkles,
  Users,
  UserRound,
  Wand2,
  X,
} from 'lucide-react';
import { useBranding } from '../lib/branding.jsx';
import {
  COLOR_THEMES,
  OCCASIONS,
  POSTER_SIZES,
  POSTER_STYLES,
  formatPosterDate,
  generatePosterCopy,
  getColorTheme,
  getOccasion,
  getPosterSize,
} from '../data/chroniclePosterData.js';
import {
  posterToBlob,
  posterToDataUrl,
  renderChroniclePoster,
} from '../lib/chroniclePosterRender.js';
import { listSavedChronicles, saveChronicleEntry } from '../services/chronicleService.js';
import {
  getNotificationComposerOptions,
  getNotificationStudents,
  saveTeacherNotification,
} from '../services/teacherNotificationService.js';
import { showToast } from '../services/toast.js';

const AUDIENCES = [
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
  {
    id: 'PUBLIC',
    label: 'Public Chronicle (notice board)',
    hint: 'School-wide notice board post (no WhatsApp blast)',
    icon: Sparkles,
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

export default function ChroniclePosterPage({ onNavigate }) {
  const { schoolName, logoSrc, hasLogo } = useBranding();
  const displaySchool = schoolName || 'St. Joseph School';

  const [mode, setMode] = useState('poster'); // poster | library
  const [occasionId, setOccasionId] = useState('independence-day');
  const [eventDate, setEventDate] = useState('2026-08-15');
  const [title, setTitle] = useState('Happy Independence Day');
  const [message, setMessage] = useState('');
  const [styleId, setStyleId] = useState('patriotic');
  const [sizeId, setSizeId] = useState('square');
  const [colorId, setColorId] = useState('navy');
  const [messageVariant, setMessageVariant] = useState(0);
  const [designIndex, setDesignIndex] = useState(0);
  const [previews, setPreviews] = useState(['', '', '']);
  const [rendering, setRendering] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [audience, setAudience] = useState('ENTIRE_CLASS');
  const [showPublish, setShowPublish] = useState(false);
  const [saved, setSaved] = useState(() => listSavedChronicles());
  const [attachmentSrcs, setAttachmentSrcs] = useState([]);
  const canvasRef = useRef(null);
  const autoSeeded = useRef(false);
  const attachInputRef = useRef(null);

  const [composerOptions, setComposerOptions] = useState({
    classes: [],
    groups: [],
    canSendAllStudents: false,
    allStudentsIsSchoolWide: false,
  });
  const [optionsLoading, setOptionsLoading] = useState(false);
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

  const occasion = getOccasion(occasionId);
  const size = getPosterSize(sizeId);
  const color = getColorTheme(colorId);
  const dateLabel = formatPosterDate(eventDate);

  const seedCopy = (occId = occasionId, keepTitle = false) => {
    const copy = generatePosterCopy({
      occasionId: occId,
      schoolName: displaySchool,
      dateLabel: formatPosterDate(eventDate),
    });
    if (!keepTitle) setTitle(copy.title);
    setMessage(copy.messages[0]);
    setMessageVariant(0);
    setStyleId(copy.styleId);
    setColorId(copy.colorId);
    return copy;
  };

  useEffect(() => {
    if (autoSeeded.current) return;
    autoSeeded.current = true;
    seedCopy('independence-day');
  }, []);

  useEffect(() => {
    if (!showPublish) return;
    let cancelled = false;
    (async () => {
      setOptionsLoading(true);
      try {
        const data = await getNotificationComposerOptions();
        if (cancelled) return;
        setComposerOptions(data);
        const firstIds = (data.classes || []).slice(0, 3).map((c) => c.id);
        setExpandedClasses(new Set(firstIds));
      } catch (err) {
        if (!cancelled) showToast(err.message || 'Could not load class options', 'error');
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPublish]);

  useEffect(() => {
    if (!showPublish || audience !== 'SPECIFIC_STUDENTS' || !sectionId) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const data = await getNotificationStudents({ sectionId, q: studentQuery });
        if (!cancelled) setStudents(data.students || []);
      } catch (err) {
        if (!cancelled) showToast(err.message || 'Could not load students', 'error');
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [showPublish, audience, sectionId, studentQuery]);

  const sectionMeta = useMemo(() => {
    const map = new Map();
    for (const klass of composerOptions.classes || []) {
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
  }, [composerOptions.classes]);

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
    return (composerOptions.classes || []).filter((klass) => {
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
  }, [composerOptions.classes, filterChip, classSearch]);

  const sectionsForClass = useMemo(() => {
    const klass = (composerOptions.classes || []).find((c) => c.id === classId);
    return klass?.sections || [];
  }, [composerOptions.classes, classId]);

  const audienceOptions = useMemo(
    () =>
      AUDIENCES.filter((o) => o.id !== 'ALL_STUDENTS' || composerOptions.canSendAllStudents),
    [composerOptions.canSendAllStudents]
  );

  const filterChips = useMemo(
    () => [{ id: 'all', label: 'All' }, ...(composerOptions.groups || [])],
    [composerOptions.groups]
  );

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
    if (chipId === 'all') return;
    const ids = [];
    for (const klass of composerOptions.classes || []) {
      if (!matchesGroup(klass.name, chipId)) continue;
      for (const sec of klass.sections || []) ids.push(sec.id);
    }
    setGroupId(chipId);
    setSelectedSectionIds(ids);
  };

  const applyPresetGroup = (gid) => {
    setFilterChip(gid);
    setGroupId(gid);
    const ids = [];
    for (const klass of composerOptions.classes || []) {
      if (!matchesGroup(klass.name, gid)) continue;
      for (const sec of klass.sections || []) ids.push(sec.id);
    }
    setSelectedSectionIds(ids);
  };

  const resetAudiencePickers = () => {
    setSelectedSectionIds([]);
    setGroupId('');
    setFilterChip('all');
    setClassSearch('');
    setClassId('');
    setSectionId('');
    setStudents([]);
    setStudentQuery('');
    setSelectedStudentIds([]);
  };

  const openPublish = () => {
    resetAudiencePickers();
    setAudience('ENTIRE_CLASS');
    setShowPublish(true);
  };

  const validateAudience = () => {
    if (audience === 'ENTIRE_CLASS' && !selectedSectionIds.length) {
      return 'Select at least one class section';
    }
    if (audience === 'CLASS_GROUP' && !selectedSectionIds.length && !groupId) {
      return 'Select a class group or choose classes manually';
    }
    if (audience === 'SPECIFIC_STUDENTS') {
      if (!sectionId) return 'Select a class and section';
      if (!selectedStudentIds.length) return 'Select at least one student';
    }
    return '';
  };

  const buildOptions = (design) => ({
    width: size.width,
    height: size.height,
    schoolName: displaySchool,
    title,
    message,
    dateLabel,
    logoSrc,
    attachmentSrcs,
    styleId,
    color,
    designIndex: design,
    emoji: occasion.emoji,
  });

  const onAttachFiles = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    const room = Math.max(0, 5 - attachmentSrcs.length);
    if (!room) {
      showToast('Up to 5 images allowed', 'error');
      return;
    }
    const take = files.slice(0, room);
    Promise.all(
      take.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
          })
      )
    ).then((urls) => {
      const next = urls.filter(Boolean);
      if (!next.length) {
        showToast('Could not read image files', 'error');
        return;
      }
      setAttachmentSrcs((prev) => [...prev, ...next].slice(0, 5));
    });
  };

  const removeAttachment = (idx) => {
    setAttachmentSrcs((prev) => prev.filter((_, i) => i !== idx));
  };

  const regenerateDesigns = async ({ silent = false } = {}) => {
    if (!title.trim() || !message.trim()) {
      if (!silent) showToast('Title and message are required', 'error');
      return;
    }
    setRendering(true);
    try {
      const urls = [];
      for (let i = 0; i < 3; i += 1) {
        const canvas = await renderChroniclePoster(buildOptions(i));
        urls.push(posterToDataUrl(canvas));
      }
      canvasRef.current = await renderChroniclePoster(buildOptions(designIndex));
      setPreviews(urls);
      if (!silent) showToast('3 poster designs ready', 'success');
    } catch (err) {
      showToast(err.message || 'Could not generate poster', 'error');
    } finally {
      setRendering(false);
    }
  };

  useEffect(() => {
    if (!title || !message) return;
    const t = setTimeout(() => {
      regenerateDesigns({ silent: true });
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, message, styleId, sizeId, colorId, eventDate, occasionId, logoSrc, displaySchool, attachmentSrcs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!previews[designIndex]) return;
      try {
        const canvas = await renderChroniclePoster(buildOptions(designIndex));
        if (!cancelled) canvasRef.current = canvas;
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designIndex]);

  const onOccasionChange = (id) => {
    setOccasionId(id);
    seedCopy(id);
  };

  const aiGenerateMessage = () => {
    const copy = generatePosterCopy({
      occasionId,
      schoolName: displaySchool,
      dateLabel,
    });
    const next = (messageVariant + 1) % copy.messages.length;
    setMessageVariant(next);
    setMessage(copy.messages[next]);
    if (!title.trim()) setTitle(copy.title);
    showToast('Message regenerated', 'success');
  };

  const downloadPoster = () => {
    const url = previews[designIndex];
    if (!url) {
      showToast('Generate a poster first', 'error');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronicle-${occasionId}-${sizeId}-d${designIndex + 1}.png`;
    a.click();
  };

  const sharePoster = async () => {
    try {
      const canvas = canvasRef.current || (await renderChroniclePoster(buildOptions(designIndex)));
      const blob = await posterToBlob(canvas);
      const file = new File([blob], 'chronicle-poster.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title,
          text: message,
          files: [file],
        });
        return;
      }
      downloadPoster();
      showToast('Sharing not supported — downloaded instead', 'success');
    } catch (err) {
      if (err?.name !== 'AbortError') showToast(err.message || 'Share failed', 'error');
    }
  };

  const saveLocal = () => {
    if (!previews[designIndex]) {
      showToast('Generate a poster first', 'error');
      return;
    }
    const next = saveChronicleEntry({
      occasionId,
      title,
      message,
      eventDate,
      styleId,
      sizeId,
      colorId,
      designIndex,
      previewUrl: previews[designIndex],
      schoolName: displaySchool,
    });
    setSaved(next);
    showToast('Saved to My Chronicles', 'success');
  };

  const publish = async () => {
    if (!previews[designIndex]) {
      showToast('Generate a poster first', 'error');
      return;
    }
    const validationError = validateAudience();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    let recipientType = audience;
    let sectionIds = [];
    let studentIds = [];
    let payloadGroupId = null;
    let sendViaWhatsApp = true;

    if (audience === 'PUBLIC') {
      recipientType = 'ALL_STUDENTS';
      sendViaWhatsApp = false;
    } else if (audience === 'ENTIRE_CLASS') {
      sectionIds = selectedSectionIds;
    } else if (audience === 'CLASS_GROUP') {
      if (selectedSectionIds.length) sectionIds = selectedSectionIds;
      else payloadGroupId = groupId || null;
    } else if (audience === 'SPECIFIC_STUDENTS') {
      sectionIds = sectionId ? [sectionId] : [];
      studentIds = selectedStudentIds;
    }

    setPublishing(true);
    try {
      const canvas = canvasRef.current || (await renderChroniclePoster(buildOptions(designIndex)));
      const blob = await posterToBlob(canvas);
      const file = new File([blob], `chronicle-${occasionId}.png`, { type: 'image/png' });
      const data = await saveTeacherNotification(
        {
          title: title.slice(0, 100),
          message: message.slice(0, 500),
          category: 'Chronicle',
          recipientType,
          sectionIds,
          studentIds,
          groupId: payloadGroupId,
          delivery: 'now',
          scheduledAt: null,
          asDraft: false,
          sendViaWhatsApp,
        },
        file
      );
      saveLocal();
      setShowPublish(false);
      const count = data?.notification?.recipientCount;
      const summary =
        audience === 'PUBLIC'
          ? 'Published to parent notice board / chronicle'
          : count != null
            ? `Poster published to ${count} student(s)`
            : 'Poster published';
      showToast(summary, 'success');
    } catch (err) {
      showToast(err.message || 'Could not publish poster', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const charCount = message.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
            Chronicle <span className="text-gray-400">›</span> Create Poster
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Create Chronicle Poster</h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter the event — we generate branded poster designs ready to share.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === 'library' ? 'poster' : 'library')}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {mode === 'library' ? 'Create Poster' : 'My Chronicles'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('send-notification')}
            className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Create Manually
          </button>
        </div>
      </div>

      {mode === 'library' ? (
        <LibraryView
          items={saved}
          onUse={(item) => {
            setOccasionId(item.occasionId || 'custom');
            setTitle(item.title || '');
            setMessage(item.message || '');
            setEventDate(item.eventDate || eventDate);
            setStyleId(item.styleId || 'minimal');
            setSizeId(item.sizeId || 'square');
            setColorId(item.colorId || 'navy');
            setDesignIndex(item.designIndex || 0);
            setPreviews([item.previewUrl, item.previewUrl, item.previewUrl]);
            setMode('poster');
          }}
        />
      ) : (
        <>
          <div className="inline-flex rounded-xl border border-violet-100 bg-violet-50 p-1 text-sm font-semibold">
            <span className="rounded-lg bg-violet-700 px-3 py-1.5 text-white">✨ Generate Poster</span>
            <button
              type="button"
              onClick={() => onNavigate?.('send-notification')}
              className="rounded-lg px-3 py-1.5 text-violet-800 hover:bg-white/70"
            >
              Create Manually
            </button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <Field label="Select Occasion / Event">
                <select
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  value={occasionId}
                  onChange={(e) => onOccasionChange(e.target.value)}
                >
                  {OCCASIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.emoji} {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date">
                <input
                  type="date"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </Field>

              <Field label="Title">
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium"
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>

              <Field
                label="Message (Optional)"
                hint={`${Math.min(charCount, 250)} / 250`}
              >
                <textarea
                  className="min-h-[96px] w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  value={message}
                  maxLength={250}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>

              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  School Logo
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={logoSrc}
                    alt=""
                    className="h-12 w-12 rounded-lg border border-gray-200 bg-white object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{displaySchool}</p>
                    <p className="text-xs text-gray-500">
                      {hasLogo ? '✓ School logo from branding' : 'Using default logo — upload in Settings'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('settings')}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                  >
                    Change
                  </button>
                </div>
              </div>

              <Field label="Poster images" hint={`${attachmentSrcs.length} / 5`}>
                <input
                  ref={attachInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onAttachFiles}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {attachmentSrcs.map((src, idx) => (
                    <div
                      key={`attach-${idx}`}
                      className="relative h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-white"
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                        aria-label="Remove image"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {attachmentSrcs.length < 5 ? (
                    <button
                      type="button"
                      onClick={() => attachInputRef.current?.click()}
                      className="inline-flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-gray-300 bg-white text-gray-500 hover:border-violet-400 hover:text-violet-700"
                    >
                      <ImagePlus size={18} />
                      <span className="text-[10px] font-semibold">Add</span>
                    </button>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  Optional photos shown on the poster (up to 5).
                </p>
              </Field>

              <Field label="Poster Style">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {POSTER_STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyleId(s.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                        styleId === s.id
                          ? 'border-violet-600 bg-violet-50 font-semibold text-violet-900'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      {s.label}
                      <span className="mt-0.5 block text-[10px] font-normal text-gray-500">
                        {s.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Poster Size">
                <div className="flex flex-wrap gap-2">
                  {POSTER_SIZES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSizeId(s.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        sizeId === s.id
                          ? 'bg-violet-700 text-white'
                          : 'border border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Primary Color Theme">
                <div className="flex flex-wrap gap-2">
                  {COLOR_THEMES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => setColorId(c.id)}
                      className={`h-9 w-9 rounded-full border-2 ${
                        colorId === c.id ? 'border-gray-900 ring-2 ring-offset-2 ring-violet-400' : 'border-white'
                      }`}
                      style={{
                        background:
                          c.id === 'multi'
                            ? 'conic-gradient(#7c3aed, #db2777, #f59e0b, #7c3aed)'
                            : c.primary,
                      }}
                    />
                  ))}
                </div>
              </Field>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={regenerateDesigns}
                  disabled={rendering}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {rendering ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Generate Poster
                </button>
                <button
                  type="button"
                  onClick={aiGenerateMessage}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 hover:bg-violet-100"
                >
                  <Wand2 size={16} />
                  AI Generate Message
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900">Live Preview</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={downloadPoster}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
                    >
                      <Download size={14} /> Download
                    </button>
                    <button
                      type="button"
                      onClick={sharePoster}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
                    >
                      <Share2 size={14} /> Share
                    </button>
                  </div>
                </div>

                <div
                  className="mx-auto overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-inner"
                  style={{ aspectRatio: size.ratio, maxWidth: sizeId === 'landscape' ? '100%' : 420 }}
                >
                  {previews[designIndex] ? (
                    <img
                      src={previews[designIndex]}
                      alt="Poster preview"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-gray-500">
                      {rendering ? 'Generating…' : 'Fill details to preview'}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      document.querySelector('textarea')?.focus();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                  >
                    <Pencil size={14} /> Edit Text
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDesignIndex((d) => (d + 1) % 3);
                      regenerateDesigns();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                  >
                    <RefreshCw size={14} /> Change Design
                  </button>
                  <button
                    type="button"
                    onClick={openPublish}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white"
                  >
                    <Send size={14} /> Publish
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">More Design Options</h3>
                  <button
                    type="button"
                    onClick={regenerateDesigns}
                    className="text-xs font-semibold text-violet-700"
                  >
                    Generate More
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {previews.map((url, idx) => (
                    <button
                      key={`design-${idx}`}
                      type="button"
                      onClick={() => setDesignIndex(idx)}
                      className={`overflow-hidden rounded-xl border-2 ${
                        designIndex === idx ? 'border-violet-600' : 'border-gray-100'
                      }`}
                    >
                      {url ? (
                        <img src={url} alt={`Design ${idx + 1}`} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center bg-gray-50 text-[10px] text-gray-400">
                          Design {idx + 1}
                        </div>
                      )}
                      <p className="bg-white py-1 text-center text-[10px] font-semibold text-gray-600">
                        Design {idx + 1}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showPublish ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-bold text-gray-900">Publish Chronicle Poster</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose who should receive this poster on the parent notice board.
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                {audienceOptions.map((a) => {
                  const Icon = a.icon;
                  const active = audience === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAudience(a.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                        active
                          ? 'border-violet-600 bg-violet-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          active ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block font-semibold ${
                            active ? 'text-violet-900' : 'text-gray-900'
                          }`}
                        >
                          {a.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">{a.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {optionsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                  <LoaderCircle className="animate-spin" size={16} />
                  Loading classes…
                </div>
              ) : null}

              {!optionsLoading && (audience === 'ENTIRE_CLASS' || audience === 'CLASS_GROUP') ? (
                <div className="space-y-3 rounded-xl border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {audience === 'CLASS_GROUP'
                      ? 'Select class group or classes'
                      : 'Select Classes / Sections'}
                  </p>

                  {audience === 'CLASS_GROUP' ? (
                    <div className="flex flex-wrap gap-2">
                      {(composerOptions.groups || []).map((g) => {
                        const on = groupId === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => applyPresetGroup(g.id)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              on
                                ? 'bg-violet-600 text-white'
                                : 'border border-violet-200 bg-white text-violet-700'
                            }`}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="relative">
                    <input
                      value={classSearch}
                      onChange={(e) => setClassSearch(e.target.value)}
                      placeholder="Search class or section..."
                      className="w-full rounded-xl border border-gray-200 py-2 pl-3 pr-10 text-sm outline-none focus:border-violet-500"
                    />
                    <Search
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {filterChips.map((chip) => {
                      const on = filterChip === chip.id;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => applyFilterChip(chip.id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            on
                              ? 'bg-violet-600 text-white'
                              : 'border border-gray-200 bg-white text-violet-700'
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedSections.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700">
                          Selected ({selectedSections.length}) · {selectedStudentCount} students
                        </p>
                        <button
                          type="button"
                          className="text-xs font-semibold text-violet-600"
                          onClick={() => {
                            setSelectedSectionIds([]);
                            setGroupId('');
                          }}
                        >
                          Clear
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedSections.map((s) => (
                          <span
                            key={s.sectionId}
                            className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                          >
                            {s.label}
                            <button type="button" onClick={() => toggleSection(s.sectionId)}>
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
                    {filteredClasses.map((klass) => {
                      const expanded = expandedClasses.has(klass.id);
                      const state = classCheckState(klass);
                      const totalStudents = (klass.sections || []).reduce(
                        (n, s) => n + (s.studentCount || 0),
                        0
                      );
                      return (
                        <div key={klass.id}>
                          <div className="flex items-center gap-2 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => toggleWholeClass(klass)}
                              className="flex h-5 w-5 items-center justify-center rounded border border-gray-300"
                              aria-label={`Toggle ${klass.name}`}
                            >
                              {state === 'all' ? (
                                <span className="h-3 w-3 rounded-sm bg-violet-600" />
                              ) : state === 'partial' ? (
                                <Minus size={12} className="text-violet-600" />
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
                                {totalStudents}
                              </span>
                              {expanded ? (
                                <ChevronDown size={16} className="text-gray-400" />
                              ) : (
                                <ChevronRight size={16} className="text-gray-400" />
                              )}
                            </button>
                          </div>
                          {expanded ? (
                            <div className="space-y-1 bg-slate-50 px-3 pb-2 pl-10">
                              {(klass.sections || []).map((sec) => {
                                const on = selectedSectionIds.includes(sec.id);
                                return (
                                  <label
                                    key={sec.id}
                                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white"
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
                          ) : null}
                        </div>
                      );
                    })}
                    {!filteredClasses.length ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-500">
                        No classes match this filter.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!optionsLoading && audience === 'SPECIFIC_STUDENTS' ? (
                <div className="space-y-3 rounded-xl border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-900">Select students</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Class *</label>
                      <select
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        value={classId}
                        onChange={(e) => {
                          setClassId(e.target.value);
                          setSectionId('');
                          setSelectedStudentIds([]);
                        }}
                      >
                        <option value="">Select class</option>
                        {(composerOptions.classes || []).map((c) => (
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
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        value={sectionId}
                        disabled={!classId}
                        onChange={(e) => {
                          setSectionId(e.target.value);
                          setSelectedStudentIds([]);
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
                  {sectionId ? (
                    <>
                      <div className="relative">
                        <input
                          value={studentQuery}
                          onChange={(e) => setStudentQuery(e.target.value)}
                          placeholder="Search by name or roll number"
                          className="w-full rounded-xl border border-gray-200 py-2 pl-3 pr-10 text-sm"
                        />
                        <Search
                          size={16}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-violet-700">
                          {selectedStudentIds.length} Students Selected
                        </span>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className="font-semibold text-violet-600"
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
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
                        {students.map((s) => {
                          const on = selectedStudentIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                                on ? 'bg-violet-50' : 'hover:bg-gray-50'
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
                              Roll No. {s.rollNo} – {s.name}
                            </label>
                          );
                        })}
                        {!students.length ? (
                          <p className="px-2 py-4 text-center text-xs text-gray-500">
                            No students found.
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {!optionsLoading && audience === 'ALL_STUDENTS' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  This notifies
                  {composerOptions.allStudentsIsSchoolWide
                    ? ' all accessible school classes'
                    : ' all your assigned classes'}
                  . Confirm carefully before publishing.
                </div>
              ) : null}

              {!optionsLoading && audience === 'PUBLIC' ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                  Posts to the school-wide parent notice board / chronicle without a WhatsApp blast.
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowPublish(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={publishing || optionsLoading}
                onClick={publish}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {publishing ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />}
                Publish Now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>{label}</span>
        {hint ? <span className="font-medium normal-case text-gray-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function LibraryView({ items, onUse }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center text-sm text-gray-500">
        No saved chronicles yet. Generate a poster and it can be saved here.
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onUse(item)}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm hover:border-violet-200"
        >
          {item.previewUrl ? (
            <img src={item.previewUrl} alt="" className="aspect-square w-full object-cover" />
          ) : null}
          <div className="p-3">
            <p className="font-semibold text-gray-900">{item.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{item.eventDate || item.createdAt?.slice(0, 10)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
