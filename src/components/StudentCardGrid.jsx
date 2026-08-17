import { useCallback, useEffect, useRef, useState } from 'react';
import { Info, Maximize2, Minimize2, Users, ClipboardList } from 'lucide-react';
import { ATTENDANCE_STATUS, PERIOD_COUNT } from '../data/mockData';
import AttendanceMarkControls from './AttendanceMarkControls';
import AttendanceFooterBar from './AttendanceFooterBar';
import AttendanceEditStatusBanner from './AttendanceEditStatusBanner';
import { SCHOOL_GRADES, SCHOOL_SECTIONS, formatClassLabel } from '../data/schoolGrades.js';

export default function StudentCardGrid({
  students = [],
  classOptions = SCHOOL_GRADES,
  sectionOptions = SCHOOL_SECTIONS,
  grid,
  onStatusChange,
  showConfirmed,
  onUnlock,
  selectedClass,
  selectedSection,
  selectedDate,
  onClassChange,
  onSectionChange,
  onDateChange,
  onLoadStudents,
  studentsLoadedCount,
  isDirty,
  onCheckAndSave,
  loading,
  saving = false,
  editContext = null,
  onRequestEdit,
  onApprovedEditNow,
}) {
  const todayIdx = PERIOD_COUNT - 1;
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

  return (
    <div
      ref={panelRef}
      className={`attendance-card-panel flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:rounded-xl ${
        isFullscreen ? 'attendance-card-panel--fullscreen h-screen rounded-none border-0' : ''
      }`}
    >
      <div className="relative flex shrink-0 flex-col gap-3 border-b border-gray-100 bg-gray-50/80 px-3 py-3 sm:px-4 sm:py-2.5 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-2 lg:px-3 lg:py-1.5 lg:pr-14">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] text-gray-500 sm:text-xs">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => onClassChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-2.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-auto sm:rounded-lg sm:px-3"
            >
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {formatClassLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] text-gray-500 sm:text-xs">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => onSectionChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-2.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-auto sm:rounded-lg sm:px-3"
            >
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1 sm:min-w-[11.5rem]">
            <label className="mb-1 block text-[10px] text-gray-500 sm:text-xs">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="date-input w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={onLoadStudents}
            disabled={loading}
            className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#f5c542] px-5 py-3 text-sm font-bold text-gray-900 shadow-sm hover:bg-amber-400 disabled:opacity-60 sm:col-span-1 sm:w-auto sm:rounded-lg sm:bg-indigo-600 sm:py-2.5 sm:font-medium sm:text-white sm:hover:bg-indigo-700"
          >
            <Users size={16} className="sm:hidden" />
            {loading ? 'Loading…' : 'Load Students'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => (
            <span key={key} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded px-0.5 text-[9px] font-bold text-white ${val.color}`}
              >
                {key}
              </span>
              {val.label}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 hidden rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm hover:border-indigo-200 hover:text-indigo-600 lg:inline-flex"
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      <div className="flex shrink-0 items-start gap-2 border-b border-sky-100 bg-sky-50 px-3 py-2.5 sm:items-center sm:px-4 sm:py-2 lg:px-3 lg:py-1">
        <Info size={14} className="mt-0.5 shrink-0 text-sky-600 sm:mt-0" />
        <p className="text-xs leading-snug text-sky-800 lg:text-[11px] lg:leading-tight">
          Tap the status for <strong>Present / Absent</strong>. Use the arrow for <strong>Late</strong>,{' '}
          <strong>Half Day</strong>, <strong>OD - Half Day</strong>, or <strong>OD - Full Day</strong>.
        </p>
      </div>

      {editContext ? (
        <div className="shrink-0 border-b border-indigo-50 px-4 py-2 lg:px-3">
          <AttendanceEditStatusBanner
            locked={editContext.locked}
            canEdit={editContext.canEdit}
            request={editContext.request}
            finalized={Boolean(editContext.finalized)}
            onRequestEdit={onRequestEdit}
            onEditNow={onApprovedEditNow}
          />
        </div>
      ) : null}

      <div
        className={`attendance-student-scroll min-h-0 flex-1 overflow-y-scroll ${
          isFullscreen ? 'bg-white' : ''
        }`}
      >
        {students.length > 0 ? (
          <div className="attendance-student-grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4">
            {students.map((student, rowIdx) => {
              const status = grid[rowIdx]?.[todayIdx] || '';
              return (
                <div
                  key={student.id}
                  className="attendance-student-card flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md sm:p-3 lg:rounded-lg"
                >
                  <div className="attendance-student-roll mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 lg:mb-0.5 lg:block lg:h-auto lg:w-auto lg:rounded-none lg:bg-transparent lg:text-xs lg:font-medium lg:text-gray-400">
                    {student.roll}
                  </div>
                  <p className="attendance-student-name mb-2 truncate text-center text-xs font-semibold text-gray-900 sm:text-sm lg:mb-0 lg:text-left">
                    {student.name}
                  </p>
                  <div className="mt-auto">
                    <AttendanceMarkControls
                      status={status}
                      disabled={
                        showConfirmed || Boolean(editContext?.locked && !editContext?.canEdit)
                      }
                      compact
                      studentName={student.name}
                      studentRoll={student.roll}
                      onChange={(newStatus) => onStatusChange(rowIdx, newStatus)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="relative mb-4 flex h-24 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-indigo-50" />
              <ClipboardList size={48} className="relative text-indigo-400" strokeWidth={1.5} />
              <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white shadow">
                ✓
              </span>
            </div>
            <p className="max-w-[220px] text-sm font-medium text-gray-600">
              Select class, section, and date, then click Load Students.
            </p>
          </div>
        )}
      </div>

      <AttendanceFooterBar
        studentsLoadedCount={studentsLoadedCount ?? students.length}
        isDirty={isDirty}
        showConfirmed={showConfirmed}
        saving={saving}
        onCheckAndSave={onCheckAndSave}
        onUnlock={onUnlock}
        editLocked={Boolean(editContext?.locked && !editContext?.canEdit)}
        editApproved={Boolean(editContext?.canEdit && editContext?.request?.status === 'APPROVED')}
        onRequestEdit={onRequestEdit}
      />

      {isFullscreen ? (
        <div
          data-attendance-menu-portal=""
          className="pointer-events-none absolute inset-0 z-[10050] overflow-visible"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
