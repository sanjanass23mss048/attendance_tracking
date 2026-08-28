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
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { sendPromotionWhatsApp } from '../lib/whatsapp.js';

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
    /** When true/1, Student Directory includes TC soft-inactive rows. */
    includeInactive: z
      .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.boolean()])
      .optional(),
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

  const rawInclude = parsed.data.includeInactive;
  const includeInactive =
    rawInclude === true || rawInclude === '1' || rawInclude === 'true';

  // Directory can pass includeInactive=1 so TC soft-inactive students appear.
  // Attendance and other clients omit it and keep the active-only default.
  const students = await listEnrollmentsForSection(section.Class_Section_id, {
    includeInactive,
  });
  return res.json({
    section: serializeClassSection(section),
    students: students.map((s) => ({
      ...s,
      section: serializeClassSection(section),
    })),
  });
});

const promotionNotifySchema = z.object({
  fromGrade: z.string().min(1),
  toGrade: z.string().min(1),
  schoolName: z.string().optional(),
  recipients: z
    .array(
      z.object({
        studentClassId: z.string().min(1),
        studentName: z.string().optional(),
      })
    )
    .min(1)
    .max(500),
});

/** Send Meta promotion_message template to parents of promoted students. */
router.post('/promotion-notify', requireAuth, async (req, res) => {
  const parsed = promotionNotifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const { fromGrade, toGrade, schoolName, recipients } = parsed.data;
  const results = [];

  for (const row of recipients) {
    const enrollment = await prisma.tblStudent_Class.findUnique({
      where: { student_class_id: row.studentClassId },
      include: {
        tblStudents: true,
        tblClass_Section: { include: { tblClass: true, tblSection: true } },
      },
    });
    if (!enrollment) {
      results.push({
        studentClassId: row.studentClassId,
        ok: false,
        skipped: false,
        error: 'Student not found',
      });
      continue;
    }
    if (!(await canAccessSection(req.user?.sub, req.user?.role, enrollment.class_section_id))) {
      results.push({
        studentClassId: row.studentClassId,
        ok: false,
        skipped: false,
        error: 'Section forbidden',
      });
      continue;
    }

    const st = enrollment.tblStudents;
    const phone =
      st?.Father_Number || st?.Mother_Number || st?.Guardian_Number || null;
    const name =
      row.studentName ||
      [st?.First_Name, st?.Last_Name].filter(Boolean).join(' ').trim() ||
      'Student';

    const send = await sendPromotionWhatsApp({
      toPhone: phone,
      studentName: name,
      fromGrade,
      toGrade,
      schoolName,
    });

    results.push({
      studentClassId: row.studentClassId,
      name,
      phone: send.to || phone || null,
      ok: Boolean(send.ok),
      skipped: Boolean(send.skipped),
      error: send.error || send.reason || null,
      messageId: send.id || null,
    });
  }

  const sent = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok && !r.skipped).length;

  try {
    logAdminAudit(req, {
      action: 'STUDENT_PROMOTION_NOTIFY',
      category: 'STUDENTS',
      entityType: 'students',
      entityId: null,
      summary: `Promotion WhatsApp: ${sent} sent, ${skipped} skipped, ${failed} failed (${fromGrade} → ${toGrade})`,
      details: { fromGrade, toGrade, sent, skipped, failed, count: recipients.length },
    });
  } catch (err) {
    console.warn('[students] promotion audit failed', err?.message || err);
  }

  return res.json({ sent, skipped, failed, results });
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

  const student = serializeEnrollment(enrollment, section);
  logAdminAudit(req, {
    action: 'STUDENT_CREATE',
    category: 'STUDENT',
    entityType: 'student_class',
    entityId: student_class_id,
    summary: `Created student ${body.name} (roll ${rollStr}) in ${section.Class_Section_id}`,
    details: {
      studentId: Student_id,
      rollNo: rollStr,
      sectionId: section.Class_Section_id,
      admissionNo: body.admissionNo || null,
    },
  });

  return res.status(201).json({ student });
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

  const student = serializeEnrollment(updated, updated.tblClass_Section);
  logAdminAudit(req, {
    action: 'STUDENT_UPDATE',
    category: 'STUDENT',
    entityType: 'student_class',
    entityId: existing.student_class_id,
    summary: `Updated student ${student?.name || existing.Student_id} (${existing.student_class_id})`,
    details: {
      fields: Object.keys({ ...studentData, ...enrollmentData }),
      sectionId: updated.class_section_id,
    },
  });

  return res.json({ student });
});

export default router;
