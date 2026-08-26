import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  LoaderCircle,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
  School,
  Settings2,
  Trash2,
} from 'lucide-react';
import { getClasses } from '../services/classService.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { networkErrorMessage, showToast } from '../services/toast.js';
import {
  buildEmptyGrid,
  buildPeriodSlots,
  cloneGrid,
  emptyCell,
  findLocalTeacherConflicts,
  gridsEqual,
  isBreakSlot,
  normalizeTimetableSettings,
  subjectsForTeacher,
  teacherAllowsSubject,
} from '../data/timetableScheduling.js';
import {
  getSchedulingSubjects,
  getSchedulingTeachers,
  getSchedulingTimetable,
  getTeacherAvailability,
  getTimetableSettings,
  saveSchedulingTimetable,
  saveTimetableSettings,
  validateSchedulingTimetable,
} from '../services/timetableSchedulingService.js';
import { canEditTimetable } from '../data/navItems.js';
import TimetableSchedulingTeachersPanel from './TimetableSchedulingTeachersPanel.jsx';
import TimetableSchedulingSubjectsPanel from './TimetableSchedulingSubjectsPanel.jsx';
import TimetableSchedulingGrid from './TimetableSchedulingGrid.jsx';
import TimetableTeacherSchedulePanel from './TimetableTeacherSchedulePanel.jsx';
import TimetableSchedulingSettingsModal from './TimetableSchedulingSettingsModal.jsx';

function sectionOptionsFromClasses(classes) {
  const out = [];
  for (const klass of classes || []) {
    for (const sec of klass.sections || []) {
      out.push({
        key: `${klass.name}||${sec.name}||${sec.id || ''}`,
        label: `${formatClassLabel(klass.name)}-${sec.name}`,
        className: klass.name,
        sectionName: sec.name,
        sectionId: sec.id,
      });
    }
  }
  return out;
}

/**
 * Drag & drop timetable scheduling — three-column layout.
 * Reuses /api/timetable Grid_Json storage (scheduling mode).
 */
export default function TimetableSchedulingPage({ user }) {
  const canEdit = canEditTimetable(user);

  const [sectionOptions, setSectionOptions] = useState([]);
  const [classKey, setClassKey] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [settings, setSettings] = useState(() => normalizeTimetableSettings());
  const [days, setDays] = useState(() => normalizeTimetableSettings().workingDays);
  const [periods, setPeriods] = useState(() => buildPeriodSlots());
  const [grid, setGrid] = useState(() => buildEmptyGrid(6, buildPeriodSlots()));
  const [savedSnapshot, setSavedSnapshot] = useState(null);

  const [loadingGrid, setLoadingGrid] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [availDayIndex, setAvailDayIndex] = useState(0);
  const [availability, setAvailability] = useState(null);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const [activeSlotType, setActiveSlotType] = useState('subject');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [pendingTeacher, setPendingTeacher] = useState(null);
  const [leftFullscreen, setLeftFullscreen] = useState(false);
  const [pageFullscreen, setPageFullscreen] = useState(false);
  const leftPanelRef = useRef(null);
  const pageRef = useRef(null);

  const selectedSection = sectionOptions.find((o) => o.key === classKey);
  const classSectionId = selectedSection?.sectionId || '';
  const dirty = savedSnapshot != null && !gridsEqual(grid, savedSnapshot);
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId) || null;

  const teacherHasMappings = Boolean(
    selectedTeacher &&
      ((selectedTeacher.subjectNames || []).length || (selectedTeacher.subjects || []).length)
  );

  const visibleSubjects = useMemo(() => {
    let list = subjects || [];
    const isAcademic = (s) => !s.slotTypeHint || s.slotTypeHint === 'subject';

    // Teacher tab: only subjects mapped to the selected teacher (never the full catalog)
    if (activeSlotType === 'teacher') {
      if (!selectedTeacher || !teacherHasMappings) return [];
      return subjectsForTeacher(selectedTeacher, list).filter(isAcademic);
    }

    // Subject / Library / Activity: optionally narrow when a mapped teacher is selected
    if (teacherHasMappings) {
      list = subjectsForTeacher(selectedTeacher, list);
    }
    if (activeSlotType === 'library') {
      return list.filter((s) => s.slotTypeHint === 'library');
    }
    if (activeSlotType === 'activity') {
      return list.filter((s) => s.slotTypeHint === 'activity');
    }
    // Default Subject tab
    return list.filter(isAcademic);
  }, [subjects, selectedTeacher, activeSlotType, teacherHasMappings]);

  const subjectsFilteredByTeacher = Boolean(
    activeSlotType === 'teacher' ? selectedTeacher : teacherHasMappings
  );

  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement;
      setLeftFullscreen(Boolean(leftPanelRef.current && fs === leftPanelRef.current));
      setPageFullscreen(Boolean(pageRef.current && fs === pageRef.current));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async (el) => {
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
    }
  }, []);

  const toggleLeftFullscreen = useCallback(() => {
    toggleFullscreen(leftPanelRef.current);
  }, [toggleFullscreen]);

  const togglePageFullscreen = useCallback(() => {
    toggleFullscreen(pageRef.current);
  }, [toggleFullscreen]);

  const liveAvailability = useMemo(() => {
    if (!availability || !selectedTeacher) return availability;
    const daysOut = (availability.days || []).map((day) => ({
      ...day,
      periods: (day.periods || []).map((p) => {
        // Start from other classes only when dirty (replace this class with local grid)
        let assignments = (p.assignments || []).filter((a) =>
          dirty ? a.classSectionId !== classSectionId : true
        );
        if (dirty) {
          periods.forEach((slot, pi) => {
            if (isBreakSlot(slot) || slot.period !== p.period) return;
            const cell = grid[pi]?.[day.dayIndex];
            if (!cell) return;
            const match =
              cell.teacherId === selectedTeacher.id ||
              (Boolean(cell.teacher) &&
                cell.teacher.toLowerCase() === selectedTeacher.name.toLowerCase());
            if (!match) return;
            assignments.push({
              classSectionId,
              classLabel: selectedSection?.label || classSectionId,
              subject: cell.subject || '',
              teacher: cell.teacher || '',
            });
          });
        }
        return {
          ...p,
          status: assignments.length ? 'O' : 'U',
          assignments,
        };
      }),
    }));
    return { ...availability, days: daysOut };
  }, [availability, selectedTeacher, grid, periods, selectedSection, classSectionId, dirty]);


  const teachingPeriodCount = useMemo(
    () => (periods || []).filter((p) => !isBreakSlot(p)).length,
    [periods]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingClasses(true);
      try {
        const data = await getClasses();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.classes || [];
        const opts = sectionOptionsFromClasses(list);
        setSectionOptions(opts);
        setClassKey((prev) => prev || opts[0]?.key || '');
      } catch (err) {
        if (!cancelled) {
          setSectionOptions([]);
          showToast(networkErrorMessage(err) || 'Could not load classes', 'error');
        }
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [tList, sList, settingsData] = await Promise.all([
          getSchedulingTeachers(),
          getSchedulingSubjects(),
          getTimetableSettings(),
        ]);
        if (cancelled) return;
        setTeachers(tList);
        setSubjects(sList);
        setSettings(settingsData.settings);
        setPeriods(settingsData.periods);
        setDays(settingsData.settings.workingDays);
      } catch (err) {
        if (!cancelled) {
          showToast(networkErrorMessage(err) || 'Could not load scheduling data', 'error');
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGrid = useCallback(
    async (sectionId) => {
      if (!sectionId) return;
      setLoadingGrid(true);
      setLoadError('');
      try {
        const data = await getSchedulingTimetable(sectionId);
        const nextDays = data.days || settings.workingDays;
        const nextPeriods = data.periods?.length ? data.periods : buildPeriodSlots(settings);
        const nextGrid =
          data.grid?.length && !data.isDefault
            ? cloneGrid(data.grid)
            : buildEmptyGrid(nextDays.length, nextPeriods);
        setDays(nextDays);
        setPeriods(nextPeriods);
        if (data.settings) setSettings(normalizeTimetableSettings(data.settings));
        setGrid(nextGrid);
        setSavedSnapshot(cloneGrid(nextGrid));
      } catch (err) {
        setLoadError(networkErrorMessage(err) || 'Could not load timetable');
        showToast(networkErrorMessage(err) || 'Could not load timetable', 'error');
      } finally {
        setLoadingGrid(false);
      }
    },
    [settings]
  );

  useEffect(() => {
    if (!classSectionId) return undefined;
    loadGrid(classSectionId);
    return undefined;
  }, [classSectionId]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: reload on section change only

  const refreshAvailability = useCallback(async (teacherId) => {
    if (!teacherId) {
      setAvailability(null);
      return;
    }
    setLoadingAvail(true);
    try {
      const data = await getTeacherAvailability(teacherId);
      setAvailability(data);
    } catch {
      setAvailability(null);
    } finally {
      setLoadingAvail(false);
    }
  }, []);

  useEffect(() => {
    refreshAvailability(selectedTeacherId);
  }, [selectedTeacherId, refreshAvailability]);

  const confirmIfDirty = () => {
    if (!dirty) return true;
    return window.confirm('You have unsaved changes. Discard them and continue?');
  };

  const handleClassChange = (nextKey) => {
    if (nextKey === classKey) return;
    if (!confirmIfDirty()) return;
    setClassKey(nextKey);
    setPendingTeacher(null);
  };

  const handleSectionChange = (nextKey) => {
    handleClassChange(nextKey);
  };

  const classNames = useMemo(() => {
    const set = new Set();
    const list = [];
    for (const o of sectionOptions) {
      if (!set.has(o.className)) {
        set.add(o.className);
        list.push(o.className);
      }
    }
    return list;
  }, [sectionOptions]);

  const sectionsForClass = useMemo(() => {
    const cn = selectedSection?.className;
    return sectionOptions.filter((o) => o.className === cn);
  }, [sectionOptions, selectedSection]);

  const applyCell = (periodIndex, dayIndex, cell) => {
    setGrid((prev) => {
      const next = cloneGrid(prev);
      if (!next[periodIndex]) return prev;
      next[periodIndex][dayIndex] = cell;
      return next;
    });
  };

  const onDropCell = (periodIndex, dayIndex, payload) => {
    if (!canEdit) return;
    const existing = grid[periodIndex]?.[dayIndex] || emptyCell();

    if (payload.kind === 'teacher') {
      const teacher = teachers.find((t) => t.id === payload.teacherId);
      if (existing.subject || existing.subjectId) {
        if (
          !teacherAllowsSubject(teacher, existing.subject, existing.subjectId) &&
          (teacher?.subjectNames || []).length
        ) {
          showToast(`${payload.teacherName} is not mapped to ${existing.subject}`, 'error');
          return;
        }
        applyCell(periodIndex, dayIndex, {
          ...existing,
          teacher: payload.teacherName,
          teacherId: payload.teacherId,
          slotType: existing.slotType === 'subject' ? 'teacher' : existing.slotType || 'teacher',
          teacherSubjectId:
            teacher?.subjects?.find(
              (s) =>
                s.subjectId === existing.subjectId ||
                String(s.name).toLowerCase() === String(existing.subject).toLowerCase()
            )?.teacherSubjectId || null,
        });
        setSelectedTeacherId(payload.teacherId);
        return;
      }
      setPendingTeacher({ periodIndex, dayIndex, teacher });
      setSelectedTeacherId(payload.teacherId);
      showToast('Select a subject for this teacher (click or drag a subject)', 'info');
      return;
    }

    if (payload.kind === 'subject') {
      const subject = subjects.find((s) => s.id === payload.subjectId) || {
        id: payload.subjectId,
        name: payload.subjectName,
      };
      const slotType = payload.slotType || activeSlotType || 'subject';

      if (pendingTeacher) {
        const { periodIndex: pi, dayIndex: di, teacher } = pendingTeacher;
        if (
          !teacherAllowsSubject(teacher, subject.name, subject.id) &&
          (teacher?.subjectNames || []).length
        ) {
          showToast(`${teacher.name} is not mapped to ${subject.name}`, 'error');
          return;
        }
        applyCell(pi, di, {
          subject: subject.name,
          subjectId: subject.id,
          teacher: teacher.name,
          teacherId: teacher.id,
          teacherSubjectId:
            teacher.subjects?.find(
              (s) =>
                s.subjectId === subject.id ||
                String(s.name).toLowerCase() === String(subject.name).toLowerCase()
            )?.teacherSubjectId || null,
          slotType: slotType === 'subject' ? 'teacher' : slotType,
        });
        setPendingTeacher(null);
        return;
      }

      if (existing.teacherId || existing.teacher) {
        const teacher =
          teachers.find((t) => t.id === existing.teacherId) ||
          teachers.find((t) => t.name === existing.teacher);
        if (
          teacher &&
          !teacherAllowsSubject(teacher, subject.name, subject.id) &&
          (teacher.subjectNames || []).length
        ) {
          showToast(`${teacher.name} is not mapped to ${subject.name}`, 'error');
          return;
        }
        applyCell(periodIndex, dayIndex, {
          ...existing,
          subject: subject.name,
          subjectId: subject.id,
          slotType:
            slotType === 'library' || slotType === 'activity'
              ? slotType
              : existing.teacher
                ? 'teacher'
                : 'subject',
        });
        return;
      }

      // Subject-only / library / activity
      applyCell(periodIndex, dayIndex, {
        ...emptyCell(),
        subject: subject.name,
        subjectId: subject.id,
        slotType,
      });
    }
  };

  const onClearCell = (periodIndex, dayIndex) => {
    if (!canEdit) return;
    applyCell(periodIndex, dayIndex, emptyCell());
  };

  const handleClearAll = () => {
    if (!canEdit) return;
    if (!window.confirm('Clear all periods for this class/section?')) return;
    setGrid(buildEmptyGrid(days.length, periods));
    setPendingTeacher(null);
  };

  const handleAddPeriod = () => {
    if (!canEdit) return;
    const nextCount = teachingPeriodCount + 1;
    const nextSettings = normalizeTimetableSettings({
      ...settings,
      periodCount: nextCount,
    });
    const nextPeriods = buildPeriodSlots(nextSettings);
    const nextGrid = buildEmptyGrid(days.length, nextPeriods);
    // preserve existing teaching cells
    let ti = 0;
    periods.forEach((slot, pi) => {
      if (isBreakSlot(slot)) return;
      const targetPi = nextPeriods.findIndex((s) => !isBreakSlot(s) && s.period === slot.period);
      if (targetPi >= 0 && grid[pi]) {
        nextGrid[targetPi] = cloneGrid([grid[pi]])[0];
      }
      ti += 1;
    });
    // ignore unused
    void ti;
    setSettings(nextSettings);
    setPeriods(nextPeriods);
    setGrid(nextGrid);
    showToast(`Period ${nextCount} added — save settings & timetable when ready`, 'info');
  };

  const handleSaveSettings = async (next) => {
    setSavingSettings(true);
    try {
      const data = await saveTimetableSettings(next);
      setSettings(data.settings);
      setPeriods(data.periods);
      setDays(data.settings.workingDays);
      setGrid((prev) => {
        const resized = buildEmptyGrid(data.settings.workingDays.length, data.periods);
        let srcTi = 0;
        const srcTeaching = [];
        periods.forEach((slot, pi) => {
          if (isBreakSlot(slot)) return;
          srcTeaching.push(prev[pi] || []);
          srcTi += 1;
        });
        void srcTi;
        let di = 0;
        data.periods.forEach((slot, pi) => {
          if (isBreakSlot(slot)) return;
          const src = srcTeaching[di] || [];
          resized[pi] = data.settings.workingDays.map((_, d) =>
            src[d] && typeof src[d] === 'object' ? { ...src[d] } : emptyCell()
          );
          di += 1;
        });
        return resized;
      });
      setSettingsOpen(false);
      showToast('Timetable settings saved', 'success');
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Could not save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;
    if (!classSectionId) {
      showToast('Select a class and section first', 'error');
      return;
    }
    const localConflicts = findLocalTeacherConflicts(grid, periods, days);
    if (localConflicts.length) {
      showToast(localConflicts[0], 'error');
      return;
    }
    setSaving(true);
    try {
      const validation = await validateSchedulingTimetable(classSectionId, grid);
      if (!validation.ok) {
        const msg =
          validation.conflicts?.[0]?.message ||
          validation.mappingErrors?.[0]?.message ||
          'Validation failed';
        showToast(msg, 'error');
        return;
      }
      const data = await saveSchedulingTimetable(classSectionId, grid, {
        className: selectedSection?.className,
        sectionName: selectedSection?.sectionName,
      });
      const nextGrid = cloneGrid(data.grid || grid);
      setGrid(nextGrid);
      setSavedSnapshot(cloneGrid(nextGrid));
      if (data.periods?.length) setPeriods(data.periods);
      if (data.days?.length) setDays(data.days);
        showToast(
        `Timetable for Class ${selectedSection?.label || classSectionId} saved successfully.`,
        'success'
      );
      if (selectedTeacherId) refreshAvailability(selectedTeacherId);
    } catch (err) {
      const msg =
        err?.data?.error ||
        networkErrorMessage(err) ||
        'Could not save timetable';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={pageRef}
      className={`space-y-4 ${pageFullscreen ? 'min-h-screen bg-slate-100 p-4' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <CalendarClock className="text-indigo-600" size={22} />
            Timetable Scheduling
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Drag teachers and subjects onto the weekly grid. Conflicts are checked across all classes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 lg:hidden"
            onClick={() => setLeftOpen((v) => !v)}
          >
            {leftOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            Teachers
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 lg:hidden"
            onClick={() => setRightOpen((v) => !v)}
          >
            {rightOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            Schedule
          </button>
          <button
            type="button"
            onClick={togglePageFullscreen}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-slate-50"
            title={pageFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            aria-label={pageFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {pageFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {pageFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </div>
      </div>

      {!canEdit ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          View only — you can browse timetables but cannot drag or save changes.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_240px]">
        {/* LEFT */}
        <div className={`${leftOpen ? 'block' : 'hidden'} xl:block`}>
          <div
            ref={leftPanelRef}
            className={`flex flex-col gap-3 rounded-2xl border border-gray-200 bg-slate-50/80 p-3 shadow-sm ${
              leftFullscreen ? 'h-screen gap-4 rounded-none border-0 bg-white p-4' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                  <School size={15} />
                </span>
                <h2 className="truncate text-sm font-bold text-slate-900">
                  Teacher & Subject Management
                </h2>
              </div>
              <button
                type="button"
                onClick={toggleLeftFullscreen}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-indigo-600"
                title={leftFullscreen ? 'Exit full screen' : 'Full Screen'}
                aria-label={leftFullscreen ? 'Exit full screen' : 'Full Screen'}
              >
                {leftFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>

            <div className={leftFullscreen ? 'min-h-0 flex-1' : 'h-[280px] xl:h-[38vh]'}>
              <TimetableSchedulingTeachersPanel
                teachers={teachers}
                search={teacherSearch}
                onSearchChange={setTeacherSearch}
                selectedTeacherId={selectedTeacherId}
                onSelectTeacher={setSelectedTeacherId}
                canEdit={canEdit}
                loading={loadingMeta}
              />
            </div>
            <div className={leftFullscreen ? 'min-h-0 flex-1' : 'h-[240px] xl:h-[30vh]'}>
              <TimetableSchedulingSubjectsPanel
                subjects={visibleSubjects}
                canEdit={canEdit}
                loading={loadingMeta}
                activeSlotType={activeSlotType}
                onSlotTypeChange={setActiveSlotType}
                selectedTeacherName={selectedTeacher?.name || ''}
                filteredByTeacher={subjectsFilteredByTeacher}
              />
            </div>
          </div>
        </div>

        {/* CENTER */}
        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[120px] flex-1 text-xs font-medium text-gray-500">
                Class
                <select
                  value={selectedSection?.className || ''}
                  disabled={loadingClasses}
                  onChange={(e) => {
                    const cn = e.target.value;
                    const first = sectionOptions.find((o) => o.className === cn);
                    if (first) handleClassChange(first.key);
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {classNames.map((cn) => (
                    <option key={cn} value={cn}>
                      {formatClassLabel(cn)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[100px] flex-1 text-xs font-medium text-gray-500">
                Section
                <select
                  value={classKey}
                  disabled={loadingClasses}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {sectionsForClass.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.sectionName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-full bg-indigo-100 px-3.5 py-2 text-sm font-bold text-indigo-800">
                {teachingPeriodCount} periods
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canEdit}
                onClick={handleAddPeriod}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus size={16} /> Add Period
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={16} /> Clear All
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                <Settings2 size={16} /> View Settings
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canEdit || saving || !classSectionId || loadingGrid}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
              >
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving…' : 'Save Timetable'}
              </button>
              {dirty ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600">
                  <AlertTriangle size={15} className="shrink-0" />
                  Unsaved changes
                </span>
              ) : null}
            </div>

            {pendingTeacher ? (
              <p className="mt-2 text-xs font-medium text-indigo-700">
                Waiting for subject for {pendingTeacher.teacher?.name}…
                {subjectsForTeacher(pendingTeacher.teacher, subjects).length
                  ? ` Suggested: ${subjectsForTeacher(pendingTeacher.teacher, subjects)
                      .slice(0, 4)
                      .map((s) => s.name)
                      .join(', ')}`
                  : ''}
              </p>
            ) : null}
          </div>

          {loadingGrid ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-20 text-sm text-gray-500 shadow-sm">
              <LoaderCircle className="animate-spin text-indigo-600" size={18} /> Loading timetable…
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm text-rose-800">
              {loadError}
            </div>
          ) : !classSectionId ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm">
              Select a class and section to edit its timetable.
            </div>
          ) : (
            <TimetableSchedulingGrid
              days={days}
              periods={periods}
              grid={grid}
              canEdit={canEdit}
              onDropCell={onDropCell}
              onClearCell={onClearCell}
              highlightTeacherId={selectedTeacherId}
            />
          )}
        </div>

        {/* RIGHT */}
        <div className={`h-[420px] xl:h-auto ${rightOpen ? 'block' : 'hidden'} xl:block`}>
          <TimetableTeacherSchedulePanel
            teacher={selectedTeacher}
            availability={liveAvailability}
            dayIndex={availDayIndex}
            onDayChange={setAvailDayIndex}
            loading={loadingAvail}
          />
        </div>
      </div>

      <TimetableSchedulingSettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        saving={savingSettings}
      />
    </div>
  );
}
