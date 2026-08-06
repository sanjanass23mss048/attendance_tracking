import {
  generateSectionRoster,
  mockStudentId,
  dbStudentIds,
  studentDemoProfile,
} from '../data/studentRoster.js';
import { apiFetch, useMock } from './api.js';
import { mockSectionId } from './classService.js';

/** In-memory mock store for create/update when VITE_USE_MOCK is not false. */
const mockStore = new Map();

function ensureMockSection(sectionId) {
  if (mockStore.has(sectionId)) return mockStore.get(sectionId);
  const match = sectionId.match(/^mock-section-(.+)-(.+)$/);
  const className = match?.[1] || '1';
  const sectionName = match?.[2] || 'A';
  const list = generateSectionRoster(className, sectionName).map((s) => {
    const ids = dbStudentIds(className, sectionName, s.rollNo);
    return normalizeStudent({
      id: mockStudentId(sectionId, className, sectionName, s.rollNo),
      studentRecordId: ids.studentId,
      rollNo: s.rollNo,
      name: s.name,
      sectionId,
      ...studentDemoProfile(className, sectionName, s.rollNo, s.name),
    });
  });
  mockStore.set(sectionId, list);
  return list;
}

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/** Normalize API/mock students for UI components that expect `roll`. */
export function normalizeStudent(s) {
  const classSection = s.sectionId?.match(/^CS-(\d+)-([A-Z])$/i);
  const derivedRecordId =
    s.studentRecordId ||
    s.studentId ||
    (classSection ? `STU-${classSection[1]}${classSection[2]}-${s.rollNo ?? s.roll}` : null);

  return {
    id: String(s.id),
    studentRecordId: derivedRecordId,
    name: s.name,
    roll: s.roll ?? s.rollNo,
    rollNo: s.rollNo ?? s.roll,
    parentPhone: s.parentPhone ?? null,
    sectionId: s.sectionId ?? null,
    admissionNo: s.admissionNo ?? null,
    dob: toDateOnly(s.dob),
    gender: s.gender ?? null,
    address: s.address ?? null,
    bloodGroup: s.bloodGroup ?? null,
    nationality: s.nationality ?? 'Indian',
    motherName: s.motherName ?? null,
    fatherName: s.fatherName ?? null,
    status: s.status || 'Active',
    section: s.section ?? null,
  };
}

/**
 * @param {{ class?: string, section?: string, sectionId?: string }} query
 */
export async function getStudents(query = {}) {
  if (useMock()) {
    const sectionId =
      query.sectionId ||
      mockSectionId(query.class || '1', query.section || 'A');
    const [, , className, sectionName] = sectionId.match(/^mock-section-(.+)-(.+)$/) || [];
    return {
      section: {
        id: sectionId,
        name: sectionName || query.section || 'A',
        periodCount: 8,
        class: {
          id: `mock-class-${className || query.class || '1'}`,
          name: className || query.class || '1',
        },
      },
      students: ensureMockSection(sectionId).map(normalizeStudent),
    };
  }

  const params = new URLSearchParams();
  if (query.sectionId) params.set('sectionId', query.sectionId);
  if (query.class) params.set('class', query.class);
  if (query.section) params.set('section', query.section);
  const data = await apiFetch(`/api/students?${params.toString()}`);
  return {
    ...data,
    students: (data.students || []).map(normalizeStudent),
  };
}

export async function getStudent(id) {
  if (useMock()) {
    for (const list of mockStore.values()) {
      const found = list.find((s) => String(s.id) === String(id));
      if (found) return { student: normalizeStudent(found) };
    }
    // Lazy-load Class 1-A if store empty
    ensureMockSection(mockSectionId('1', 'A'));
    for (const list of mockStore.values()) {
      const found = list.find((s) => String(s.id) === String(id));
      if (found) return { student: normalizeStudent(found) };
    }
    throw Object.assign(new Error('Student not found'), { status: 404 });
  }
  const data = await apiFetch(`/api/students/${id}`);
  return { student: normalizeStudent(data.student) };
}

/**
 * @param {object} payload
 */
export async function createStudent(payload) {
  if (useMock()) {
    const sectionId =
      payload.sectionId ||
      mockSectionId(payload.class || '1', payload.section || 'A');
    const list = ensureMockSection(sectionId);
    if (list.some((s) => Number(s.rollNo) === Number(payload.rollNo))) {
      throw Object.assign(new Error('Roll number already exists in this section'), {
        status: 409,
      });
    }
    const student = normalizeStudent({
      id: `mock-new-${Date.now()}`,
      sectionId,
      ...payload,
      status: payload.status || 'Active',
      nationality: payload.nationality || 'Indian',
    });
    list.push(student);
    list.sort((a, b) => Number(a.rollNo) - Number(b.rollNo));
    return { student };
  }
  const data = await apiFetch('/api/students', { method: 'POST', json: payload });
  return { student: normalizeStudent(data.student) };
}

/**
 * @param {string} id
 * @param {object} payload
 */
export async function updateStudent(id, payload) {
  if (useMock()) {
    for (const list of mockStore.values()) {
      const idx = list.findIndex((s) => String(s.id) === String(id));
      if (idx === -1) continue;
      const next = normalizeStudent({ ...list[idx], ...payload, id });
      list[idx] = next;
      list.sort((a, b) => Number(a.rollNo) - Number(b.rollNo));
      return { student: next };
    }
    throw Object.assign(new Error('Student not found'), { status: 404 });
  }
  const data = await apiFetch(`/api/students/${id}`, { method: 'PUT', json: payload });
  return { student: normalizeStudent(data.student) };
}
