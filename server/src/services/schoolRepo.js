import { prisma } from '../lib/prisma.js';
import { DEFAULT_PERIOD_COUNT, fullName, newId, toDateString } from '../lib/ids.js';
import { compareClassNames } from '../lib/schoolGrades.js';

/** API sectionId maps to Class_Section_id. */
export async function findClassSectionById(classSectionId) {
  return prisma.tblClass_Section.findUnique({
    where: { Class_Section_id: classSectionId },
    include: {
      tblClass: true,
      tblSection: true,
    },
  });
}

export async function findClassSectionByNames(className, sectionName) {
  const klass = await prisma.tblClass.findFirst({
    where: { Class_Name: className },
  });
  if (!klass) return null;
  const section = await prisma.tblSection.findFirst({
    where: { Section_Name: sectionName },
  });
  if (!section) return null;
  return prisma.tblClass_Section.findFirst({
    where: {
      Class_id: klass.Class_id,
      Section_id: section.Section_id,
      int_status: 1,
    },
    include: { tblClass: true, tblSection: true },
  });
}

export function serializeClassSection(cs) {
  if (!cs) return null;
  return {
    id: cs.Class_Section_id,
    name: cs.tblSection?.Section_Name || '',
    periodCount: DEFAULT_PERIOD_COUNT,
    class: {
      id: cs.tblClass?.Class_id || '',
      name: cs.tblClass?.Class_Name || '',
    },
  };
}

function addressOf(student) {
  return [student.Address_Line_1, student.Address_Line_2, student.City, student.State]
    .filter(Boolean)
    .join(', ') || null;
}

/** Enrollment row for roster — studentId in API = student_class_id. */
export function serializeEnrollment(sc, classSection, studentOverride = null) {
  const st = studentOverride || sc.tblStudents;
  const roll = Number.parseInt(sc.Roll_No || st?.Roll_No || '0', 10) || 0;
  const status = sc.Int_Status === 0 || st?.Int_Status === 0 ? 'Inactive' : 'Active';
  return {
    id: sc.student_class_id,
    studentRecordId: st?.Student_id || sc.Student_id,
    rollNo: roll,
    name: fullName(st?.First_Name, st?.Last_Name) || 'Unknown',
    parentPhone: st?.Father_Number || st?.Mother_Number || st?.Guardian_Number || null,
    admissionNo: st?.Admission_No ?? null,
    dob: toDateString(st?.DOB),
    gender: st?.Gender ?? null,
    address: st ? addressOf(st) : null,
    bloodGroup: null,
    nationality: st?.Country || 'Indian',
    motherName: st?.Mother_Name ?? null,
    fatherName: st?.Father_Name ?? null,
    status,
    sectionId: sc.class_section_id,
    section: classSection ? serializeClassSection(classSection) : undefined,
  };
}

export async function listEnrollmentsForSection(classSectionId) {
  const rows = await prisma.tblStudent_Class.findMany({
    where: {
      class_section_id: classSectionId,
      Int_Status: { not: 0 },
    },
    include: { tblStudents: true },
  });

  return rows
    .map((sc) => serializeEnrollment(sc))
    .sort((a, b) => a.rollNo - b.rollNo || a.name.localeCompare(b.name));
}

export async function countActiveEnrollments(classSectionId) {
  return prisma.tblStudent_Class.count({
    where: { class_section_id: classSectionId, Int_Status: { not: 0 } },
  });
}

export async function listClassesWithSections() {
  const classes = await prisma.tblClass.findMany({
    include: {
      tblClass_Section: {
        where: { int_status: 1 },
        include: { tblSection: true },
      },
    },
  });

  const out = [];
  for (const c of classes) {
    const sections = [];
    for (const cs of c.tblClass_Section) {
      const studentCount = await countActiveEnrollments(cs.Class_Section_id);
      sections.push({
        id: cs.Class_Section_id,
        name: cs.tblSection?.Section_Name || '',
        periodCount: DEFAULT_PERIOD_COUNT,
        studentCount,
      });
    }
    sections.sort((a, b) => a.name.localeCompare(b.name));
    out.push({
      id: c.Class_id,
      name: c.Class_Name,
      sections,
    });
  }
  out.sort((a, b) => compareClassNames(a.name, b.name));
  return out;
}

/** Roles that can see / manage every class-section. */
export const FULL_ACCESS_ROLES = new Set([
  'INCHARGE',
  'ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'HEADMASTER',
  'HOD',
]);

export function hasFullClassAccess(role) {
  return FULL_ACCESS_ROLES.has(String(role || '').toUpperCase());
}

/** Active class_section ids assigned to a teacher via tblTeacher_Class. */
export async function listAssignedSectionIds(userId) {
  if (!userId) return [];
  const links = await prisma.tblTeacher_Class.findMany({
    where: { user_id: userId, Int_Status: { not: 0 } },
    select: { class_section_id: true },
  });
  return [...new Set(links.map((l) => l.class_section_id).filter(Boolean))];
}

/**
 * Classes tree for the signed-in user.
 * Teachers only get sections in tblTeacher_Class; in-charge / head roles get all.
 */
export async function listClassesForUser(userId, role) {
  const all = await listClassesWithSections();
  if (hasFullClassAccess(role)) return all;

  const allowed = new Set(await listAssignedSectionIds(userId));
  if (!allowed.size) return [];

  return all
    .map((klass) => ({
      ...klass,
      sections: (klass.sections || []).filter((s) => allowed.has(s.id)),
    }))
    .filter((klass) => klass.sections.length > 0);
}

/** Whether the user may access this class-section. */
export async function canAccessSection(userId, role, classSectionId) {
  if (!classSectionId) return false;
  const r = String(role || '').toUpperCase();
  if (r === 'PARENT') return false;
  if (hasFullClassAccess(role)) return true;
  const allowed = await listAssignedSectionIds(userId);
  return allowed.includes(String(classSectionId));
}

export function isParentRole(role) {
  return String(role || '').toUpperCase() === 'PARENT';
}

export function isStaffRole(role) {
  const r = String(role || '').toUpperCase();
  return Boolean(r) && r !== 'PARENT';
}

/** Active enrollments for students linked to a parent user. */
export async function listChildrenForParent(userId) {
  const links = await prisma.tblParent_Student.findMany({
    where: { user_id: userId, Int_Status: { not: 0 } },
    include: {
      tblStudents: {
        include: {
          tblStudent_Class: {
            where: { Int_Status: { not: 0 } },
            include: {
              tblClass_Section: {
                include: { tblClass: true, tblSection: true },
              },
            },
          },
        },
      },
    },
  });

  const children = [];
  for (const link of links) {
    const st = link.tblStudents;
    if (!st || st.Int_Status === 0) continue;
    for (const sc of st.tblStudent_Class || []) {
      // Nested include does not attach sc.tblStudents — pass `st` explicitly.
      children.push({
        ...serializeEnrollment(sc, sc.tblClass_Section, st),
        fatherName: st.Father_Name ?? null,
        motherName: st.Mother_Name ?? null,
        fatherPhone: st.Father_Number ?? null,
        motherPhone: st.Mother_Number ?? null,
        guardianName: st.Guardian_Name ?? null,
        guardianPhone: st.Guardian_Number ?? null,
        addressLine1: st.Address_Line_1 ?? null,
        addressLine2: st.Address_Line_2 ?? null,
        city: st.City ?? null,
        state: st.State ?? null,
        pinCode: st.Pin_Code ?? null,
      });
    }
  }
  return children.sort((a, b) => a.name.localeCompare(b.name));
}

export async function parentAudienceScope(userId) {
  const children = await listChildrenForParent(userId);
  const studentClassIds = [...new Set(children.map((c) => c.id).filter(Boolean))];
  const classSectionIds = [...new Set(children.map((c) => c.sectionId).filter(Boolean))];
  return { children, studentClassIds, classSectionIds };
}

export async function assertEnrollmentsInSection(classSectionId, studentClassIds) {
  const count = await prisma.tblStudent_Class.count({
    where: {
      class_section_id: classSectionId,
      student_class_id: { in: studentClassIds },
    },
  });
  return count === new Set(studentClassIds).size;
}

export function mapRoleToApp(roleId, roleName) {
  const raw = String(roleName || roleId || 'INCHARGE').toUpperCase();
  if (raw.includes('PARENT')) return 'PARENT';
  if (raw.includes('ADMIN')) return 'ADMIN';
  if (raw.includes('PRINCIPAL') && !raw.includes('VICE')) return 'PRINCIPAL';
  if (raw.includes('VICE') && raw.includes('PRINCIPAL')) return 'VICE_PRINCIPAL';
  if (raw.includes('HEADMASTER') || raw.includes('HEAD MASTER')) return 'HEADMASTER';
  if (raw.includes('HOD') || raw.includes('HEAD OF')) return 'HOD';
  if (raw.includes('TEACHER')) return 'TEACHER';
  if (raw.includes('INCHARGE') || raw.includes('IN-CHARGE') || raw.includes('ATTENDANCE')) {
    return 'INCHARGE';
  }
  return 'INCHARGE';
}

/**
 * Parse "1-A, 2-B, UKG-A" style text into { className, sectionName } pairs.
 * Last hyphen/en-dash segment is the section; the rest is the class name.
 */
export function parseClassSectionLabels(text) {
  if (!text || !String(text).trim()) return [];
  const out = [];
  for (const part of String(text).split(/[,;/|]+/)) {
    const raw = part.trim().replace(/^class\s+/i, '');
    if (!raw) continue;
    const m = raw.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (!m) continue;
    const className = m[1].trim();
    const sectionName = m[2].trim();
    if (className && sectionName) out.push({ className, sectionName });
  }
  return out;
}

/**
 * Replace a teacher's tblTeacher_Class links from a "1-A, 2-B" assignment string.
 * Empty/null clears all active links (soft-deactivate).
 */
export async function syncTeacherClassAssignments(userId, classesAssignedText) {
  if (!userId) return [];
  const labels = parseClassSectionLabels(classesAssignedText);
  const wantedIds = [];

  for (const { className, sectionName } of labels) {
    const section = await findClassSectionByNames(className, sectionName);
    if (!section) continue;
    wantedIds.push(section.Class_Section_id);
  }

  const existing = await prisma.tblTeacher_Class.findMany({
    where: { user_id: userId },
  });
  const bySection = new Map(existing.map((row) => [row.class_section_id, row]));
  const wanted = new Set(wantedIds);

  for (const sectionId of wanted) {
    const row = bySection.get(sectionId);
    if (row) {
      if (row.Int_Status === 0) {
        await prisma.tblTeacher_Class.update({
          where: { teacher_class_id: row.teacher_class_id },
          data: { Int_Status: 1 },
        });
      }
    } else {
      await prisma.tblTeacher_Class.create({
        data: {
          teacher_class_id: newId('TC-'),
          user_id: userId,
          class_section_id: sectionId,
          Int_Status: 1,
        },
      });
    }
  }

  for (const row of existing) {
    if (!wanted.has(row.class_section_id) && row.Int_Status !== 0) {
      await prisma.tblTeacher_Class.update({
        where: { teacher_class_id: row.teacher_class_id },
        data: { Int_Status: 0 },
      });
    }
  }

  return [...wanted];
}

export function serializeUser(user) {
  const role = mapRoleToApp(user.role_id, user.tblRoles?.Text);
  return {
    id: user.user_id,
    email: user.email,
    name: user.name,
    role,
  };
}

/** Holiday type stored in Description as "type:name leftover" or plain description. */
export function holidayTypeFromDescription(description) {
  if (!description) return 'govt';
  const m = String(description).match(/^(govt|sudden|weekly)(?:\||$)/i);
  return m ? m[1].toLowerCase() : 'govt';
}

export function holidayDescriptionFor(type, description) {
  const rest = description && !/^(govt|sudden|weekly)/i.test(description) ? description : '';
  return rest ? `${type}|${rest}` : type;
}
