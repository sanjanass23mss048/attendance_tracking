/** Roles that can approve attendance edit requests (matches API requireRoles). */
export const EDIT_APPROVER_ROLES = [
  'INCHARGE',
  'HOD',
  'VICE_PRINCIPAL',
  'PRINCIPAL',
  'ADMIN',
  'HEADMASTER',
];

/** Same leadership roles — staff directory (Teachers) is for in-charge / admin, not class teachers. */
export const STAFF_MANAGER_ROLES = EDIT_APPROVER_ROLES;

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'attendance', label: 'Attendance', icon: 'ClipboardCheck' },
  {
    id: 'edit-approvals',
    label: 'Edit Approvals',
    icon: 'Shield',
    roles: EDIT_APPROVER_ROLES,
  },
  { id: 'students', label: 'Students', icon: 'Users' },
  { id: 'leave-letters', label: 'Leave Letters', icon: 'FileText' },
  { id: 'calendar', label: 'Academic Calendar', icon: 'CalendarDays' },
  { id: 'classes', label: 'Classes', icon: 'BookOpen' },
  {
    id: 'teachers',
    label: 'Teachers',
    icon: 'GraduationCap',
    roles: STAFF_MANAGER_ROLES,
  },
  { id: 'reports', label: 'Reports', icon: 'BarChart3' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
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
  const role = String(user?.role || user?.role_id || '').toUpperCase();
  return item.roles.map((r) => String(r).toUpperCase()).includes(role);
}

export function canApproveEditRequests(user) {
  return hasLeadershipRole(user);
}

/** Teachers page — In-charge (e.g. A. Pune) and school leadership only. */
export function canManageTeachers(user) {
  return hasLeadershipRole(user);
}

export function navItemsForUser(user) {
  return navItems.filter((item) => canAccessNavItem(item, user));
}
