import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { newId, parseDateOnly, splitFullName } from '../lib/ids.js';
import {
  canAccessSection,
  findClassSectionById,
  findClassSectionByNames,
  listEnrollmentsForSection,
  serializeClassSection,
  serializeEnrollment,
} from '../services/schoolRepo.js';

const router = Router();

async function forbidUnlessSectionAccess(req, res, classSectionId) {
  const ok = await canAccessSection(req.user?.sub, req.user?.role, classSectionId);
  if (!ok) {
    res.status(403).json({
      error: 'You do not have access to this class. Contact the attendance in-charge.',
      code: 'SECTION_FORBIDDEN',
    });
    return false;
  }
  return true;
}

const querySchema = z
  .object({
    class: z.string().optional(),
    section: z.string().optional(),
    sectionId: z.string().optional(),
  })
  .refine((q) => q.sectionId || (q.class && q.section), {
    message: 'Provide sectionId, or both class and section',
  });

const genderEnum = z.enum(['Male', 'Female', 'Other']);
const statusEnum = z.enum(['Active', 'Inactive']);

const createSchema = z
  .object({
    sectionId: z.string().min(1).optional(),
    class: z.string().optional(),
    section: z.string().optional(),
    rollNo: z.coerce.number().int().positive(),
    name: z.string().min(1),
    parentPhone: z.string().optional().nullable(),
    admissionNo: z.string().optional().nullable(),
    dob: z.string().optional().nullable(),
    gender: genderEnum.optional().nullable(),
    address: z.string().optional().nullable(),
    bloodGroup: z.string().optional().nullable(),
    nationality: z.string().optional().nullable(),
    motherName: z.string().optional().nullable(),
    fatherName: z.string().optional().nullable(),
    status: statusEnum.optional(),
  })
  .refine((b) => b.sectionId || (b.class && b.section), {
    message: 'Provide sectionId, or both class and section',
  });

const updateSchema = z.object({
  sectionId: z.string().min(1).optional(),
  rollNo: z.coerce.number().int().positive().optional(),
  name: z.string().min(1).optional(),
  parentPhone: z.string().optional().nullable(),
  admissionNo: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: genderEnum.optional().nullable(),
  address: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  fatherName: z.string().optional().nullable(),
  status: statusEnum.optional(),
});

async function resolveSection({ sectionId, class: className, section: sectionName }) {
  if (sectionId) return findClassSectionById(sectionId);
  return findClassSectionByNames(className, sectionName);
}

router.get('/', requireAuth, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const section = await resolveSection(parsed.data);
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

  const students = await listEnrollmentsForSection(section.Class_Section_id);
  return res.json({
    section: serializeClassSection(section),
    students: students.map((s) => ({
      ...s,
      section: serializeClassSection(section),
    })),
  });
});

router.get('/:id', requireAuth, async (req, res) => {
  const enrollment = await prisma.tblStudent_Class.findUnique({
    where: { student_class_id: req.params.id },
    include: {
      tblStudents: true,
      tblClass_Section: { include: { tblClass: true, tblSection: true } },
    },
  });
  if (!enrollment) {
    return res.status(404).json({ error: 'Student not found' });
  }
  if (
    !(await forbidUnlessSectionAccess(req, res, enrollment.class_section_id))
  ) {
    return;
  }
  return res.json({
    student: serializeEnrollment(enrollment, enrollment.tblClass_Section),
  });
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const body = parsed.data;
  const section = await resolveSection(body);
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

  let dob = null;
  if (body.dob != null && body.dob !== '') {
    dob = parseDateOnly(body.dob);
    if (!dob) return res.status(400).json({ error: 'dob must be YYYY-MM-DD' });
  }

  const { first, last } = splitFullName(body.name);
  const rollStr = String(body.rollNo);

  const clash = await prisma.tblStudent_Class.findFirst({
    where: {
      class_section_id: section.Class_Section_id,
      Roll_No: rollStr,
      Int_Status: { not: 0 },
    },
  });
  if (clash) {
    return res.status(409).json({ error: 'Roll number already exists in this section' });
  }

  const Student_id = newId('STU');
  const student_class_id = newId('SC');

  await prisma.tblStudents.create({
    data: {
      Student_id,
      Admission_No: body.admissionNo?.trim() || null,
      Roll_No: rollStr,
      First_Name: first,
      Last_Name: last,
      Gender: body.gender || null,
      DOB: dob,
      Father_Name: body.fatherName?.trim() || null,
      Mother_Name: body.motherName?.trim() || null,
      Father_Number: body.parentPhone?.trim() || null,
      Address_Line_1: body.address?.trim() || null,
      Country: body.nationality?.trim() || 'Indian',
      Int_Status: body.status === 'Inactive' ? 0 : 1,
    },
  });

  const enrollment = await prisma.tblStudent_Class.create({
    data: {
      student_class_id,
      Student_id,
      class_section_id: section.Class_Section_id,
      Roll_No: rollStr,
      Academic_Year: section.tblClass?.Academic_Year || null,
      Int_Status: body.status === 'Inactive' ? 0 : 1,
    },
    include: { tblStudents: true },
  });

  return res.status(201).json({
    student: serializeEnrollment(enrollment, section),
  });
});

router.put('/:id', requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const existing = await prisma.tblStudent_Class.findUnique({
    where: { student_class_id: req.params.id },
    include: { tblStudents: true, tblClass_Section: { include: { tblClass: true, tblSection: true } } },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Student not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, existing.class_section_id))) return;

  const body = parsed.data;
  const studentData = {};
  const enrollmentData = {};

  if (body.sectionId !== undefined) {
    const target = await findClassSectionById(body.sectionId);
    if (!target) return res.status(404).json({ error: 'Section not found' });
    if (!(await forbidUnlessSectionAccess(req, res, target.Class_Section_id))) return;
    enrollmentData.class_section_id = body.sectionId;
  }

  if (body.rollNo !== undefined) {
    const rollStr = String(body.rollNo);
    const sectionId = enrollmentData.class_section_id || existing.class_section_id;
    const clash = await prisma.tblStudent_Class.findFirst({
      where: {
        class_section_id: sectionId,
        Roll_No: rollStr,
        Int_Status: { not: 0 },
        NOT: { student_class_id: existing.student_class_id },
      },
    });
    if (clash) {
      return res.status(409).json({ error: 'Roll number already exists in this section' });
    }
    enrollmentData.Roll_No = rollStr;
    studentData.Roll_No = rollStr;
  }

  if (body.name !== undefined) {
    const { first, last } = splitFullName(body.name);
    studentData.First_Name = first;
    studentData.Last_Name = last;
  }
  if (body.parentPhone !== undefined) studentData.Father_Number = body.parentPhone?.trim() || null;
  if (body.admissionNo !== undefined) studentData.Admission_No = body.admissionNo?.trim() || null;
  if (body.gender !== undefined) studentData.Gender = body.gender || null;
  if (body.address !== undefined) studentData.Address_Line_1 = body.address?.trim() || null;
  if (body.nationality !== undefined) studentData.Country = body.nationality?.trim() || null;
  if (body.motherName !== undefined) studentData.Mother_Name = body.motherName?.trim() || null;
  if (body.fatherName !== undefined) studentData.Father_Name = body.fatherName?.trim() || null;
  if (body.status !== undefined) {
    const flag = body.status === 'Inactive' ? 0 : 1;
    studentData.Int_Status = flag;
    enrollmentData.Int_Status = flag;
  }
  if (body.dob !== undefined) {
    if (body.dob == null || body.dob === '') {
      studentData.DOB = null;
    } else {
      const dob = parseDateOnly(body.dob);
      if (!dob) return res.status(400).json({ error: 'dob must be YYYY-MM-DD' });
      studentData.DOB = dob;
    }
  }

  if (Object.keys(studentData).length) {
    await prisma.tblStudents.update({
      where: { Student_id: existing.Student_id },
      data: studentData,
    });
  }
  if (Object.keys(enrollmentData).length) {
    await prisma.tblStudent_Class.update({
      where: { student_class_id: existing.student_class_id },
      data: enrollmentData,
    });
  }

  const updated = await prisma.tblStudent_Class.findUnique({
    where: { student_class_id: existing.student_class_id },
    include: {
      tblStudents: true,
      tblClass_Section: { include: { tblClass: true, tblSection: true } },
    },
  });

  return res.json({
    student: serializeEnrollment(updated, updated.tblClass_Section),
  });
});

export default router;
