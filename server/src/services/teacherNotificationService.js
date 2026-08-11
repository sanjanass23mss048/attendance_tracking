import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { newId, fullName } from '../lib/ids.js';
import {
  canAccessSection,
  hasFullClassAccess,
  listClassesForUser,
  listEnrollmentsForSection,
} from './schoolRepo.js';
import { classSortRank } from '../lib/schoolGrades.js';
import { saveFile, storageKeyFor } from '../lib/storage.js';

export const RECIPIENT_TYPES = {
  ENTIRE_CLASS: 'ENTIRE_CLASS',
  CLASS_GROUP: 'CLASS_GROUP',
  SPECIFIC_STUDENTS: 'SPECIFIC_STUDENTS',
  INDIVIDUAL: 'INDIVIDUAL',
  ALL_STUDENTS: 'ALL_STUDENTS',
};

export const NOTIF_STATUSES = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  FAILED: 'FAILED',
};

export const CATEGORIES = [
  'General',
  'Homework',
  'Classwork',
  'Exam',
  'Event',
  'Holiday',
  'Important Notice',
  'Reminder',
];

export const CLASS_GROUPS = [
  {
    id: 'preprimary',
    label: 'LKG – UKG',
    match: (name) => ['LKG', 'UKG'].includes(String(name).toUpperCase()),
  },
  {
    id: '1-5',
    label: 'Classes 1–5',
    match: (name) => {
      const n = Number(String(name).replace(/^class\s+/i, ''));
      return Number.isFinite(n) && n >= 1 && n <= 5;
    },
  },
  {
    id: '1-9',
    label: 'Classes 1–9',
    match: (name) => {
      const n = Number(String(name).replace(/^class\s+/i, ''));
      return Number.isFinite(n) && n >= 1 && n <= 9;
    },
  },
  {
    id: '6-9',
    label: 'Classes 6–9',
    match: (name) => {
      const n = Number(String(name).replace(/^class\s+/i, ''));
      return Number.isFinite(n) && n >= 6 && n <= 9;
    },
  },
  {
    id: '10-12',
    label: 'Classes 10–12',
    match: (name) => {
      const n = Number(String(name).replace(/^class\s+/i, ''));
      return Number.isFinite(n) && n >= 10 && n <= 12;
    },
  },
];

const payloadSchema = z.object({
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(500),
  category: z.string().optional().nullable(),
  recipientType: z.enum([
    'ENTIRE_CLASS',
    'CLASS_GROUP',
    'SPECIFIC_STUDENTS',
    'INDIVIDUAL',
    'ALL_STUDENTS',
  ]),
  sectionIds: z.array(z.string()).optional().default([]),
  studentIds: z.array(z.string()).optional().default([]),
  groupId: z.string().optional().nullable(),
  delivery: z.enum(['now', 'later']).default('now'),
  scheduledAt: z.string().optional().nullable(),
  asDraft: z.boolean().optional().default(false),
});

function serializeNotification(row) {
  if (!row) return null;
  return {
    id: row.notification_id,
    title: row.title,
    message: row.message,
    category: row.category,
    recipientType: row.recipient_type,
    recipientSummary: row.recipient_summary,
    recipientCount: row.recipient_count,
    status: row.status,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    attachment: row.attachment_name
      ? {
          name: row.attachment_name,
          size: row.attachment_size,
          mime: row.attachment_mime,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertSectionsAllowed(userId, role, sectionIds) {
  for (const sid of sectionIds) {
    const ok = await canAccessSection(userId, role, sid);
    if (!ok) {
      const err = new Error('You do not have access to one or more selected classes.');
      err.status = 403;
      throw err;
    }
  }
}

async function enrollmentsForSections(sectionIds) {
  const all = [];
  for (const sid of sectionIds) {
    const list = await listEnrollmentsForSection(sid);
    for (const s of list) {
      all.push({ ...s, sectionId: sid });
    }
  }
  // unique by enrollment id
  const map = new Map();
  for (const s of all) map.set(s.id, s);
  return [...map.values()];
}

function formatClassLabel(className, sectionName) {
  const c = String(className || '').trim();
  const s = String(sectionName || '').trim();
  if (!c) return s || 'Class';
  const upper = c.toUpperCase();
  const classPart = upper === 'LKG' || upper === 'UKG' || /^class\s+/i.test(c) ? c : `Class ${c}`;
  return s ? `${classPart}-${s}` : classPart;
}

/**
 * Resolve recipient students for a compose payload.
 */
export async function resolveRecipients(userId, role, body) {
  const classes = await listClassesForUser(userId, role);
  const sectionMeta = new Map();
  for (const klass of classes) {
    for (const sec of klass.sections || []) {
      sectionMeta.set(sec.id, {
        sectionId: sec.id,
        className: klass.name,
        sectionName: sec.name,
        label: formatClassLabel(klass.name, sec.name),
      });
    }
  }

  let sectionIds = [...(body.sectionIds || [])];
  let studentIds = [...(body.studentIds || [])];

  if (body.recipientType === RECIPIENT_TYPES.ALL_STUDENTS) {
    sectionIds = [...sectionMeta.keys()];
    studentIds = [];
  } else if (body.recipientType === RECIPIENT_TYPES.CLASS_GROUP) {
    // Prefined group OR manual class/section pick under Class Group
    if (body.groupId) {
      const group = CLASS_GROUPS.find((g) => g.id === body.groupId);
      if (!group) {
        const err = new Error('Invalid class group');
        err.status = 400;
        throw err;
      }
      sectionIds = [];
      for (const klass of classes) {
        if (!group.match(klass.name)) continue;
        for (const sec of klass.sections || []) sectionIds.push(sec.id);
      }
      studentIds = [];
    } else if (sectionIds.length) {
      studentIds = [];
    } else {
      const err = new Error('Select a class group or choose classes manually');
      err.status = 400;
      throw err;
    }
  } else if (body.recipientType === RECIPIENT_TYPES.ENTIRE_CLASS) {
    if (!sectionIds.length) {
      const err = new Error('Select at least one class');
      err.status = 400;
      throw err;
    }
    studentIds = [];
  } else if (body.recipientType === RECIPIENT_TYPES.SPECIFIC_STUDENTS) {
    if (!studentIds.length) {
      const err = new Error('Select at least one student');
      err.status = 400;
      throw err;
    }
  } else if (body.recipientType === RECIPIENT_TYPES.INDIVIDUAL) {
    if (studentIds.length !== 1) {
      const err = new Error('Select exactly one student');
      err.status = 400;
      throw err;
    }
  }

  await assertSectionsAllowed(userId, role, sectionIds);

  let students = [];
  if (
    body.recipientType === RECIPIENT_TYPES.SPECIFIC_STUDENTS ||
    body.recipientType === RECIPIENT_TYPES.INDIVIDUAL
  ) {
    // Load by enrollment ids, verify section access
    const rows = await prisma.tblStudent_Class.findMany({
      where: {
        student_class_id: { in: studentIds },
        Int_Status: { not: 0 },
      },
      include: {
        tblStudents: true,
        tblClass_Section: { include: { tblClass: true, tblSection: true } },
      },
    });
    for (const sc of rows) {
      const ok = await canAccessSection(userId, role, sc.class_section_id);
      if (!ok) {
        const err = new Error('You do not have access to one or more selected students.');
        err.status = 403;
        throw err;
      }
      const st = sc.tblStudents;
      students.push({
        id: sc.student_class_id,
        studentRecordId: sc.Student_id,
        rollNo: Number.parseInt(sc.Roll_No || '0', 10) || 0,
        name: fullName(st?.First_Name, st?.Last_Name) || 'Student',
        parentPhone: st?.Father_Number || st?.Mother_Number || st?.Guardian_Number || null,
        sectionId: sc.class_section_id,
        className: sc.tblClass_Section?.tblClass?.Class_Name || '',
        sectionName: sc.tblClass_Section?.tblSection?.Section_Name || '',
        label: formatClassLabel(
          sc.tblClass_Section?.tblClass?.Class_Name,
          sc.tblClass_Section?.tblSection?.Section_Name
        ),
      });
    }
  } else {
    students = await enrollmentsForSections(sectionIds);
    students = students.map((s) => {
      const meta = sectionMeta.get(s.sectionId) || {};
      return {
        ...s,
        className: meta.className || s.section?.class?.name || '',
        sectionName: meta.sectionName || s.section?.name || '',
        label: meta.label || formatClassLabel(meta.className, meta.sectionName),
      };
    });
  }

  students.sort(
    (a, b) =>
      classSortRank(a.className) - classSortRank(b.className) ||
      String(a.sectionName).localeCompare(String(b.sectionName)) ||
      a.rollNo - b.rollNo
  );

  const summary = buildRecipientSummary(body.recipientType, students, body.groupId);
  return { students, summary, sectionIds };
}

function buildRecipientSummary(type, students, groupId) {
  const count = students.length;
  if (!count) return 'No recipients';
  if (type === RECIPIENT_TYPES.INDIVIDUAL) {
    const s = students[0];
    return `Recipient: ${s.name} – ${s.label} – Roll No. ${s.rollNo}`;
  }
  if (type === RECIPIENT_TYPES.ALL_STUDENTS) {
    return `Recipients: ${count} students (all accessible classes)`;
  }
  if (type === RECIPIENT_TYPES.CLASS_GROUP) {
    const g = CLASS_GROUPS.find((x) => x.id === groupId);
    if (g) return `Recipients: ${count} students from ${g.label}`;
    const labels = [...new Set(students.map((s) => s.label).filter(Boolean))];
    if (labels.length === 1) {
      return `Recipients: ${count} student${count === 1 ? '' : 's'} from ${labels[0]}`;
    }
    return `Recipients: ${count} students from ${labels.length} selected classes`;
  }
  const labels = [...new Set(students.map((s) => s.label).filter(Boolean))];
  if (labels.length === 1) {
    return `Recipients: ${count} student${count === 1 ? '' : 's'} from ${labels[0]}`;
  }
  return `Recipients: ${count} students across ${labels.length} classes`;
}

export async function listComposerOptions(userId, role) {
  const classes = await listClassesForUser(userId, role);
  const groups = CLASS_GROUPS.map((g) => {
    const matching = classes.filter((c) => g.match(c.name));
    const sectionCount = matching.reduce((n, c) => n + (c.sections?.length || 0), 0);
    return {
      id: g.id,
      label: g.label,
      available: sectionCount > 0,
      classCount: matching.length,
      sectionCount,
    };
  }).filter((g) => g.available);

  return {
    classes,
    groups,
    canSendAllStudents: classes.length > 0,
    allStudentsIsSchoolWide: hasFullClassAccess(role),
    categories: CATEGORIES,
  };
}

export async function saveTeacherNotification({
  userId,
  role,
  body,
  file,
}) {
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    const err = new Error('Invalid notification details');
    err.status = 400;
    err.details = parsed.error.flatten();
    throw err;
  }
  const data = parsed.data;
  if (data.category && !CATEGORIES.includes(data.category)) {
    const err = new Error('Invalid notification category');
    err.status = 400;
    throw err;
  }

  const { students, summary } = await resolveRecipients(userId, role, data);
  if (!data.asDraft && !students.length) {
    const err = new Error('No students match the selected recipients');
    err.status = 400;
    throw err;
  }

  let status = NOTIF_STATUSES.DRAFT;
  let scheduledAt = null;
  if (!data.asDraft) {
    if (data.delivery === 'later') {
      if (!data.scheduledAt) {
        const err = new Error('Choose a date and time to schedule');
        err.status = 400;
        throw err;
      }
      scheduledAt = new Date(data.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        const err = new Error('Schedule time must be in the future');
        err.status = 400;
        throw err;
      }
      status = NOTIF_STATUSES.SCHEDULED;
    } else {
      status = NOTIF_STATUSES.SENT;
    }
  }

  const notificationId = newId('TN');
  let attachment = {
    attachment_name: null,
    attachment_key: null,
    attachment_mime: null,
    attachment_size: null,
  };
  if (file) {
    const docId = newId('TNA');
    const key = storageKeyFor('teacher_notification', notificationId, docId, file.originalname);
    await saveFile(key, file.buffer);
    attachment = {
      attachment_name: file.originalname.slice(0, 255),
      attachment_key: key,
      attachment_mime: file.mimetype || null,
      attachment_size: file.size || file.buffer?.length || null,
    };
  }

  await prisma.tblTeacher_Notifications.create({
    data: {
      notification_id: notificationId,
      created_by: userId,
      title: data.title,
      message: data.message,
      category: data.category || 'General',
      recipient_type: data.recipientType,
      recipient_payload: JSON.stringify({
        sectionIds: data.sectionIds,
        studentIds: data.studentIds,
        groupId: data.groupId,
      }),
      recipient_summary: summary,
      recipient_count: students.length,
      status,
      scheduled_at: scheduledAt,
      sent_at: status === NOTIF_STATUSES.SENT ? new Date() : null,
      ...attachment,
    },
  });

  if (students.length) {
    await prisma.tblTeacher_Notification_Recipients.createMany({
      data: students.map((s) => ({
        id: newId('TNR'),
        notification_id: notificationId,
        student_class_id: s.id,
        student_id: s.studentRecordId || null,
        delivery_status: status === NOTIF_STATUSES.SENT ? 'QUEUED' : 'PENDING',
      })),
    });
  }

  if (status === NOTIF_STATUSES.SENT) {
    // Notice Board + FCM only — do not SMS. MSG91 is an attendance-absence
    // DLT template and would send blank "Your ward is absent" texts.
    try {
      const mirrored = await publishToParentNoticeBoard({
        userId,
        role,
        data,
        students,
        attachmentName: attachment.attachment_name,
        attachmentKey: attachment.attachment_key,
      });
      if (mirrored?.id) {
        console.log(`Teacher notification ${notificationId} → parent notice ${mirrored.id}`);
      }
      if (students.length) {
        await prisma.tblTeacher_Notification_Recipients.updateMany({
          where: { notification_id: notificationId },
          data: { delivery_status: 'NOTICE_BOARD' },
        });
      }
    } catch (err) {
      console.warn('Parent notice board mirror / push failed', err?.message || err);
    }
  }

  const row = await prisma.tblTeacher_Notifications.findUnique({
    where: { notification_id: notificationId },
  });
  return {
    notification: serializeNotification(row),
    preview: {
      title: data.title,
      message: data.message,
      category: data.category || 'General',
      recipientSummary: summary,
      recipientCount: students.length,
      students: students.slice(0, 20).map((s) => ({
        id: s.id,
        name: s.name,
        rollNo: s.rollNo,
        label: s.label,
      })),
    },
  };
}

/**
 * Mirror a sent teacher notification into tblNotices so the parent Flutter
 * Notice Board + push (FCM / Socket.IO) pick it up.
 */
async function publishToParentNoticeBoard({
  userId,
  role,
  data,
  students,
  attachmentName,
  attachmentKey,
}) {
  const { createNotice } = await import('./noticeRepo.js');
  const { notifyParentsOfNotice } = await import('./parentNotify.js');

  let audienceType = 'STUDENTS';
  let classSectionIds = [];
  let studentClassIds = [];

  if (data.recipientType === RECIPIENT_TYPES.ALL_STUDENTS && hasFullClassAccess(role)) {
    audienceType = 'ALL';
  } else if (
    data.recipientType === RECIPIENT_TYPES.SPECIFIC_STUDENTS ||
    data.recipientType === RECIPIENT_TYPES.INDIVIDUAL
  ) {
    audienceType = 'STUDENTS';
    studentClassIds = [...new Set(students.map((s) => s.id).filter(Boolean))];
  } else {
    // ENTIRE_CLASS / CLASS_GROUP / scoped ALL_STUDENTS
    classSectionIds = [
      ...new Set(
        [
          ...(data.sectionIds || []),
          ...students.map((s) => s.sectionId).filter(Boolean),
        ].filter(Boolean)
      ),
    ];
    audienceType = classSectionIds.length === 1 ? 'CLASS' : 'CLASSES';
  }

  if (audienceType !== 'ALL' && !classSectionIds.length && !studentClassIds.length) {
    return null;
  }

  const titleParts = [data.category, data.title].filter(Boolean);
  const notice = await createNotice({
    title: titleParts.join(' · ') || data.title,
    body: data.message,
    audienceType,
    classSectionIds,
    studentClassIds,
    attachmentName: attachmentName || null,
    // Storage key — parents download via GET /api/parent/notices/:id/attachment
    attachmentUrl: attachmentKey || null,
    createdBy: userId,
  });

  const push = await notifyParentsOfNotice(notice, {
    audienceType,
    classSectionIds,
    studentClassIds,
  });
  console.log(
    `Teacher→parent push notice=${notice.id}`,
    push?.fcm?.skipped
      ? 'FCM_SKIPPED'
      : `users=${push?.userIds?.length ?? 0} tokens=${push?.tokens ?? 0} ok=${push?.fcm?.success ?? 0}`
  );
  return notice;
}

export async function previewTeacherNotification(userId, role, body) {
  const parsed = payloadSchema.safeParse({ ...body, asDraft: true });
  if (!parsed.success) {
    const err = new Error('Invalid notification details');
    err.status = 400;
    throw err;
  }
  const { students, summary } = await resolveRecipients(userId, role, parsed.data);
  return {
    title: parsed.data.title,
    message: parsed.data.message,
    category: parsed.data.category || 'General',
    recipientSummary: summary,
    recipientCount: students.length,
    students: students.slice(0, 50).map((s) => ({
      id: s.id,
      name: s.name,
      rollNo: s.rollNo,
      label: s.label,
    })),
  };
}

export { serializeNotification };
