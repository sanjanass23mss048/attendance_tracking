import { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './components/DashboardPage';
import StatsCards from './components/StatsCards';
import ViewModeTabs from './components/ViewModeTabs';
import StudentCardGrid from './components/StudentCardGrid';
import RollQuickEntry from './components/RollQuickEntry';
import AttendanceListView from './components/AttendanceListView';
import AttendanceActions from './components/AttendanceActions';
import SummaryView from './components/SummaryView';
import MessagePreviewPanel from './components/MessagePreviewPanel';
import AcademicCalendarPage from './components/AcademicCalendarPage';
import DayWiseAttendancePage from './components/DayWiseAttendancePage';
import StudentsPage from './components/StudentsPage';
import LeaveLettersPage from './components/LeaveLettersPage';
import ClassesPage from './components/ClassesPage';
import SettingsPage from './components/SettingsPage';
import SupportCenterPage from './components/SupportCenterPage';
import ReportsPage from './components/ReportsPage';
import LoginPage from './components/LoginPage';
import WeeklyTimetablePage from './components/WeeklyTimetablePage';
import TeachersPage from './components/TeachersPage';
import EditApprovalsPage from './components/EditApprovalsPage';
import AttendanceEditRequestModal from './components/AttendanceEditRequestModal';
import PlaceholderPage from './components/PlaceholderPage';
import RightPanel from './components/RightPanel';
import AppToast from './components/AppToast';
import MobileBottomNav from './components/MobileBottomNav';
import {
  cloneGrid,
  countTodaySummary,
  countMarkedToday,
  gridsEqual,
  getAttendancePercent,
  getSummaryBreakdown,
  getStudentsByStatus,
  setTodayStatus,
  markAbsentByRolls,
  getNotificationStudent,
  getMessagesToSend,
  getParentNotifications,
  getStatusDisplay,
  normalizeStatus,
  validateAttendanceGrid,
  TODAY_IDX,
  formatAttendanceDate,
  getTodayAttendanceDate,
} from './utils/attendance';
import { isHolidayDate } from './services/calendarService';
import { getToken, useMock } from './services/api.js';
import { getMe, logout as authLogout } from './services/authService.js';
import { getClasses, resolveSectionId } from './services/classService.js';
import { SCHOOL_GRADES, SCHOOL_SECTIONS, formatClassLabel } from './data/schoolGrades.js';
import { getStudents } from './services/studentService.js';
import {
  getAttendanceSummary,
  getDailyAttendance,
  gridFromDailyMarks,
  marksFromDailyGrid,
  saveDailyAttendance,
  submitParentMessages,
} from './services/attendanceService.js';
import {
  connectSocket,
  disconnectSocket,
  onAttendanceUpdated,
  onConnectionStatus,
} from './services/socketService.js';
import { networkErrorMessage, showToast } from './services/toast.js';
import {
  createEditRequest,
  getEditContext,
} from './services/attendanceEditRequestService.js';

function emptyGrid(n = 0) {
  return Array.from({ length: n }, () => Array(10).fill(''));
}

const EMPTY_DASH_STATS = {
  totalClasses: 0,
  presentToday: 0,
  absentToday: 0,
  lateToday: 0,
  halfDayToday: 0,
  odHalfDayToday: 0,
  odFullDayToday: 0,
  attendancePercent: 0,
  markedToday: 0,
  totalStudents: 0,
};

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);

  const [activePage, setActivePage] = useState('attendance');
  const [activeView, setActiveView] = useState('grid');
  const [classOptions, setClassOptions] = useState(SCHOOL_GRADES);
  const [sectionOptions, setSectionOptions] = useState(SCHOOL_SECTIONS);
  const [classesData, setClassesData] = useState([]);
  const [selectedClass, setSelectedClass] = useState('1');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedDate, setSelectedDate] = useState(() => getTodayAttendanceDate());
  const [sectionId, setSectionId] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [grid, setGrid] = useState(() => emptyGrid());
  const [savedGrid, setSavedGrid] = useState(() => emptyGrid());
  const [searchQuery, setSearchQuery] = useState('');
  const [rollInput, setRollInput] = useState('3, 8');
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [messagesSent, setMessagesSent] = useState(false);
  const [lastSentMessageCount, setLastSentMessageCount] = useState(0);
  const [lastSentStatusByStudent, setLastSentStatusByStudent] = useState(null);
  const [dateIsHoliday, setDateIsHoliday] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem('bfps_sidebar_pinned') === '1';
    } catch {
      return false;
    }
  });
  const hoverCloseTimer = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('bfps_sidebar_pinned', isPinned ? '1' : '0');
    } catch {
      // ignore
    }
  }, [isPinned]);

  const clearHoverClose = () => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };

  const openSidebarHover = () => {
    clearHoverClose();
    setIsHovered(true);
  };

  const scheduleSidebarHoverClose = () => {
    clearHoverClose();
    // Short delay so the pointer can move from the menu button onto the sidebar
    hoverCloseTimer.current = setTimeout(() => setIsHovered(false), 180);
  };

  useEffect(() => () => clearHoverClose(), []);
  const [dashStats, setDashStats] = useState(EMPTY_DASH_STATS);
  const [dashStatsError, setDashStatsError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editContext, setEditContext] = useState(null);
  const [showEditRequestModal, setShowEditRequestModal] = useState(false);
  const [editRequestSubmitting, setEditRequestSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(
    useMock() ? 'offline' : 'reconnecting'
  );
  const classSelectorRef = useRef(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const loadClassRef = useRef(null);

  const refreshEditContext = useCallback(async (sid, date) => {
    if (!sid || !date || useMock()) {
      setEditContext(null);
      return;
    }
    try {
      const ctx = await getEditContext({ sectionId: sid, date });
      setEditContext(ctx);
    } catch {
      setEditContext(null);
    }
  }, []);

  useEffect(() => {
    if (sectionId && selectedDate) {
      refreshEditContext(sectionId, selectedDate);
    } else {
      setEditContext(null);
    }
  }, [sectionId, selectedDate, refreshEditContext]);

  // Poll while waiting for WhatsApp approver response
  useEffect(() => {
    if (!sectionId || !selectedDate || editContext?.request?.status !== 'PENDING') return undefined;
    const timer = setInterval(() => refreshEditContext(sectionId, selectedDate), 10000);
    return () => clearInterval(timer);
  }, [sectionId, selectedDate, editContext?.request?.status, refreshEditContext]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          setAuthReady(true);
        }
        return;
      }
      try {
        const data = await getMe();
        if (!cancelled) setUser(data.user);
      } catch {
        authLogout();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    getClasses()
      .then((data) => {
        const list = data.classes || [];
        setClassesData(list);
        setClassOptions(list.map((c) => c.name));
        if (list[0]) {
          setSelectedClass(list[0].name);
          const secs = list[0].sections || [];
          setSectionOptions(secs.map((s) => s.name));
          setSelectedSection(secs[0]?.name || 'A');
        } else {
          setSelectedClass('');
          setSectionOptions([]);
          setSelectedSection('');
        }
      })
      .catch((err) => {
        showToast(networkErrorMessage(err) || 'Failed to load classes', 'error');
      });
  }, [user]);

  useEffect(() => {
    if (!user || useMock()) {
      disconnectSocket();
      setConnectionStatus('offline');
      return undefined;
    }
    connectSocket();
    const offStatus = onConnectionStatus(setConnectionStatus);
    return () => {
      offStatus();
      disconnectSocket();
    };
  }, [user]);

  useEffect(() => {
    const klass = classesData.find((c) => String(c.name) === String(selectedClass));
    const secs = (klass?.sections || []).map((s) => s.name);
    if (secs.length) {
      setSectionOptions(secs);
      if (!secs.includes(selectedSection)) {
        setSelectedSection(secs[0]);
      }
    }
  }, [selectedClass, classesData]);

  useEffect(() => {
    let cancelled = false;
    isHolidayDate(selectedDate)
      .then((isHoliday) => {
        if (!cancelled) setDateIsHoliday(isHoliday);
      })
      .catch(() => {
        if (!cancelled) setDateIsHoliday(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const refreshDashboardStats = useCallback(async () => {
    try {
      const summary = await getAttendanceSummary({ date: selectedDate });
      setDashStats({
        totalClasses: summary.totalClasses ?? summary.totalSections ?? 0,
        presentToday: summary.present ?? 0,
        absentToday: summary.absent ?? 0,
        lateToday: summary.late ?? 0,
        halfDayToday: summary.halfDay ?? 0,
        odHalfDayToday: summary.odHalfDay ?? 0,
        odFullDayToday: summary.odFullDay ?? 0,
        attendancePercent: summary.attendancePercent ?? 0,
        markedToday: summary.marked ?? 0,
        totalStudents: summary.totalStudents ?? 0,
      });
      setDashStatsError(null);
    } catch (err) {
      setDashStats(EMPTY_DASH_STATS);
      const msg = networkErrorMessage(err) || 'Failed to load attendance summary';
      setDashStatsError(msg);
      showToast(msg, 'error');
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!user) return;
    if (activePage === 'dashboard' || activePage === 'attendance') {
      refreshDashboardStats();
    }
  }, [user, activePage, refreshDashboardStats]);

  const classLabel = `Class ${selectedClass} - ${selectedSection}`;
  const attendanceDateLabel = formatAttendanceDate(selectedDate);
  const classSummary = countTodaySummary(grid);
  const classPercent = getAttendancePercent(classSummary);
  const summaryBreakdown = getSummaryBreakdown(classSummary);
  const absentStudents = getStudentsByStatus(students, grid, 'A');
  const markedCount = countMarkedToday(grid);
  const isDirty = !gridsEqual(grid, savedGrid);
  const messagesToSend = getMessagesToSend(
    students,
    grid,
    classLabel,
    lastSentStatusByStudent,
    attendanceDateLabel
  );
  const preview = getNotificationStudent(students, grid);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (!user || useMock()) return undefined;
    return onAttendanceUpdated((payload) => {
      if (!payload?.sectionId || !payload?.date) return;
      if (payload.date === selectedDate) {
        refreshDashboardStats();
      }
      if (payload.type !== 'daily') return;
      if (payload.sectionId !== sectionId || payload.date !== selectedDate) return;
      if (savingRef.current) return;
      if (dirtyRef.current) {
        showToast('Attendance updated elsewhere — save or reload to sync', 'info');
        return;
      }
      if (studentsLoaded && loadClassRef.current) {
        loadClassRef.current(selectedClass, selectedSection, selectedDate, {
          silent: true,
        });
      }
    });
  }, [
    user,
    sectionId,
    selectedDate,
    selectedClass,
    selectedSection,
    studentsLoaded,
    refreshDashboardStats,
  ]);

  const handleLogout = () => {
    disconnectSocket();
    authLogout();
    setUser(null);
    setStudents([]);
    setStudentsLoaded(false);
    setGrid(emptyGrid());
    setSavedGrid(emptyGrid());
    setShowConfirmed(false);
    setMessagesSent(false);
    setLastSentMessageCount(0);
    setLastSentStatusByStudent(null);
    setActivePage('attendance');
    setConnectionStatus('offline');
  };

  const handleNavigate = (pageId) => {
    setActivePage(pageId);
    if (pageId === 'attendance' || pageId === 'dashboard') {
      setActiveView('grid');
    }
  };

  const loadClass = async (classNum, section, date = selectedDate, { silent = false } = {}) => {
    if (!silent) setLoadingStudents(true);
    try {
      const sid = await resolveSectionId(classNum, section);
      if (!sid) throw new Error('Section not found');

      const [roster, daily] = await Promise.all([
        getStudents({ sectionId: sid }),
        getDailyAttendance({ sectionId: sid, date }),
      ]);

      const list = roster.students || [];
      const markById = Object.fromEntries(
        (daily.marks || []).map((m) => [String(m.studentId), m.status])
      );
      const orderedMarks = list.map((s) => ({
        studentId: s.id,
        status: markById[String(s.id)] || null,
      }));
      const nextGrid = gridFromDailyMarks(orderedMarks, list.length);
      const sentMap = {};
      for (const m of daily.sentMessages || []) {
        sentMap[String(m.studentId)] = m.status;
      }

      setSectionId(sid);
      setStudents(list);
      setGrid(nextGrid);
      setSavedGrid(cloneGrid(nextGrid));
      setStudentsLoaded(true);
      setShowConfirmed(false);
      setMessagesSent(false);
      setLastSentMessageCount(0);
      // Hydrate from DB so Edit / reload only messages people not yet notified.
      setLastSentStatusByStudent(Object.keys(sentMap).length ? sentMap : null);
      setSearchQuery('');
      setSelectedClass(classNum);
      setSelectedSection(section);
      if (silent) {
        showToast('Attendance refreshed (live update)', 'info');
      }
    } catch (err) {
      const msg = networkErrorMessage(err) || 'Failed to load students / attendance';
      if (silent) showToast(msg, 'error');
      else showToast(msg, 'error');
      if (!silent) {
        setStudentsLoaded(false);
        setStudents([]);
        setGrid(emptyGrid());
        setSavedGrid(emptyGrid());
      }
    } finally {
      if (!silent) setLoadingStudents(false);
    }
  };

  loadClassRef.current = loadClass;

  const handleLoadStudents = () => loadClass(selectedClass, selectedSection, selectedDate);

  const handleClassChange = (classNum) => {
    setSelectedClass(classNum);
    setStudentsLoaded(false);
    setStudents([]);
    setSectionId(null);
    setGrid(emptyGrid());
    setSavedGrid(emptyGrid());
    setShowConfirmed(false);
    setMessagesSent(false);
    setLastSentMessageCount(0);
    setLastSentStatusByStudent(null);
  };

  const handleSectionChange = (section) => {
    setSelectedSection(section);
    setStudentsLoaded(false);
    setStudents([]);
    setSectionId(null);
    setGrid(emptyGrid());
    setSavedGrid(emptyGrid());
    setShowConfirmed(false);
    setMessagesSent(false);
    setLastSentMessageCount(0);
    setLastSentStatusByStudent(null);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setStudentsLoaded(false);
    setStudents([]);
    setSectionId(null);
    setGrid(emptyGrid());
    setSavedGrid(emptyGrid());
    setShowConfirmed(false);
    setMessagesSent(false);
    setLastSentMessageCount(0);
    setLastSentStatusByStudent(null);
  };

  const persistDaily = async ({ confirmAfter = false, draftLabel = false } = {}) => {
    if (!studentsLoaded) {
      showToast('Click Load Students for this class/section before submitting.', 'error');
      return false;
    }
    // Always resolve from current filters so we never save into a previous section.
    let sid = sectionId;
    try {
      sid = (await resolveSectionId(selectedClass, selectedSection)) || sectionId;
    } catch {
      // keep sectionId
    }
    if (!sid) {
      showToast('Load students first.', 'error');
      return false;
    }
    if (saving) return false;
    const marks = marksFromDailyGrid(students, grid);
    if (students.length === 0) {
      showToast('No students loaded for this section.', 'error');
      return false;
    }
    setSaving(true);
    try {
      await saveDailyAttendance({
        sectionId: sid,
        date: selectedDate,
        marks,
      });
      setSectionId(sid);
      setSavedGrid(cloneGrid(grid));
      if (confirmAfter) {
        setShowConfirmed(true);
        setMessagesSent(false);
        setLastSentMessageCount(0);
        // Keep lastSentStatusByStudent so Edit → re-submit only messages newly changed statuses.
        setActiveView('summary');
        showToast(
          `Attendance saved for ${classLabel} on ${attendanceDateLabel}. Check tblAttendance / tblStudentAtt_list for ${selectedDate}.`,
          'success'
        );
      } else {
        setShowConfirmed(false);
        setMessagesSent(false);
        if (draftLabel) {
          showToast(`Draft saved for ${classLabel} on ${attendanceDateLabel}.`, 'success');
        }
      }
      refreshDashboardStats();
      await refreshEditContext(sid, selectedDate);
      return true;
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Failed to save attendance', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (rowIdx, status) => {
    setGrid((prev) => setTodayStatus(prev, rowIdx, status));
  };

  const handleMarkAbsent = () => {
    setGrid((prev) => markAbsentByRolls(prev, students, rollInput));
  };

  const handleReset = () => {
    setGrid(cloneGrid(savedGrid));
    setShowConfirmed(false);
    setMessagesSent(false);
    setLastSentMessageCount(0);
    // Keep lastSentStatusByStudent — already-notified parents stay skipped.
  };

  const handleConfirm = async () => {
    if (dateIsHoliday) {
      alert(
        `${attendanceDateLabel} is a holiday (Sunday / government / sudden) on the Academic Calendar. Attendance cannot be confirmed for this date.`
      );
      return;
    }
    const validation = validateAttendanceGrid(students, grid);
    if (!validation.ok) {
      alert(validation.message);
      return;
    }
    await persistDaily({ confirmAfter: true });
  };

  const handleSaveDraft = async () => {
    await persistDaily({ draftLabel: true });
  };

  const handleCheckOnly = () => {
    if (dateIsHoliday) {
      alert(
        `${attendanceDateLabel} is a holiday (Sunday / government / sudden) on the Academic Calendar. Attendance cannot be confirmed for this date.`
      );
      return;
    }
    const validation = validateAttendanceGrid(students, grid);
    if (!validation.ok) {
      alert(validation.message);
      return;
    }
    alert(
      `Check passed for ${classLabel}: ${markedCount} of ${students.length} students marked. No issues found.`
    );
  };

  const handleCheckAndSave = async () => {
    if (dateIsHoliday) {
      alert(
        `${attendanceDateLabel} is a holiday (Sunday / government / sudden) on the Academic Calendar. Attendance cannot be confirmed for this date.`
      );
      return;
    }
    const validation = validateAttendanceGrid(students, grid);
    if (!validation.ok) {
      alert(validation.message);
      return;
    }
    await persistDaily({ confirmAfter: true });
  };

  const handleSendMessageToAbsent = () => {
    if (absentStudents.length === 0) {
      alert('No absent students in this class.');
      return;
    }
    if (!showConfirmed) {
      alert('Please submit attendance before messaging absent students.');
      return;
    }
    // Do not forceResend — skip parents already notified for the same status.
    handleSendMessages();
  };

  const handleExportReport = () => {
    const header = 'Roll,Name,Status';
    const rows = students.map((student, rowIdx) => {
      const status = grid[rowIdx]?.[TODAY_IDX];
      const label = getStatusDisplay(status).label;
      const safeName = `"${String(student.name).replace(/"/g, '""')}"`;
      return `${student.roll},${safeName},${label}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${selectedClass}${selectedSection}-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBackToClasses = () => {
    setShowConfirmed(false);
    setMessagesSent(false);
    setLastSentMessageCount(0);
    // Keep lastSentStatusByStudent for this class/date session.
    setActiveView('grid');
    classSelectorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendToParents = (count, statusSnapshot) => {
    setMessagesSent(true);
    setLastSentMessageCount(count);
    setLastSentStatusByStudent(statusSnapshot);
  };

  const handleSendMessages = async ({ forceResend = false } = {}) => {
    if (!showConfirmed) return;
    if (messagesSent && !forceResend) {
      alert('Messages were already sent to parents.');
      return;
    }

    const pending = getMessagesToSend(
      students,
      grid,
      classLabel,
      forceResend ? null : lastSentStatusByStudent,
      attendanceDateLabel
    );

    if (pending.length === 0) {
      const stillNeedNotify = getParentNotifications(
        students,
        grid,
        classLabel,
        attendanceDateLabel
      ).length;
      if (stillNeedNotify > 0 && lastSentStatusByStudent && !forceResend) {
        alert('No new messages to send — parents were already notified for these statuses.');
      } else {
        alert('No parent messages to send (Present students are not notified).');
      }
      return;
    }

    const initiatedAt = new Date().toISOString();
    let sid = sectionId;
    try {
      sid = (await resolveSectionId(selectedClass, selectedSection)) || sectionId;
    } catch {
      // keep
    }
    if (!sid) {
      showToast('Load students first.', 'error');
      return;
    }

    try {
      const result = await submitParentMessages({
        sectionId: sid,
        date: selectedDate,
        initiatedAt,
        messages: pending.map((n) => ({
          studentId: String(n.student.id),
          status: n.status,
          message: n.message,
        })),
      });

      const snapshot = { ...(forceResend ? {} : lastSentStatusByStudent || {}) };
      for (const m of result.sentMessages || pending) {
        snapshot[String(m.studentId || m.student?.id)] = m.status;
      }
      // Ensure pending statuses are present even if API omits them.
      for (const n of pending) {
        snapshot[String(n.student.id)] = n.status;
      }

      handleSendToParents(pending.length, snapshot);
      alert(`Messages sent to ${pending.length} parent${pending.length === 1 ? '' : 's'}`);
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Failed to record parent messages', 'error');
    }
  };

  const handleUnlock = () => {
    if (editContext?.locked && !editContext?.canEdit) {
      setShowEditRequestModal(true);
      return;
    }
    setShowConfirmed(false);
    setMessagesSent(false);
    setLastSentMessageCount(0);
    // Keep lastSentStatusByStudent so previously messaged students are not notified again.
    setActiveView('grid');
  };

  const handleRequestEditSubmit = async (reason) => {
    let sid = sectionId;
    try {
      sid = (await resolveSectionId(selectedClass, selectedSection)) || sectionId;
    } catch {
      // keep
    }
    if (!sid) {
      showToast('Load students first.', 'error');
      return;
    }
    setEditRequestSubmitting(true);
    try {
      await createEditRequest({
        sectionId: sid,
        attendanceDate: selectedDate,
        reason,
      });
      setShowEditRequestModal(false);
      showToast('Edit request sent to the assigned approver.', 'success');
      await refreshEditContext(sid, selectedDate);
    } catch (err) {
      showToast(networkErrorMessage(err) || 'Failed to send edit request', 'error');
    } finally {
      setEditRequestSubmitting(false);
    }
  };

  const renderAttendanceContent = () => {
    if (!studentsLoaded && activeView !== 'summary' && activeView !== 'messages') {
      if (activeView === 'grid') {
        return (
          <StudentCardGrid
            students={[]}
            classOptions={classOptions}
            sectionOptions={sectionOptions}
            grid={grid}
            onStatusChange={handleStatusChange}
            showConfirmed={showConfirmed}
            onUnlock={handleUnlock}
            selectedClass={selectedClass}
            selectedSection={selectedSection}
            selectedDate={selectedDate}
            onClassChange={handleClassChange}
            onSectionChange={handleSectionChange}
            onDateChange={handleDateChange}
            onLoadStudents={handleLoadStudents}
            studentsLoadedCount={0}
            isDirty={false}
            onCheckAndSave={handleCheckAndSave}
            loading={loadingStudents}
            saving={saving}
            editContext={editContext}
            onRequestEdit={() => setShowEditRequestModal(true)}
            onApprovedEditNow={handleUnlock}
          />
        );
      }
      return null;
    }

    switch (activeView) {
      case 'grid':
        return (
          <StudentCardGrid
            students={students}
            classOptions={classOptions}
            sectionOptions={sectionOptions}
            grid={grid}
            onStatusChange={handleStatusChange}
            showConfirmed={showConfirmed}
            onUnlock={handleUnlock}
            selectedClass={selectedClass}
            selectedSection={selectedSection}
            selectedDate={selectedDate}
            onClassChange={handleClassChange}
            onSectionChange={handleSectionChange}
            onDateChange={handleDateChange}
            onLoadStudents={handleLoadStudents}
            studentsLoadedCount={students.length}
            isDirty={isDirty}
            onCheckAndSave={handleCheckAndSave}
            loading={loadingStudents}
            saving={saving}
            editContext={editContext}
            onRequestEdit={() => setShowEditRequestModal(true)}
            onApprovedEditNow={handleUnlock}
          />
        );
      case 'roll':
        return (
          <div className="space-y-4">
            <RollQuickEntry
              rollInput={rollInput}
              onRollInputChange={setRollInput}
              onMarkAbsent={handleMarkAbsent}
              showConfirmed={showConfirmed}
              absentCount={classSummary.absent}
            />
            <AttendanceActions
              showConfirmed={showConfirmed}
              onReset={handleReset}
              onConfirm={handleConfirm}
              hint="Use roll numbers above, then confirm attendance"
            />
          </div>
        );
      case 'list':
        return (
          <div className="space-y-4">
            <AttendanceListView
              students={students}
              grid={grid}
              onStatusChange={handleStatusChange}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              showConfirmed={showConfirmed}
              classLabel={classLabel}
            />
            <AttendanceActions
              showConfirmed={showConfirmed}
              onReset={handleReset}
              onConfirm={handleConfirm}
              hint="Tap P, A, L, H, OH, or OF for each student"
            />
          </div>
        );
      case 'summary':
        return (
          <SummaryView
            summaryBreakdown={summaryBreakdown}
            classPercent={classPercent}
            absentStudents={absentStudents}
            classLabel={classLabel}
            attendanceDate={attendanceDateLabel}
            showConfirmed={showConfirmed}
            messagesSent={messagesSent}
            sentMessageCount={lastSentMessageCount}
          />
        );
      case 'messages':
        return (
          <MessagePreviewPanel
            students={students}
            grid={grid}
            classLabel={classLabel}
            attendanceDate={attendanceDateLabel}
            messagesSent={messagesSent}
            onSendToParents={() => handleSendMessages()}
          />
        );
      default:
        return null;
    }
  };

  const showClassSelector = ['roll', 'list'].includes(activeView);
  const isAttendancePage = activePage === 'attendance';

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage onSuccess={(data) => setUser(data.user)} />
        <AppToast />
      </>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      <Sidebar
        activePage={isAttendancePage ? 'attendance' : activePage}
        onNavigate={handleNavigate}
        isPinned={isPinned}
        onPinnedChange={setIsPinned}
        isHovered={isHovered}
        onHoveredChange={(open) => {
          if (open) openSidebarHover();
          else scheduleSidebarHoverClose();
        }}
        isMobileOpen={isMobileOpen}
        onMobileOpenChange={setIsMobileOpen}
      />

      <div
        className={`min-w-0 transition-[margin] duration-300 ease-out ${
          isPinned ? 'lg:ml-60' : 'ml-0'
        }`}
      >
        <Header
          activePage={isAttendancePage ? 'attendance' : activePage}
          onMenuClick={() => setIsMobileOpen((v) => !v)}
          onMenuHoverEnter={openSidebarHover}
          onMenuHoverLeave={scheduleSidebarHoverClose}
          user={user}
          onLogout={handleLogout}
          dateLabel={attendanceDateLabel}
          connectionStatus={useMock() ? null : connectionStatus}
        />

        <main className="space-y-4 p-3 pb-24 sm:space-y-5 sm:p-6 lg:pb-6">
          {activePage === 'dashboard' ? (
            <DashboardPage
              stats={dashStats}
              error={dashStatsError}
              dateLabel={attendanceDateLabel}
              onNavigate={handleNavigate}
              user={user}
              classesData={classesData}
            />
          ) : isAttendancePage ? (
            <>
              <StatsCards stats={dashStats} />
              <ViewModeTabs activeView={activeView} onChange={setActiveView} />

              {dateIsHoliday && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                  <strong>{attendanceDateLabel}</strong> is marked as a holiday (Sunday / government /
                  sudden). Attendance confirm is blocked for this date. Pick another working day.
                </div>
              )}

              <div
                className={`grid grid-cols-1 gap-5 ${
                  activeView === 'grid' ? '' : 'xl:grid-cols-[1fr_300px]'
                }`}
              >
                <div className="space-y-5">
                  {showClassSelector && (
                    <div
                      ref={classSelectorRef}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      <h2 className="mb-4 text-sm font-bold text-gray-900">
                        Select Class &amp; Section
                      </h2>
                      <div className="flex flex-wrap items-end gap-4">
                        <div>
                          <label className="mb-1 block text-xs text-gray-500">Class</label>
                          <select
                            value={selectedClass}
                            onChange={(e) => handleClassChange(e.target.value)}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {classOptions.map((c) => (
                              <option key={c} value={c}>
                                {formatClassLabel(c)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-gray-500">Section</label>
                          <select
                            value={selectedSection}
                            onChange={(e) => handleSectionChange(e.target.value)}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {sectionOptions.map((s) => (
                              <option key={s} value={s}>
                                Section {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-gray-500">Date</label>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadStudents}
                          disabled={loadingStudents}
                          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {loadingStudents ? 'Loading…' : 'Load Students'}
                        </button>
                      </div>
                    </div>
                  )}

                  {renderAttendanceContent()}

                  {showConfirmed && activeView === 'summary' && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleBackToClasses}
                        className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Back to Classes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessages()}
                        disabled={messagesSent}
                        className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-gray-900 hover:bg-amber-500 disabled:bg-green-500 disabled:text-white"
                      >
                        {messagesSent ? 'Messages Sent' : 'Submit'}
                      </button>
                    </div>
                  )}
                </div>

                {activeView !== 'grid' && (
                  <RightPanel
                    classPercent={classPercent}
                    summaryBreakdown={summaryBreakdown}
                    absentStudents={absentStudents}
                    showConfirmed={showConfirmed}
                    previewStudent={preview.student}
                    previewStatus={preview.status}
                    classLabel={classLabel}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onSubmitMessages={() => handleSendMessages()}
                    messagesSent={messagesSent}
                    sendCount={messagesToSend.length}
                    onSendMessageToAbsent={handleSendMessageToAbsent}
                    onExportReport={handleExportReport}
                  />
                )}
              </div>
            </>
          ) : activePage === 'calendar' ? (
            <AcademicCalendarPage />
          ) : activePage === 'daywise' ? (
            <DayWiseAttendancePage />
          ) : activePage === 'edit-approvals' ? (
            <EditApprovalsPage user={user} />
          ) : activePage === 'students' ? (
            <StudentsPage />
          ) : activePage === 'leave-letters' ? (
            <LeaveLettersPage />
          ) : activePage === 'classes' ? (
            <ClassesPage />
          ) : activePage === 'teachers' ? (
            <TeachersPage />
          ) : activePage === 'timetable' ? (
            <WeeklyTimetablePage />
          ) : activePage === 'notifications' ? (
            <PlaceholderPage pageId={activePage} />
          ) : activePage === 'reports' ? (
            <ReportsPage />
          ) : activePage === 'settings' ? (
            <SettingsPage user={user} onLogout={handleLogout} />
          ) : activePage === 'support' ? (
            <SupportCenterPage user={user} />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-600 shadow-sm">
              Unknown page.
            </div>
          )}
        </main>
      </div>

      <MobileBottomNav
        activePage={isAttendancePage ? 'attendance' : activePage}
        onNavigate={handleNavigate}
        onOpenMore={() => setIsMobileOpen(true)}
      />

      <AttendanceEditRequestModal
        open={showEditRequestModal}
        onClose={() => setShowEditRequestModal(false)}
        onSubmit={handleRequestEditSubmit}
        teacherName={user?.name}
        classLabel={classLabel}
        attendanceDateLabel={attendanceDateLabel}
        submitting={editRequestSubmitting}
      />
      <AppToast />
    </div>
  );
}
