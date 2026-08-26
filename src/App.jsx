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
import StudentBulkImportPage from './components/StudentBulkImportPage';
import LeaveLettersPage from './components/LeaveLettersPage';
import TcRequestsPage from './components/TcRequestsPage';
import ClassesPage from './components/ClassesPage';
import StudentPromotionPage from './components/StudentPromotionPage';
import SettingsPage from './components/SettingsPage';
import SupportCenterPage from './components/SupportCenterPage';
import ReportsPage from './components/ReportsPage';
import LoginPage from './components/LoginPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import ChangePasswordPage from './components/ChangePasswordPage';
import SchoolSetupPage from './components/SchoolSetupPage';
import UsersPage from './components/UsersPage';
import WeeklyTimetablePage from './components/WeeklyTimetablePage';
import TeachersPage from './components/TeachersPage';
import EditApprovalsPage from './components/EditApprovalsPage';
import AuditLogsPage from './components/AuditLogsPage';
import AttendanceEditRequestModal from './components/AttendanceEditRequestModal';
import NotificationsPage from './components/NotificationsPage';
import SendNotificationPage from './components/SendNotificationPage';
import AttendanceIntelligencePage from './components/AttendanceIntelligencePage';
import AttendanceHistoryPage from './components/AttendanceHistoryPage';
import ChroniclePosterPage from './components/ChroniclePosterPage';
import TeacherPanelPage from './components/TeacherPanelPage';
import HomeworkListPage from './components/HomeworkListPage';
import SubjectsPage from './components/SubjectsPage';
import TimetableSchedulingPage from './components/TimetableSchedulingPage';
import RightPanel from './components/RightPanel';
import AppToast from './components/AppToast';
import MobileBottomNav from './components/MobileBottomNav';
import { getAlertDeliveryPrefs, hydrateAlertDeliveryPrefs } from './services/alertDeliveryPrefs';
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
  isPastAttendanceDate,
  snapToWorkingAttendanceDate,
  ATTENDANCE_HOLIDAY_PICK_MESSAGE,
} from './utils/attendance';
import { isHolidayDate } from './services/calendarService';
import { getNotificationsFeed, markNotificationsSeen } from './services/notificationService.js';
import { exportAttendanceReportPdf } from './services/reportService.js';
import {
  canApproveEditRequests,
  canBulkImportStudents,
  canManageTeachers,
  canManageUsers,
  canViewAuditLogs,
} from './data/navItems.js';
import { getToken, useMock } from './services/api.js';
import { getMe, logout as authLogout, getRequiresPasswordChange, setRequiresPasswordChange } from './services/authService.js';
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
import { SchoolLogo, useBranding } from './lib/branding.jsx';

function BootSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6">
      <SchoolLogo
        variant="full"
        alt="School logo"
        className="h-28 w-auto max-w-[240px] object-contain sm:h-32"
      />
      <p className="text-sm text-slate-400">Starting…</p>
    </div>
  );
}

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
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/setup')) {
      return (
        <>
          <SchoolSetupPage />
          <AppToast />
        </>
      );
    }
    if (path.startsWith('/forgot-password')) {
      return (
        <>
          <ForgotPasswordPage />
          <AppToast />
        </>
      );
    }
    if (path.startsWith('/reset-password')) {
      return (
        <>
          <ResetPasswordPage />
          <AppToast />
        </>
      );
    }
  }
  return <AttendanceApp />;
}

function AttendanceApp() {
  const { logoSrc } = useBranding();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [requiresPasswordChange, setRequiresPasswordChangeState] = useState(() => getRequiresPasswordChange());

  const [activePage, setActivePage] = useState('dashboard');
  const [pageFocus, setPageFocus] = useState(null);
  const [headerNotifications, setHeaderNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
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
  const [rollInput, setRollInput] = useState('');
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [messagesSent, setMessagesSent] = useState(false);
  const [lastSentMessageCount, setLastSentMessageCount] = useState(0);
  const [lastSentStatusByStudent, setLastSentStatusByStudent] = useState(null);
  const [dateIsHoliday, setDateIsHoliday] = useState(false);
  const [datePickerKey, setDatePickerKey] = useState(0);
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

  // Phone: swipe in from the left edge → open Dashboard (and close the menu).
  useEffect(() => {
    const EDGE_PX = 28;
    const MIN_SWIPE = 56;
    let startX = null;
    let startY = null;
    let tracking = false;

    const onStart = (e) => {
      if (window.matchMedia('(min-width: 1024px)').matches) return;
      const t = e.touches?.[0];
      if (!t) return;
      if (t.clientX > EDGE_PX) {
        tracking = false;
        return;
      }
      tracking = true;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onEnd = (e) => {
      if (!tracking || startX == null || startY == null) return;
      tracking = false;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      startX = null;
      startY = null;
      // Rightward swipe from the left edge
      if (dx >= MIN_SWIPE && dy < 80) {
        setActivePage('dashboard');
        setActiveView('grid');
        setIsMobileOpen(false);
      }
    };

    const onCancel = () => {
      tracking = false;
      startX = null;
      startY = null;
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, []);

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
        if (!cancelled) {
          setUser(data.user);
          setRequiresPasswordChangeState(Boolean(data.requiresPasswordChange));
        }
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
    let lastAt = 0;
    const onExpired = () => {
      const now = Date.now();
      if (now - lastAt < 2000) return;
      lastAt = now;
      authLogout();
      setUser(null);
      showToast('Session expired — please sign in again.', 'error');
    };
    window.addEventListener('presence:auth-expired', onExpired);
    return () => window.removeEventListener('presence:auth-expired', onExpired);
  }, []);

  useEffect(() => {
    if (!user) return;
    hydrateAlertDeliveryPrefs().catch(() => {});
  }, [user]);

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
        if (!err?.isAuth) {
          showToast(networkErrorMessage(err) || 'Failed to load classes', 'error');
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setHeaderNotifications([]);
      setNotificationCount(0);
      return undefined;
    }
    let cancelled = false;
    getNotificationsFeed()
      .then((data) => {
        if (cancelled) return;
        setHeaderNotifications(data.notifications || []);
        setNotificationCount(data.unreadCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setHeaderNotifications([]);
          setNotificationCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleNotificationsFeedLoaded = useCallback((data) => {
    setHeaderNotifications(data.notifications || []);
    setNotificationCount(data.unreadCount ?? 0);
  }, []);

  const clearNotificationBadge = useCallback((list) => {
    const feed = list || headerNotifications;
    if (feed.length) {
      markNotificationsSeen(feed.map((n) => n.id));
    }
    setNotificationCount(0);
    setHeaderNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [headerNotifications]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const working = await snapToWorkingAttendanceDate(getTodayAttendanceDate());
      if (!cancelled) setSelectedDate(working);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      if (!err?.isAuth) {
        showToast(msg, 'error');
      }
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
  const isPastAttendanceDay = isPastAttendanceDate(selectedDate);
  // Never offer parent alerts when editing a previous day (server also blocks delivery).
  const messagesToSend = isPastAttendanceDay
    ? []
    : getMessagesToSend(
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

  const handleNavigate = (pageId, view) => {
    if (pageId === 'edit-approvals' && !canApproveEditRequests(user)) {
      setActivePage('dashboard');
      return;
    }
    if (pageId === 'teachers' && !canManageTeachers(user)) {
      setActivePage('dashboard');
      return;
    }
    if (pageId === 'users' && !canManageUsers(user)) {
      setActivePage('dashboard');
      return;
    }
    if (pageId === 'student-import' && !canBulkImportStudents(user)) {
      setActivePage('students');
      return;
    }
    if (pageId === 'audit-logs' && !canViewAuditLogs(user)) {
      setActivePage('dashboard');
      return;
    }
    if (pageId === 'attendance-intelligence' && !canApproveEditRequests(user)) {
      setActivePage('dashboard');
      return;
    }
    if (pageId === 'student-promotion' && !canApproveEditRequests(user)) {
      setActivePage('dashboard');
      return;
    }
    if (pageId === 'student-demotion') {
      setActivePage('student-promotion');
      return;
    }
    if (pageId === 'chronicle' && !canApproveEditRequests(user)) {
      setActivePage('dashboard');
      return;
    }
    const opts = view && typeof view === 'object' ? view : null;
    const attendanceView = typeof view === 'string' ? view : opts?.view;
    if (opts?.className || opts?.sectionName) {
      setPageFocus({
        className: opts.className || '',
        sectionName: opts.sectionName || '',
      });
    } else if (pageId === 'students' || pageId === 'classes') {
      setPageFocus(null);
    }
    if (opts?.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
      setSelectedDate(opts.date);
    }
    if (pageId === 'attendance-history' && typeof view === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(view)) {
      setActiveView(view);
    } else if (pageId === 'attendance-history' && opts?.date) {
      setActiveView(opts.date);
    }
    setActivePage(pageId);
    if (pageId === 'attendance') {
      setActiveView(attendanceView || 'grid');
    } else if (pageId === 'attendance-intelligence') {
      setActiveView(typeof view === 'string' ? view : opts?.tab || 'alerts');
    } else if (pageId === 'dashboard') {
      setActiveView('grid');
    }
  };

  const denyEditApprovalsAccess = useCallback(() => {
    setActivePage('dashboard');
  }, []);

  const denyTeachersAccess = useCallback(() => {
    setActivePage('dashboard');
  }, []);

  const denyUsersAccess = useCallback(() => {
    setActivePage('dashboard');
  }, []);

  const denyStudentImportAccess = useCallback(() => {
    setActivePage('students');
  }, []);

  const denyAuditLogsAccess = useCallback(() => {
    setActivePage('dashboard');
  }, []);

  useEffect(() => {
    if (!user) return;
    if (activePage === 'edit-approvals' && !canApproveEditRequests(user)) {
      denyEditApprovalsAccess();
    }
    if (activePage === 'teachers' && !canManageTeachers(user)) {
      denyTeachersAccess();
    }
    if (activePage === 'users' && !canManageUsers(user)) {
      denyUsersAccess();
    }
    if (activePage === 'student-import' && !canBulkImportStudents(user)) {
      denyStudentImportAccess();
    }
    if (activePage === 'audit-logs' && !canViewAuditLogs(user)) {
      denyAuditLogsAccess();
    }
  }, [
    activePage,
    user,
    denyEditApprovalsAccess,
    denyTeachersAccess,
    denyUsersAccess,
    denyStudentImportAccess,
    denyAuditLogsAccess,
  ]);

  const loadClass = async (classNum, section, date = selectedDate, { silent = false } = {}) => {
    if (await isHolidayDate(date)) {
      showToast(ATTENDANCE_HOLIDAY_PICK_MESSAGE, 'error');
      return;
    }
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

  const applyAttendanceDate = (date) => {
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

  const handleDateChange = async (date) => {
    if (!date || date === selectedDate) return;
    if (await isHolidayDate(date)) {
      showToast(ATTENDANCE_HOLIDAY_PICK_MESSAGE, 'error');
      setDatePickerKey((n) => n + 1);
      return;
    }
    applyAttendanceDate(date);
  };

  const persistDaily = async ({ confirmAfter = false } = {}) => {
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
      } else {
        setShowConfirmed(false);
        setMessagesSent(false);
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

  const handleClearAbsent = (rowIdx) => {
    setGrid((prev) => setTodayStatus(prev, rowIdx, 'P'));
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
    await persistDaily();
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
      showToast('No absent students in this class.', 'info');
      return;
    }
    if (!showConfirmed) {
      showToast('Please submit attendance before messaging absent students.', 'info');
      return;
    }
    // Do not forceResend — skip parents already notified for the same status.
    handleSendMessages();
  };

  const handleExportReport = async () => {
    if (!students.length) {
      showToast('Load students first.', 'info');
      return;
    }
    const dateLabel = formatAttendanceDate(selectedDate);
    const rows = students.map((student, rowIdx) => {
      const status = grid[rowIdx]?.[TODAY_IDX];
      const label = getStatusDisplay(status).label;
      return {
        roll: student.roll ?? '',
        name: student.name ?? '',
        status: label,
      };
    });
    try {
      exportAttendanceReportPdf({
        classLabel,
        dateLabel,
        rows,
        logoUrl: logoSrc,
      });
      showToast('Print dialog opened — choose Save as PDF.', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to export PDF', 'error');
    }
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
    if (isPastAttendanceDate(selectedDate)) {
      showToast(
        "Parent messages are only sent for today's attendance — not when editing previous days.",
        'info'
      );
      return;
    }
    if (messagesSent && !forceResend) {
      showToast('Messages were already sent to parents.', 'info');
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
        showToast(
          'No new messages to send — parents were already notified for these statuses.',
          'info'
        );
      } else {
        showToast('No parent messages to send (Present students are not notified).', 'info');
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
      const { channel, recipient } = getAlertDeliveryPrefs();
      const result = await submitParentMessages({
        sectionId: sid,
        date: selectedDate,
        initiatedAt,
        channel,
        recipient,
        messages: pending.map((n) => ({
          studentId: String(n.student.id),
          status: n.status,
          message: n.message,
        })),
      });

      if (result?.skippedDelivery || result?.skipReason === 'past_attendance_date') {
        showToast(
          result.message ||
            "Parent messages are only sent for today's attendance — not when editing previous days.",
          'info'
        );
        return;
      }

      const snapshot = { ...(forceResend ? {} : lastSentStatusByStudent || {}) };
      for (const m of result.sentMessages || pending) {
        snapshot[String(m.studentId || m.student?.id)] = m.status;
      }
      // Ensure pending statuses are present even if API omits them.
      for (const n of pending) {
        snapshot[String(n.student.id)] = n.status;
      }

      handleSendToParents(pending.length, snapshot);
      await refreshEditContext(sid, selectedDate);
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
            dateInputKey={datePickerKey}
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
            dateInputKey={datePickerKey}
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
      case 'roll': {
        const recentAbsents = students
          .map((s, rowIdx) => ({
            id: s.id,
            name: s.name,
            roll: s.roll,
            rowIdx,
          }))
          .filter((s) => normalizeStatus(grid[s.rowIdx]?.[TODAY_IDX]) === 'A')
          .map((s) => ({ ...s, timeLabel: 'Just now' }));

        return (
          <div className="space-y-4">
            <RollQuickEntry
              rollInput={rollInput}
              onRollInputChange={setRollInput}
              onMarkAbsent={handleMarkAbsent}
              showConfirmed={showConfirmed}
              absentCount={classSummary.absent}
              recentAbsents={recentAbsents}
              onClearAbsent={handleClearAbsent}
              onViewSummary={() => setActiveView('summary')}
            />
            <AttendanceActions
              showConfirmed={showConfirmed}
              onReset={handleReset}
              onConfirm={handleConfirm}
              hint="Use roll numbers above, then confirm attendance"
            />
          </div>
        );
      }
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
        if (!studentsLoaded) {
          return (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-800">No attendance loaded yet</p>
              <p className="mt-2 text-sm text-gray-500">
                Choose class, section, and date above, then click <strong>Load Students</strong> to
                view that section&apos;s summary.
              </p>
              <button
                type="button"
                onClick={handleLoadStudents}
                disabled={loadingStudents}
                className="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loadingStudents ? 'Loading…' : 'Load Students'}
              </button>
            </div>
          );
        }
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

  const showClassSelector = ['roll', 'list', 'summary'].includes(activeView);
  const isAttendancePage = activePage === 'attendance';
  const sidebarPage = activePage === 'student-import' ? 'students' : isAttendancePage ? 'attendance' : activePage;

  if (!authReady) {
    return <BootSplash />;
  }

  if (!user) {
    return (
      <>
        <LoginPage
          onSuccess={(data) => {
            if (data?.user && getToken()) {
              setUser(data.user);
              setRequiresPasswordChangeState(Boolean(data.requiresPasswordChange));
              setRequiresPasswordChange(Boolean(data.requiresPasswordChange));
            } else showToast('Login saved incompletely — please try again.', 'error');
          }}
        />
        <AppToast />
      </>
    );
  }

  if (requiresPasswordChange) {
    return (
      <>
        <ChangePasswordPage
          user={user}
          onSuccess={() => {
            setRequiresPasswordChangeState(false);
            setRequiresPasswordChange(false);
            showToast('Password updated. Welcome!', 'success');
          }}
        />
        <AppToast />
      </>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      <Sidebar
        activePage={sidebarPage}
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
        user={user}
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
          onNotificationsClick={() => {
            handleNavigate('notifications');
          }}
          onNotificationItemClick={(n) => {
            handleNavigate(n.page || 'notifications');
          }}
          onNotificationsOpened={() => {}}
          onMarkAllNotificationsRead={clearNotificationBadge}
          user={user}
          onLogout={handleLogout}
          dateLabel={attendanceDateLabel}
          notificationCount={notificationCount}
          notifications={headerNotifications}
        />

        <main className="space-y-4 p-3 pb-24 sm:space-y-5 sm:p-6 lg:pb-6">
          {activePage === 'dashboard' ? (
            <DashboardPage
              stats={dashStats}
              error={dashStatsError}
              dateLabel={attendanceDateLabel}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onNavigate={handleNavigate}
              user={user}
              classesData={classesData}
            />
          ) : activePage === 'attendance-history' ? (
            <AttendanceHistoryPage
              user={user}
              classesData={classesData}
              onNavigate={handleNavigate}
              initialDate={
                /^\d{4}-\d{2}-\d{2}$/.test(String(activeView || ''))
                  ? activeView
                  : selectedDate < getTodayAttendanceDate()
                    ? selectedDate
                    : null
              }
            />
          ) : isAttendancePage ? (
            <>
              <div className="hidden lg:block">
                <StatsCards stats={dashStats} />
              </div>
              <ViewModeTabs activeView={activeView} onChange={setActiveView} />

              {dateIsHoliday && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                  <strong>{attendanceDateLabel}</strong> is marked as a holiday (Sunday / government /
                  sudden). Attendance is not taken on this date. Pick a working day.
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
                      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-gray-500">Class</label>
                          <select
                            value={selectedClass}
                            onChange={(e) => handleClassChange(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-auto sm:px-4 sm:py-2"
                          >
                            {classOptions.map((c) => (
                              <option key={c} value={c}>
                                {formatClassLabel(c)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-gray-500">Section</label>
                          <select
                            value={selectedSection}
                            onChange={(e) => handleSectionChange(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-auto sm:px-4 sm:py-2"
                          >
                            {sectionOptions.map((s) => (
                              <option key={s} value={s}>
                                Section {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 min-w-0 sm:min-w-[11.5rem]">
                          <label className="mb-1 block text-xs text-gray-500">Date</label>
                          <input
                            key={datePickerKey}
                            type="date"
                            value={selectedDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="date-input w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:py-2"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadStudents}
                          disabled={loadingStudents}
                          className="col-span-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 sm:col-span-1 sm:py-2"
                        >
                          {loadingStudents ? 'Loading…' : 'Load Students'}
                        </button>
                      </div>
                    </div>
                  )}

                  {renderAttendanceContent()}

                  {showConfirmed && activeView === 'summary' && (
                    <div className="flex flex-wrap gap-3">
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
                        disabled={messagesSent || isPastAttendanceDay}
                        className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-gray-900 hover:bg-amber-500 disabled:bg-green-500 disabled:text-white"
                        title={
                          isPastAttendanceDay
                            ? 'Parent alerts are not sent for previous-day attendance'
                            : undefined
                        }
                      >
                        {messagesSent
                          ? 'Messages Sent'
                          : isPastAttendanceDay
                            ? 'No parent alerts (past day)'
                            : 'Send to Parents'}
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
                    onDateChange={handleDateChange}
                    dateInputKey={datePickerKey}
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
            canApproveEditRequests(user) ? (
              <EditApprovalsPage
                user={user}
                onAccessDenied={denyEditApprovalsAccess}
              />
            ) : null
          ) : activePage === 'students' ? (
            <StudentsPage
              user={user}
              onNavigate={handleNavigate}
              initialClass={pageFocus?.className}
              initialSection={pageFocus?.sectionName}
            />
          ) : activePage === 'student-import' ? (
            canBulkImportStudents(user) ? (
              <StudentBulkImportPage
                user={user}
                onBack={() => setActivePage('students')}
              />
            ) : null
          ) : activePage === 'leave-letters' ? (
            <LeaveLettersPage />
          ) : activePage === 'tc-requests' ? (
            <TcRequestsPage user={user} />
          ) : activePage === 'classes' ? (
            <ClassesPage initialClassName={pageFocus?.className} />
          ) : activePage === 'student-promotion' || activePage === 'student-demotion' ? (
            canApproveEditRequests(user) ? <StudentPromotionPage /> : null
          ) : activePage === 'teachers' ? (
            canManageTeachers(user) ? (
              <TeachersPage user={user} onAccessDenied={denyTeachersAccess} />
            ) : null
          ) : activePage === 'users' ? (
            canManageUsers(user) ? (
              <UsersPage user={user} onAccessDenied={denyUsersAccess} />
            ) : null
          ) : activePage === 'audit-logs' ? (
            canViewAuditLogs(user) ? (
              <AuditLogsPage user={user} onAccessDenied={denyAuditLogsAccess} />
            ) : null
          ) : activePage === 'attendance-intelligence' ? (
            canApproveEditRequests(user) ? (
              <AttendanceIntelligencePage
                initialTab={activeView || 'alerts'}
                onNavigate={handleNavigate}
                user={user}
              />
            ) : null
          ) : activePage === 'chronicle' ? (
            canApproveEditRequests(user) ? (
              <ChroniclePosterPage onNavigate={handleNavigate} />
            ) : null
          ) : activePage === 'timetable' ? (
            <WeeklyTimetablePage />
          ) : activePage === 'notifications' ? (
            <NotificationsPage
              onNavigate={handleNavigate}
              onFeedLoaded={handleNotificationsFeedLoaded}
              onMarkAllRead={clearNotificationBadge}
            />
          ) : activePage === 'send-notification' ? (
            <SendNotificationPage user={user} onNavigate={handleNavigate} />
          ) : activePage === 'assign-homework' ? (
            <TeacherPanelPage mode="assign-homework" onNavigate={handleNavigate} />
          ) : activePage === 'timetable-scheduling' ||
            activePage === 'regular-timetable' ||
            activePage === 'update-timetable' ? (
            <TimetableSchedulingPage user={user} />
          ) : activePage === 'timetable-nav' ||
            activePage === 'test-timetable' ||
            activePage === 'exam-timetable' ? (
            <TeacherPanelPage mode="exam-timetable" onNavigate={handleNavigate} />
          ) : activePage === 'homework-list' ? (
            <HomeworkListPage onAssign={() => setActivePage('assign-homework')} />
          ) : activePage === 'subjects' ? (
            <SubjectsPage onNavigate={handleNavigate} />
          ) : activePage === 'reports' ? (
            <ReportsPage user={user} />
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
        activePage={activePage}
        onNavigate={handleNavigate}
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
