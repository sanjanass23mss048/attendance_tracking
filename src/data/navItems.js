/** Roles that can approve attendance edit requests (matches API requireRoles). */
export const EDIT_APPROVER_ROLES = [
  'INCHARGE',
  'HOD',
  'VICE_PRINCIPAL',
  'PRINCIPAL',
  'ADMIN',
  'HEADMASTER',
];

/** Same leadership roles — staff directory is for in-charge / admin, not class teachers. */
export const STAFF_MANAGER_ROLES = EDIT_APPROVER_ROLES;

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  {
    id: 'attendance-group',
    label: 'Attendance',
    icon: 'ClipboardCheck',
    children: [
      { id: 'attendance', label: 'Mark Attendance', icon: 'ClipboardCheck', dot: 'bg-violet-400' },
      {
        id: 'edit-approvals',
        label: 'Edit Approvals',
        icon: 'Shield',
        roles: EDIT_APPROVER_ROLES,
        dot: 'bg-amber-400',
      },
      { id: 'leave-letters', label: 'Leave Letters', icon: 'FileText', dot: 'bg-sky-400' },
    ],
  },
  {
    id: 'students-group',
    label: 'Students',
    icon: 'Users',
    children: [
      { id: 'students', label: 'Student Directory', icon: 'Users', dot: 'bg-violet-400' },
      { id: 'classes', label: 'Classes & Sections', icon: 'BookOpen', dot: 'bg-emerald-400' },
    ],
  },
  {
    id: 'academics',
    label: 'Academics',
    icon: 'Library',
    children: [
      { id: 'timetable-nav', label: 'Timetable', icon: 'CalendarClock', dot: 'bg-violet-400' },
      { id: 'subjects', label: 'Subjects', icon: 'Library', dot: 'bg-sky-400' },
      { id: 'assign-homework', label: 'Assign Homework', icon: 'BookMarked', dot: 'bg-amber-400' },
      { id: 'homework-list', label: 'Homework List', icon: 'BookMarked', dot: 'bg-rose-400' },
      { id: 'calendar', label: 'Academic Calendar', icon: 'CalendarDays', dot: 'bg-emerald-400' },
    ],
  },
  { id: 'send-notification', label: 'Communication', icon: 'Megaphone' },
  {
    id: 'staff-management',
    label: 'Staff Management',
    icon: 'GraduationCap',
    children: [
      { id: 'teachers', label: 'Staff', icon: 'GraduationCap', roles: STAFF_MANAGER_ROLES, dot: 'bg-violet-400' },
      { id: 'users', label: 'Users', icon: 'UserCog', roles: STAFF_MANAGER_ROLES, dot: 'bg-sky-400' },
      { id: 'audit-logs', label: 'Audit Logs', icon: 'ScrollText', roles: ['ADMIN'], dot: 'bg-amber-400' },
    ],
  },
  { id: 'reports', label: 'Reports', icon: 'BarChart3' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
  { id: 'support', label: 'Help & Support', icon: 'Headset' },
];

function hasLeadershipRole(user) {
  const role = String(user?.role || user?.role_id || '').toUpperCase();
  if (!role || role === 'TEACHER') return false;
  return EDIT_APPROVER_ROLES.map((r) => String(r).toUpperCase()).includes(role);
}

export function canAccessNavItem(item, user) {
  if (!item?.roles?.length) return true;
  if (item.id === 'edit-approvals') return canApproveEditRequests(user);
  if (item.id === 'teachers') return canManageTeachers(user);
  if (item.id === 'users') return canManageUsers(user);
  if (item.id === 'audit-logs') return canViewAuditLogs(user);
  const role = String(user?.role || user?.role_id || '').toUpperCase();
  return item.roles.map((r) => String(r).toUpperCase()).includes(role);
}

export function canApproveEditRequests(user) {
  return hasLeadershipRole(user);
}

/** Staff directory — In-charge (e.g. A. Pune) and school leadership only. */
export function canManageTeachers(user) {
  return hasLeadershipRole(user);
}

export function canManageUsers(user) {
  return hasLeadershipRole(user);
}

/** Bulk student Excel import — same leadership roles as staff directory. */
export function canBulkImportStudents(user) {
  return hasLeadershipRole(user);
}

/** School-wide audit feed — administrators only. */
export function canViewAuditLogs(user) {
  const role = String(user?.role || user?.role_id || '').toUpperCase();
  return role === 'ADMIN';
}

export function navItemsForUser(user) {
  return navItems
    .map((item) => {
      if (!item.children?.length) {
        return canAccessNavItem(item, user) ? item : null;
      }
      const children = item.children.filter((child) => canAccessNavItem(child, user));
      if (!children.length) return null;
      return { ...item, children };
    })
    .filter(Boolean);
}

/** Whether a nav id belongs under a parent group (for active highlighting). */
export function isNavChildActive(item, activePage) {
  if (!item?.children?.length) return activePage === item.id;
  return item.children.some((c) => c.id === activePage);
}
