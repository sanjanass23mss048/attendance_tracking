import { STUDENTS_PER_SECTION } from '../data/studentRoster.js';
import { SCHOOL_GRADES, SCHOOL_SECTIONS } from '../data/schoolGrades.js';
import { apiFetch, getStoredUser, useMock } from './api.js';

let classesCache = null;
let classesCacheAt = 0;
const CACHE_MS = 60_000;

/** Mock teacher → class-section labels (mirrors seed). */
const MOCK_TEACHER_SECTIONS = {
  'mock-neha': [{ className: '1', sectionName: 'A' }],
  'mock-rakesh': [
    { className: '2', sectionName: 'A' },
    { className: '3', sectionName: 'A' },
  ],
  'mock-priya': [{ className: 'LKG', sectionName: 'A' }],
  'mock-anil': [{ className: 'UKG', sectionName: 'A' }],
  'mock-kavita': [
    { className: '4', sectionName: 'A' },
    { className: '5', sectionName: 'A' },
  ],
  'mock-suresh': [{ className: '6', sectionName: 'A' }],
  'mock-meena': [
    { className: '7', sectionName: 'A' },
    { className: '8', sectionName: 'A' },
  ],
};

function mockClasses() {
  const all = SCHOOL_GRADES.map((name) => {
    // Class 3 gets A–D so Attendance Reports can demo four section cards
    const sections = name === '3' ? ['A', 'B', 'C', 'D'] : SCHOOL_SECTIONS;
    return {
      id: `mock-class-${name}`,
      name,
      sections: sections.map((sec) => ({
        id: `mock-section-${name}-${sec}`,
        name: sec,
        periodCount: 8,
        studentCount: STUDENTS_PER_SECTION,
      })),
    };
  });

  const user = getStoredUser();
  const role = String(user?.role || '').toUpperCase();
  const fullAccess = ['INCHARGE', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEADMASTER', 'HOD'].includes(
    role
  );
  if (!user || fullAccess) return { classes: all };

  const allowed = MOCK_TEACHER_SECTIONS[user.id] || [];
  if (!allowed.length) return { classes: [] };

  const allowedKey = new Set(allowed.map((a) => `${a.className}::${a.sectionName}`));
  return {
    classes: all
      .map((klass) => ({
        ...klass,
        sections: klass.sections.filter((s) => allowedKey.has(`${klass.name}::${s.name}`)),
      }))
      .filter((klass) => klass.sections.length > 0),
  };
}

export async function getClasses({ force = false } = {}) {
  if (useMock()) {
    return mockClasses();
  }

  if (!force && classesCache && Date.now() - classesCacheAt < CACHE_MS) {
    return classesCache;
  }

  const data = await apiFetch('/api/classes');
  classesCache = data;
  classesCacheAt = Date.now();
  return data;
}

export async function createClass({ className, sectionNames, academicYear } = {}) {
  const data = await apiFetch('/api/classes', {
    method: 'POST',
    json: {
      className,
      sectionNames,
      academicYear,
    },
  });
  clearClassesCache();
  return data;
}

export function clearClassesCache() {
  classesCache = null;
  classesCacheAt = 0;
}

/**
 * Resolve section id from class + section labels (mock-compatible).
 * @param {string} className
 * @param {string} sectionName
 */
export function mockSectionId(className, sectionName) {
  return `mock-section-${className}-${sectionName}`;
}

/**
 * Resolve section UUID (or mock id) for class + section names.
 * @param {string} className
 * @param {string} sectionName
 * @returns {Promise<string|null>}
 */
export async function resolveSectionId(className, sectionName) {
  if (useMock()) {
    return mockSectionId(className, sectionName);
  }
  const { classes } = await getClasses();
  const klass = classes.find((c) => String(c.name) === String(className));
  const section = klass?.sections?.find((s) => String(s.name) === String(sectionName));
  return section?.id ?? null;
}

/**
 * Flat list of class name options from API/mock.
 */
export async function getClassOptions() {
  const { classes } = await getClasses();
  return classes.map((c) => c.name);
}

/**
 * Section name options for a class.
 */
export async function getSectionOptions(className) {
  const { classes } = await getClasses();
  const klass = classes.find((c) => String(c.name) === String(className));
  return (klass?.sections || []).map((s) => s.name);
}
