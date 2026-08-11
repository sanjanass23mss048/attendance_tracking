import { prisma } from '../lib/prisma.js';
import { newId, toDateString } from '../lib/ids.js';
import { serializeClassSection } from './schoolRepo.js';

function classLabel(cs) {
  if (!cs) return '';
  const c = cs.tblClass?.Class_Name || '';
  const s = cs.tblSection?.Section_Name || '';
  return c && s ? `${c} - ${s}` : c || s;
}

export function serializeNotice(row) {
  const targets = row.targets || [];
  const classLabels = [];
  const studentNames = [];
  for (const t of targets) {
    if (t.classSection) classLabels.push(classLabel(t.classSection));
    if (t.studentClass?.tblStudents) {
      const st = t.studentClass.tblStudents;
      const name = [st.First_Name, st.Last_Name].filter(Boolean).join(' ').trim();
      if (name) studentNames.push(name);
    }
  }
  const uniqueClasses = [...new Set(classLabels.filter(Boolean))];
  let audienceLabel = 'Notice';
  const type = String(row.Audience_Type || '').toUpperCase();
  if (type === 'ALL') {
    audienceLabel = 'All Students';
  } else if (type === 'STUDENTS') {
    audienceLabel = 'Specific Students';
  } else if (uniqueClasses.length === 1) {
    audienceLabel = `Class: ${uniqueClasses[0]}`;
  } else if (uniqueClasses.length > 1) {
    const shown = uniqueClasses.slice(0, 6).join(', ');
    audienceLabel =
      uniqueClasses.length > 6
        ? `Classes: ${shown},…`
        : `Classes: ${shown}`;
  }

  return {
    id: row.Notice_id,
    title: row.Title,
    body: row.Body,
    audienceType: row.Audience_Type,
    audienceLabel,
    classLabels: uniqueClasses,
    studentNames,
    attachmentName: row.Attachment_Name,
    attachmentUrl: row.Attachment_Url,
    createdBy: row.Created_By,
    authorName: row.author?.name || null,
    createdOn: row.Created_On?.toISOString?.() || null,
    date: toDateString(row.Created_On) || null,
    targets: targets.map((t) => ({
      id: t.Target_id,
      classSectionId: t.Class_Section_id,
      studentClassId: t.Student_Class_id,
      classLabel: t.classSection ? classLabel(t.classSection) : null,
      section: t.classSection ? serializeClassSection(t.classSection) : null,
    })),
  };
}

const noticeInclude = {
  author: { select: { user_id: true, name: true } },
  targets: {
    include: {
      classSection: { include: { tblClass: true, tblSection: true } },
      studentClass: { include: { tblStudents: true } },
    },
  },
};

export async function listNotices({ limit = 100 } = {}) {
  const rows = await prisma.tblNotices.findMany({
    where: { Int_Status: { not: 0 } },
    include: noticeInclude,
    orderBy: { Created_On: 'desc' },
    take: Math.min(Number(limit) || 100, 200),
  });
  return rows.map(serializeNotice);
}

export async function listNoticesForParentScope({ classSectionIds, studentClassIds, limit = 100 }) {
  const sectionIds = classSectionIds || [];
  const scIds = studentClassIds || [];
  const take = Math.min(Number(limit) || 100, 200);

  const or = [];
  if (sectionIds.length) {
    or.push({ Class_Section_id: { in: sectionIds } });
  }
  if (scIds.length) {
    or.push({ Student_Class_id: { in: scIds } });
  }

  const targetedIds = or.length
    ? (
        await prisma.tblNotice_Targets.findMany({
          where: { OR: or },
          select: { Notice_id: true },
        })
      ).map((t) => t.Notice_id)
    : [];

  const noticeIds = [...new Set(targetedIds)];

  const rows = await prisma.tblNotices.findMany({
    where: {
      Int_Status: { not: 0 },
      OR: [
        { Audience_Type: 'ALL' },
        ...(noticeIds.length ? [{ Notice_id: { in: noticeIds } }] : []),
      ],
    },
    include: noticeInclude,
    orderBy: { Created_On: 'desc' },
    take,
  });
  return rows.map(serializeNotice);
}

export async function createNotice({
  title,
  body,
  audienceType,
  classSectionIds = [],
  studentClassIds = [],
  attachmentName,
  attachmentUrl,
  createdBy,
}) {
  const type = String(audienceType || '').toUpperCase();
  const noticeId = newId('NTC');
  const targets = [];

  if (type === 'ALL') {
    // School-wide — no row targets; parents see via Audience_Type = ALL
  } else if (type === 'STUDENTS') {
    for (const sid of studentClassIds) {
      targets.push({
        Target_id: newId('NTT'),
        Notice_id: noticeId,
        Student_Class_id: sid,
        Class_Section_id: null,
      });
    }
  } else {
    for (const csId of classSectionIds) {
      targets.push({
        Target_id: newId('NTT'),
        Notice_id: noticeId,
        Class_Section_id: csId,
        Student_Class_id: null,
      });
    }
  }

  await prisma.tblNotices.create({
    data: {
      Notice_id: noticeId,
      Title: title || null,
      Body: body,
      Audience_Type: type,
      Attachment_Name: attachmentName || null,
      Attachment_Url: attachmentUrl || null,
      Created_By: createdBy,
      Int_Status: 1,
      ...(targets.length ? { targets: { create: targets } } : {}),
    },
  });

  const row = await prisma.tblNotices.findUnique({
    where: { Notice_id: noticeId },
    include: noticeInclude,
  });
  return serializeNotice(row);
}
