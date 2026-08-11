/**
 * Backfill parent Notice Board rows for SENT teacher notifications
 * that failed to mirror (e.g. nested Notice_id create bug).
 */
import { prisma } from './src/lib/prisma.js';
import { createNotice } from './src/services/noticeRepo.js';
import { notifyParentsOfNotice } from './src/services/parentNotify.js';

const RECIPIENT_TYPES = {
  ALL_STUDENTS: 'ALL_STUDENTS',
  SPECIFIC_STUDENTS: 'SPECIFIC_STUDENTS',
  INDIVIDUAL: 'INDIVIDUAL',
  ENTIRE_CLASS: 'ENTIRE_CLASS',
  CLASS_GROUP: 'CLASS_GROUP',
};

function hasFullClassAccess(role) {
  const r = String(role || '').toUpperCase();
  return r === 'INCHARGE' || r === 'ADMIN' || r === 'PRINCIPAL';
}

async function mirrorRow(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.recipient_payload || '{}');
  } catch {
    payload = {};
  }
  const recipients = await prisma.tblTeacher_Notification_Recipients.findMany({
    where: { notification_id: row.notification_id },
  });
  const studentClassIds = recipients.map((r) => r.student_class_id).filter(Boolean);
  const students = studentClassIds.map((id) => ({ id, sectionId: null }));

  const data = {
    title: row.title,
    message: row.message,
    category: row.category,
    recipientType: row.recipient_type,
    sectionIds: payload.sectionIds || [],
    studentIds: payload.studentIds || [],
    groupId: payload.groupId || null,
  };

  let audienceType = 'STUDENTS';
  let classSectionIds = [];
  let scIds = [];

  if (data.recipientType === RECIPIENT_TYPES.ALL_STUDENTS) {
    audienceType = 'ALL';
  } else if (
    data.recipientType === RECIPIENT_TYPES.SPECIFIC_STUDENTS ||
    data.recipientType === RECIPIENT_TYPES.INDIVIDUAL
  ) {
    audienceType = 'STUDENTS';
    scIds = [...new Set(studentClassIds)];
  } else {
    classSectionIds = [...new Set(data.sectionIds || [])];
    audienceType = classSectionIds.length === 1 ? 'CLASS' : 'CLASSES';
  }

  if (audienceType !== 'ALL' && !classSectionIds.length && !scIds.length) {
    console.log('skip empty', row.notification_id);
    return;
  }

  const titleParts = [data.category, data.title].filter(Boolean);
  const notice = await createNotice({
    title: titleParts.join(' · ') || data.title,
    body: data.message,
    audienceType,
    classSectionIds,
    studentClassIds: scIds,
    attachmentName: row.attachment_name || null,
    createdBy: row.created_by,
  });
  await notifyParentsOfNotice(notice, {
    audienceType,
    classSectionIds,
    studentClassIds: scIds,
  });
  console.log('mirrored', row.notification_id, '->', notice.id, audienceType, 'targets', scIds.length || classSectionIds.length);
}

const rows = await prisma.tblTeacher_Notifications.findMany({
  where: { status: 'SENT' },
  orderBy: { created_at: 'desc' },
  take: 20,
});

console.log('sent notifications', rows.length);
for (const row of rows) {
  const existing = await prisma.tblNotices.findFirst({
    where: {
      Body: row.message,
      Title: { contains: row.title },
      Created_On: { gte: new Date(new Date(row.sent_at || row.created_at).getTime() - 60_000) },
    },
  });
  if (existing) {
    console.log('already have notice for', row.notification_id, existing.Notice_id);
    continue;
  }
  try {
    await mirrorRow(row);
  } catch (e) {
    console.error('fail', row.notification_id, e.message);
  }
}

await prisma.$disconnect();
