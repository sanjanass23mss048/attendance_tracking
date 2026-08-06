import { apiFetch, useMock } from './api.js';

const MOCK_TEACHERS = [
  {
    id: 't1',
    employeeId: 'EMP001',
    name: 'Neha Sharma',
    email: 'neha.sharma@brightfuture.edu.in',
    phone: '9876501001',
    staffType: 'teaching',
    role: 'Class Teacher',
    department: 'Primary',
    subjects: 'English',
    classesAssigned: '1-A',
    status: 'Active',
    dob: '1988-07-18',
    gender: 'Female',
    joinDate: '2019-06-01',
  },
  {
    id: 't2',
    employeeId: 'EMP002',
    name: 'Rakesh Verma',
    email: 'rakesh.verma@brightfuture.edu.in',
    phone: '9876501002',
    staffType: 'teaching',
    role: 'Subject Teacher',
    department: 'Mathematics',
    subjects: 'Maths',
    classesAssigned: '1-A, 2-A, 3-B',
    status: 'Active',
    dob: '1985-03-12',
    gender: 'Male',
    joinDate: '2017-04-15',
  },
  {
    id: 't3',
    employeeId: 'EMP003',
    name: 'Priya Nair',
    email: 'priya.nair@brightfuture.edu.in',
    phone: '9876501003',
    staffType: 'teaching',
    role: 'Subject Teacher',
    department: 'Science',
    subjects: 'EVS, Science',
    classesAssigned: '1-A, 1-B',
    status: 'On Leave',
    dob: '1990-07-20',
    gender: 'Female',
    joinDate: '2020-06-10',
  },
  {
    id: 't4',
    employeeId: 'EMP004',
    name: 'Anita Desai',
    email: 'anita.desai@brightfuture.edu.in',
    phone: '9876501004',
    staffType: 'teaching',
    role: 'Subject Teacher',
    department: 'Languages',
    subjects: 'Hindi',
    classesAssigned: '1-A, 2-B, 4-A',
    status: 'Active',
    dob: '1982-11-05',
    gender: 'Female',
    joinDate: '2015-07-01',
  },
  {
    id: 't5',
    employeeId: 'EMP005',
    name: 'Sonal Mehta',
    email: 'sonal.mehta@brightfuture.edu.in',
    phone: '9876501005',
    staffType: 'teaching',
    role: 'Subject Teacher',
    department: 'Computer Science',
    subjects: 'Computer',
    classesAssigned: '1-A, 5-A',
    status: 'Active',
    dob: '1992-01-28',
    gender: 'Female',
    joinDate: '2021-06-01',
  },
  {
    id: 't6',
    employeeId: 'EMP006',
    name: 'Meera Joshi',
    email: 'meera.joshi@brightfuture.edu.in',
    phone: '9876501006',
    staffType: 'teaching',
    role: 'Subject Teacher',
    department: 'Arts',
    subjects: 'Drawing',
    classesAssigned: '1-A, 2-A',
    status: 'Active',
    dob: '1989-09-14',
    gender: 'Female',
    joinDate: '2018-06-15',
  },
  {
    id: 't7',
    employeeId: 'EMP007',
    name: 'Vikram Singh',
    email: 'vikram.singh@brightfuture.edu.in',
    phone: '9876501007',
    staffType: 'teaching',
    role: 'Subject Teacher',
    department: 'Physical Education',
    subjects: 'Games',
    classesAssigned: '1-A, 3-A, 4-B',
    status: 'Active',
    dob: '1984-07-22',
    gender: 'Male',
    joinDate: '2016-04-01',
  },
  {
    id: 't8',
    employeeId: 'EMP008',
    name: 'Kavita Rao',
    email: 'kavita.rao@brightfuture.edu.in',
    phone: '9876501008',
    staffType: 'teaching',
    role: 'Librarian',
    department: 'Library',
    subjects: 'Library',
    classesAssigned: '1-A, 2-C',
    status: 'Active',
    dob: '1987-05-09',
    gender: 'Female',
    joinDate: '2019-08-01',
  },
  {
    id: 't9',
    employeeId: 'EMP009',
    name: 'Amit Khanna',
    email: 'amit.khanna@brightfuture.edu.in',
    phone: '9876501009',
    staffType: 'teaching',
    role: 'Class Teacher',
    department: 'Social Studies',
    subjects: 'Social',
    classesAssigned: '5-A',
    status: 'Active',
    dob: '1986-12-01',
    gender: 'Male',
    joinDate: '2018-06-01',
  },
  {
    id: 't10',
    employeeId: 'EMP010',
    name: 'Deepa Iyer',
    email: 'deepa.iyer@brightfuture.edu.in',
    phone: '9876501010',
    staffType: 'teaching',
    role: 'Subject Teacher',
    department: 'Science',
    subjects: 'Science',
    classesAssigned: '4-A, 5-B',
    status: 'Active',
    dob: '1991-08-30',
    gender: 'Female',
    joinDate: '2022-06-01',
  },
  {
    id: 't11',
    employeeId: 'EMP011',
    name: 'Sunita Patel',
    email: 'sunita.patel@brightfuture.edu.in',
    phone: '9876501011',
    staffType: 'non-teaching',
    role: 'Admin Staff',
    department: 'Administration',
    subjects: null,
    classesAssigned: null,
    status: 'Active',
    dob: '1983-02-17',
    gender: 'Female',
    joinDate: '2014-01-10',
  },
  {
    id: 't12',
    employeeId: 'EMP012',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@brightfuture.edu.in',
    phone: '9876501012',
    staffType: 'non-teaching',
    role: 'Accountant',
    department: 'Accounts',
    subjects: null,
    classesAssigned: null,
    status: 'Active',
    dob: '1980-06-25',
    gender: 'Male',
    joinDate: '2012-03-01',
  },
  {
    id: 't13',
    employeeId: 'EMP013',
    name: 'Lakshmi Devi',
    email: 'lakshmi.devi@brightfuture.edu.in',
    phone: '9876501013',
    staffType: 'non-teaching',
    role: 'Office Assistant',
    department: 'Administration',
    subjects: null,
    classesAssigned: null,
    status: 'On Leave',
    dob: '1993-07-16',
    gender: 'Female',
    joinDate: '2023-01-15',
  },
  {
    id: 't14',
    employeeId: 'EMP014',
    name: 'Suresh Yadav',
    email: 'suresh.yadav@brightfuture.edu.in',
    phone: '9876501014',
    staffType: 'non-teaching',
    role: 'Support Staff',
    department: 'Maintenance',
    subjects: null,
    classesAssigned: null,
    status: 'Active',
    dob: '1978-10-08',
    gender: 'Male',
    joinDate: '2010-05-01',
  },
];

/** In-memory mock store when VITE_USE_MOCK !== 'false'. */
let mockTeachers = MOCK_TEACHERS.map((t) => ({ ...t }));

function uniqueSubjectsCount(teachers) {
  const set = new Set();
  for (const t of teachers) {
    if (!t.subjects) continue;
    for (const part of String(t.subjects).split(/[,/|]/)) {
      const s = part.trim();
      if (s) set.add(s.toLowerCase());
    }
  }
  return set.size;
}

function classesAssignedCount(teachers) {
  const set = new Set();
  for (const t of teachers) {
    if (!t.classesAssigned) continue;
    for (const part of String(t.classesAssigned).split(/[,;]/)) {
      const s = part.trim();
      if (s) set.add(s.toLowerCase());
    }
  }
  return set.size;
}

function buildSummary(teachers) {
  const teaching = teachers.filter((t) => t.staffType === 'teaching');
  const nonTeaching = teachers.filter((t) => t.staffType === 'non-teaching');
  return {
    teachingStaff: teaching.length,
    nonTeachingStaff: nonTeaching.length,
    totalSubjects: uniqueSubjectsCount(teaching),
    classesAssigned: classesAssignedCount(teaching),
    leavesToday: teachers.filter((t) => t.status === 'On Leave').length,
    total: teachers.length,
  };
}

function normalizeTeacher(t) {
  return {
    id: String(t.id),
    employeeId: t.employeeId,
    name: t.name,
    email: t.email,
    phone: t.phone ?? null,
    staffType: t.staffType || 'teaching',
    role: t.role || 'Subject Teacher',
    department: t.department ?? null,
    subjects: t.subjects ?? null,
    classesAssigned: t.classesAssigned ?? null,
    status: t.status || 'Active',
    dob: t.dob ? String(t.dob).slice(0, 10) : null,
    gender: t.gender ?? null,
    address: t.address ?? null,
    joinDate: t.joinDate ? String(t.joinDate).slice(0, 10) : null,
  };
}

/**
 * @param {{ staffType?: string, status?: string, department?: string, q?: string }} [query]
 */
export async function getTeachers(query = {}) {
  if (useMock()) {
    let list = mockTeachers.map(normalizeTeacher);
    if (query.staffType === 'teaching' || query.staffType === 'non-teaching') {
      list = list.filter((t) => t.staffType === query.staffType);
    }
    if (query.status) list = list.filter((t) => t.status === query.status);
    if (query.department) list = list.filter((t) => t.department === query.department);
    if (query.q) {
      const q = query.q.trim().toLowerCase();
      list = list.filter((t) =>
        [t.name, t.email, t.employeeId, t.role, t.department, t.subjects, t.classesAssigned]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return { teachers: list, summary: buildSummary(mockTeachers.map(normalizeTeacher)) };
  }

  const params = new URLSearchParams();
  if (query.staffType) params.set('staffType', query.staffType);
  if (query.status) params.set('status', query.status);
  if (query.department) params.set('department', query.department);
  if (query.q) params.set('q', query.q);
  const qs = params.toString();
  const data = await apiFetch(`/api/teachers${qs ? `?${qs}` : ''}`);
  return {
    teachers: (data.teachers || []).map(normalizeTeacher),
    summary: data.summary || buildSummary(data.teachers || []),
  };
}

export async function getTeacher(id) {
  if (useMock()) {
    const found = mockTeachers.find((t) => String(t.id) === String(id));
    if (!found) throw Object.assign(new Error('Teacher not found'), { status: 404 });
    return { teacher: normalizeTeacher(found) };
  }
  const data = await apiFetch(`/api/teachers/${id}`);
  return { teacher: normalizeTeacher(data.teacher) };
}

export async function createTeacher(payload) {
  if (useMock()) {
    if (mockTeachers.some((t) => t.employeeId === payload.employeeId || t.email === payload.email)) {
      throw Object.assign(new Error('Employee ID or email already exists'), { status: 409 });
    }
    const teacher = normalizeTeacher({
      id: `t-new-${Date.now()}`,
      ...payload,
      staffType: payload.staffType || 'teaching',
      role: payload.role || 'Subject Teacher',
      status: payload.status || 'Active',
    });
    mockTeachers = [...mockTeachers, teacher];
    return { teacher };
  }
  const data = await apiFetch('/api/teachers', { method: 'POST', json: payload });
  return { teacher: normalizeTeacher(data.teacher) };
}

export async function updateTeacher(id, payload) {
  if (useMock()) {
    const idx = mockTeachers.findIndex((t) => String(t.id) === String(id));
    if (idx === -1) throw Object.assign(new Error('Teacher not found'), { status: 404 });
    const conflict = mockTeachers.some(
      (t, i) =>
        i !== idx &&
        ((payload.employeeId && t.employeeId === payload.employeeId) ||
          (payload.email && t.email === payload.email))
    );
    if (conflict) {
      throw Object.assign(new Error('Employee ID or email already exists'), { status: 409 });
    }
    const next = normalizeTeacher({ ...mockTeachers[idx], ...payload, id });
    mockTeachers = mockTeachers.map((t, i) => (i === idx ? next : t));
    return { teacher: next };
  }
  const data = await apiFetch(`/api/teachers/${id}`, { method: 'PUT', json: payload });
  return { teacher: normalizeTeacher(data.teacher) };
}

export async function deleteTeacher(id) {
  if (useMock()) {
    const before = mockTeachers.length;
    mockTeachers = mockTeachers.filter((t) => String(t.id) !== String(id));
    if (mockTeachers.length === before) {
      throw Object.assign(new Error('Teacher not found'), { status: 404 });
    }
    return { ok: true };
  }
  return apiFetch(`/api/teachers/${id}`, { method: 'DELETE' });
}
