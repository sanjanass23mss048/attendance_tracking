export const AUDIT_STATUS_LABELS = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  H: 'Half Day',
  OH: 'OD Half',
  OF: 'OD Full',
};

const STATUS_ORDER = ['P', 'A', 'L', 'H', 'OH', 'OF'];

export function studentAuditRef(enrollment) {
  return {
    studentId: enrollment.id,
    rollNo: enrollment.rollNo ?? null,
    name: enrollment.name || 'Unknown',
  };
}

export function groupMarksByStatus(enrollments, statusByStudentId) {
  const byStatus = {};
  for (const s of enrollments || []) {
    const status = String(statusByStudentId?.get(String(s.id)) || 'P').toUpperCase();
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(studentAuditRef(s));
  }
  return byStatus;
}

export function statusCountSummary(byStatus) {
  const parts = [];
  for (const code of STATUS_ORDER) {
    const n = byStatus?.[code]?.length || 0;
    if (!n) continue;
    parts.push(`${n} ${AUDIT_STATUS_LABELS[code] || code}`);
  }
  return parts.join(', ') || '0 marked';
}

export function nameList(students, max = 8) {
  const names = (students || []).map((s) => s.name).filter(Boolean);
  if (!names.length) return '';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`;
}

export function formatChangeLine(change) {
  const from = AUDIT_STATUS_LABELS[change.from] || change.from || '?';
  const to = AUDIT_STATUS_LABELS[change.to] || change.to || '?';
  const roll = change.rollNo != null && change.rollNo !== '' ? ` (#${change.rollNo})` : '';
  return `${change.name || 'Student'}${roll}: ${from} → ${to}`;
}

export function clipAuditSummary(text, max = 500) {
  const s = String(text || '');
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

export function attendanceSnapshotDetails(byStatus) {
  return {
    counts: Object.fromEntries(
      STATUS_ORDER.filter((code) => byStatus?.[code]?.length).map((code) => [
        code,
        byStatus[code].length,
      ])
    ),
    present: byStatus?.P || [],
    absent: byStatus?.A || [],
    late: byStatus?.L || [],
    halfDay: byStatus?.H || [],
    odHalf: byStatus?.OH || [],
    odFull: byStatus?.OF || [],
  };
}
