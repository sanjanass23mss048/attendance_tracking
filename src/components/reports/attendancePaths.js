/** Path helpers for Attendance Reports (hash routes under #/reports/attendance/...). */

export function buildAttendancePath(parts) {
  const { view, classId, sectionId, status, studentId } = parts;
  if (view === 'overview' || !view) return '/reports/attendance';
  if (view === 'student' && studentId) {
    const base = `/reports/attendance/student/${encodeURIComponent(studentId)}`;
    if (classId && sectionId) {
      return `${base}?class=${encodeURIComponent(classId)}&section=${encodeURIComponent(sectionId)}`;
    }
    return base;
  }
  if (view === 'status' && classId && sectionId && status) {
    return `/reports/attendance/class/${encodeURIComponent(classId)}/section/${encodeURIComponent(sectionId)}/${encodeURIComponent(status)}`;
  }
  if (view === 'section' && classId && sectionId) {
    return `/reports/attendance/class/${encodeURIComponent(classId)}/section/${encodeURIComponent(sectionId)}`;
  }
  if (view === 'class' && classId) {
    return `/reports/attendance/class/${encodeURIComponent(classId)}`;
  }
  return '/reports/attendance';
}

export function parseAttendancePath(pathname) {
  const raw = String(pathname || '').replace(/^#/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const params = new URLSearchParams(queryPart);

  const student = path.match(/^\/reports\/attendance\/student\/([^/]+)\/?$/);
  if (student) {
    return {
      view: 'student',
      studentId: decodeURIComponent(student[1]),
      classId: params.get('class') || undefined,
      sectionId: params.get('section') || undefined,
    };
  }
  const status = path.match(
    /^\/reports\/attendance\/class\/([^/]+)\/section\/([^/]+)\/(present|absent|late|half-day|od-half-day|od-full-day)\/?$/i
  );
  if (status) {
    return {
      view: 'status',
      classId: decodeURIComponent(status[1]),
      sectionId: decodeURIComponent(status[2]),
      status: status[3].toLowerCase(),
    };
  }
  const section = path.match(/^\/reports\/attendance\/class\/([^/]+)\/section\/([^/]+)\/?$/);
  if (section) {
    return {
      view: 'section',
      classId: decodeURIComponent(section[1]),
      sectionId: decodeURIComponent(section[2]),
    };
  }
  const klass = path.match(/^\/reports\/attendance\/class\/([^/]+)\/?$/);
  if (klass) {
    return { view: 'class', classId: decodeURIComponent(klass[1]) };
  }
  if (path.startsWith('/reports/attendance')) {
    return { view: 'overview' };
  }
  return null;
}

export function readHashPath() {
  const hash = window.location.hash.replace(/^#/, '') || '';
  return parseAttendancePath(hash) || { view: 'overview' };
}

export function writeHashPath(parts) {
  const next = buildAttendancePath(parts);
  const hash = `#${next}`;
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
  }
}

export const STATUS_ROUTE_MAP = {
  present: 'P',
  absent: 'A',
  late: 'L',
  'half-day': 'H',
  'od-half-day': 'OH',
  'od-full-day': 'OF',
};

export const STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  'half-day': 'Half Day',
  'od-half-day': 'OD Half Day',
  'od-full-day': 'OD Full Day',
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  H: 'Half Day',
  OH: 'OD Half Day',
  OF: 'OD Full Day',
};
