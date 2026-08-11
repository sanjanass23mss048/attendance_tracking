import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/realtime.js';
import { sendFcmToTokens } from '../lib/fcm.js';

/**
 * Resolve parent user ids who should see this notice on their board.
 * - ALL → every active PARENT user
 * - CLASS/CLASSES → parents linked to students in those sections
 * - STUDENTS → parents linked to those enrollments' students
 */
export async function parentUserIdsForNotice({
  audienceType,
  classSectionIds = [],
  studentClassIds = [],
}) {
  const type = String(audienceType || '').toUpperCase();

  if (type === 'ALL') {
    const parents = await prisma.tblUsers.findMany({
      where: { role_id: 'PARENT', int_status: { not: 0 } },
      select: { user_id: true },
    });
    return [...new Set(parents.map((p) => p.user_id))];
  }

  let studentIds = [];

  if (type === 'STUDENTS' && studentClassIds.length) {
    const enrollments = await prisma.tblStudent_Class.findMany({
      where: { student_class_id: { in: studentClassIds }, Int_Status: { not: 0 } },
      select: { Student_id: true },
    });
    studentIds = enrollments.map((e) => e.Student_id);
  } else if (classSectionIds.length) {
    const enrollments = await prisma.tblStudent_Class.findMany({
      where: { class_section_id: { in: classSectionIds }, Int_Status: { not: 0 } },
      select: { Student_id: true },
    });
    studentIds = enrollments.map((e) => e.Student_id);
  }

  studentIds = [...new Set(studentIds.filter(Boolean))];
  if (!studentIds.length) return [];

  const links = await prisma.tblParent_Student.findMany({
    where: { Student_id: { in: studentIds }, Int_Status: { not: 0 } },
    select: { user_id: true },
  });
  return [...new Set(links.map((l) => l.user_id))];
}

export async function notifyParentsOfNotice(notice, {
  audienceType,
  classSectionIds = [],
  studentClassIds = [],
} = {}) {
  const userIds = await parentUserIdsForNotice({
    audienceType: audienceType || notice.audienceType,
    classSectionIds,
    studentClassIds,
  });
  if (!userIds.length) {
    return { userIds: [], tokens: 0, fcm: null };
  }

  const title = notice.title || notice.audienceLabel || 'New notice';
  const body = String(notice.body || '').slice(0, 180);
  const payload = {
    noticeId: notice.id,
    title,
    body,
    audienceType: notice.audienceType,
    audienceLabel: notice.audienceLabel,
  };

  // Realtime (app open / connected)
  const io = getIO();
  if (io) {
    for (const uid of userIds) {
      io.to(`user:${uid}`).emit('notice:new', payload);
    }
  }

  // FCM push (background / killed)
  const tokenRows = await prisma.tblDevice_Tokens.findMany({
    where: { user_id: { in: userIds }, Int_Status: { not: 0 } },
    select: { Token: true, Token_id: true },
  });
  const tokens = [...new Set(tokenRows.map((t) => t.Token).filter(Boolean))];
  let fcm = null;
  if (tokens.length) {
    fcm = await sendFcmToTokens(tokens, {
      title: 'Notice Board',
      body: `${title}: ${body}`,
      data: {
        type: 'notice',
        noticeId: String(notice.id || ''),
        route: '/parent/notices',
      },
    });

    // Drop invalid tokens
    if (fcm?.invalidTokens?.length) {
      await prisma.tblDevice_Tokens.updateMany({
        where: { Token: { in: fcm.invalidTokens } },
        data: { Int_Status: 0 },
      });
    }
  }

  return { userIds, tokens: tokens.length, fcm };
}
