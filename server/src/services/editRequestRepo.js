import { prisma } from '../lib/prisma.js';
import { newId, toDateString } from '../lib/ids.js';
import {
  EDIT_PERMISSION_MINUTES,
  addMinutes,
  normalizePhone,
} from '../lib/attendanceEditRules.js';

export const REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
};

export function serializeEditRequest(row) {
  if (!row) return null;
  const now = Date.now();
  let status = row.Status;
  if (
    status === REQUEST_STATUS.APPROVED &&
    row.Edit_Expires_At &&
    new Date(row.Edit_Expires_At).getTime() < now
  ) {
    status = REQUEST_STATUS.EXPIRED;
  }

  return {
    id: row.Request_id,
    teacherId: row.Teacher_id,
    teacherName: row.teacher?.name || null,
    classId: row.Class_id,
    sectionId: row.Section_id,
    classSectionId: row.Class_Section_id,
    className: row.className || null,
    sectionName: row.sectionName || null,
    attendanceDate: toDateString(row.Attendance_Date),
    reason: row.Reason,
    denyReason: row.Deny_Reason || null,
    approverId: row.Approver_id,
    approverName: row.approver?.name || null,
    status,
    requestedAt: row.Requested_At?.toISOString?.() ?? row.Requested_At,
    respondedAt: row.Responded_At?.toISOString?.() ?? row.Responded_At ?? null,
    editExpiresAt: row.Edit_Expires_At?.toISOString?.() ?? row.Edit_Expires_At ?? null,
    usedAt: row.Used_At?.toISOString?.() ?? row.Used_At ?? null,
    whatsappMessageId: row.WhatsApp_Message_id || null,
  };
}

async function enrichRequest(row) {
  if (!row) return null;
  const cs = await prisma.tblClass_Section.findUnique({
    where: { Class_Section_id: row.Class_Section_id },
    include: { tblClass: true, tblSection: true },
  });
  return serializeEditRequest({
    ...row,
    className: cs?.tblClass?.Class_Name || null,
    sectionName: cs?.tblSection?.Section_Name || null,
  });
}

export async function findApproverForSection(classSectionId) {
  const assigned = await prisma.tblClass_Section_Approver.findFirst({
    where: { Class_Section_id: classSectionId, Int_Status: { not: 0 } },
    include: { tblUsers: { include: { tblRoles: true } } },
  });
  if (assigned?.tblUsers) {
    return {
      userId: assigned.tblUsers.user_id,
      name: assigned.tblUsers.name,
      phone: assigned.WhatsApp_Phone || assigned.tblUsers.phone,
      roleId: assigned.tblUsers.role_id,
      roleName: assigned.tblUsers.tblRoles?.Text,
    };
  }

  // Bright Future: INCHARGE first. New 3-role schools have no INCHARGE → ADMIN.
  const incharge = await prisma.tblUsers.findFirst({
    where: {
      int_status: { not: 0 },
      OR: [
        { role_id: { contains: 'INCHARGE', mode: 'insensitive' } },
        { tblRoles: { Text: { contains: 'Incharge', mode: 'insensitive' } } },
      ],
    },
    include: { tblRoles: true },
    orderBy: { name: 'asc' },
  });
  if (incharge) {
    return {
      userId: incharge.user_id,
      name: incharge.name,
      phone: incharge.phone,
      roleId: incharge.role_id,
      roleName: incharge.tblRoles?.Text,
    };
  }

  const admin = await prisma.tblUsers.findFirst({
    where: {
      int_status: { not: 0 },
      OR: [
        { role_id: { contains: 'ADMIN', mode: 'insensitive' } },
        { tblRoles: { Text: { contains: 'Admin', mode: 'insensitive' } } },
      ],
    },
    include: { tblRoles: true },
    orderBy: { name: 'asc' },
  });
  if (!admin) return null;
  return {
    userId: admin.user_id,
    name: admin.name,
    phone: admin.phone,
    roleId: admin.role_id,
    roleName: admin.tblRoles?.Text,
  };
}

export async function findPendingDuplicate({ teacherId, classSectionId, attendanceDate }) {
  return prisma.tblAttendance_Edit_Requests.findFirst({
    where: {
      Teacher_id: teacherId,
      Class_Section_id: classSectionId,
      Attendance_Date: attendanceDate,
      Status: REQUEST_STATUS.PENDING,
      Int_Status: { not: 0 },
    },
  });
}

export async function createEditRequest({
  teacherId,
  classId,
  sectionId,
  classSectionId,
  attendanceDate,
  reason,
  approverId,
}) {
  const row = await prisma.tblAttendance_Edit_Requests.create({
    data: {
      Request_id: newId('AER'),
      Teacher_id: teacherId,
      Class_id: classId,
      Section_id: sectionId,
      Class_Section_id: classSectionId,
      Attendance_Date: attendanceDate,
      Reason: reason,
      Approver_id: approverId,
      Status: REQUEST_STATUS.PENDING,
    },
    include: {
      teacher: true,
      approver: true,
    },
  });
  return enrichRequest(row);
}

export async function setWhatsAppMessageId(requestId, messageId) {
  return prisma.tblAttendance_Edit_Requests.update({
    where: { Request_id: requestId },
    data: { WhatsApp_Message_id: messageId },
  });
}

export async function findEditRequestById(requestId) {
  const row = await prisma.tblAttendance_Edit_Requests.findFirst({
    where: { Request_id: requestId, Int_Status: { not: 0 } },
    include: { teacher: true, approver: true },
  });
  return row;
}

export async function listMyRequests(teacherId) {
  const rows = await prisma.tblAttendance_Edit_Requests.findMany({
    where: { Teacher_id: teacherId, Int_Status: { not: 0 } },
    include: { teacher: true, approver: true },
    orderBy: { Requested_At: 'desc' },
    take: 100,
  });
  return Promise.all(rows.map(enrichRequest));
}

export async function listPendingForApprover(approverId) {
  const rows = await prisma.tblAttendance_Edit_Requests.findMany({
    where: {
      Approver_id: approverId,
      Status: REQUEST_STATUS.PENDING,
      Int_Status: { not: 0 },
    },
    include: { teacher: true, approver: true },
    orderBy: { Requested_At: 'asc' },
  });
  return Promise.all(rows.map(enrichRequest));
}

export async function approveEditRequest(requestId, { actorId } = {}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.tblAttendance_Edit_Requests.findUnique({
      where: { Request_id: requestId },
    });
    if (!row || row.Int_Status === 0) {
      throw Object.assign(new Error('Request not found'), { status: 404 });
    }
    if (row.Status !== REQUEST_STATUS.PENDING) {
      throw Object.assign(new Error('Request is no longer pending'), { status: 409 });
    }
    const expires = addMinutes(new Date(), EDIT_PERMISSION_MINUTES);
    const updated = await tx.tblAttendance_Edit_Requests.update({
      where: { Request_id: requestId },
      data: {
        Status: REQUEST_STATUS.APPROVED,
        Responded_At: new Date(),
        Edit_Expires_At: expires,
      },
      include: { teacher: true, approver: true },
    });
    void actorId;
    return enrichRequest(updated);
  });
}

export async function denyEditRequest(requestId, { denyReason = null, actorId } = {}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.tblAttendance_Edit_Requests.findUnique({
      where: { Request_id: requestId },
    });
    if (!row || row.Int_Status === 0) {
      throw Object.assign(new Error('Request not found'), { status: 404 });
    }
    if (row.Status !== REQUEST_STATUS.PENDING) {
      throw Object.assign(new Error('Request is no longer pending'), { status: 409 });
    }
    const updated = await tx.tblAttendance_Edit_Requests.update({
      where: { Request_id: requestId },
      data: {
        Status: REQUEST_STATUS.DENIED,
        Responded_At: new Date(),
        Deny_Reason: denyReason || null,
      },
      include: { teacher: true, approver: true },
    });
    void actorId;
    return enrichRequest(updated);
  });
}

export async function markRequestUsed(requestId) {
  return prisma.tblAttendance_Edit_Requests.update({
    where: { Request_id: requestId },
    data: {
      Status: REQUEST_STATUS.USED,
      Used_At: new Date(),
    },
  });
}

export async function expireStaleApprovals() {
  const now = new Date();
  await prisma.tblAttendance_Edit_Requests.updateMany({
    where: {
      Status: REQUEST_STATUS.APPROVED,
      Edit_Expires_At: { lt: now },
    },
    data: { Status: REQUEST_STATUS.EXPIRED },
  });
}

/** Active approved permission for teacher + section + date (not expired). */
export async function findActiveEditPermission({ teacherId, classSectionId, attendanceDate }) {
  await expireStaleApprovals();
  const now = new Date();
  return prisma.tblAttendance_Edit_Requests.findFirst({
    where: {
      Teacher_id: teacherId,
      Class_Section_id: classSectionId,
      Attendance_Date: attendanceDate,
      Status: REQUEST_STATUS.APPROVED,
      Edit_Expires_At: { gt: now },
      Int_Status: { not: 0 },
    },
    orderBy: { Responded_At: 'desc' },
  });
}

export async function findLatestRequestForContext({ teacherId, classSectionId, attendanceDate }) {
  await expireStaleApprovals();
  const row = await prisma.tblAttendance_Edit_Requests.findFirst({
    where: {
      Teacher_id: teacherId,
      Class_Section_id: classSectionId,
      Attendance_Date: attendanceDate,
      Int_Status: { not: 0 },
    },
    include: { teacher: true, approver: true },
    orderBy: { Requested_At: 'desc' },
  });
  return enrichRequest(row);
}

export async function findLatestPendingForApprover(approverId) {
  await expireStaleApprovals();
  return prisma.tblAttendance_Edit_Requests.findFirst({
    where: {
      Approver_id: approverId,
      Status: REQUEST_STATUS.PENDING,
      Int_Status: { not: 0 },
    },
    include: { teacher: true, approver: true },
    orderBy: { Requested_At: 'desc' },
  });
}

export async function findApproverByWhatsAppPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const users = await prisma.tblUsers.findMany({
    where: { int_status: { not: 0 }, phone: { not: null } },
  });
  const match = users.find((u) => normalizePhone(u.phone) === normalized);
  if (match) return match;

  const assigned = await prisma.tblClass_Section_Approver.findMany({
    where: { WhatsApp_Phone: { not: null }, Int_Status: { not: 0 } },
    include: { tblUsers: true },
  });
  const viaAssign = assigned.find((a) => normalizePhone(a.WhatsApp_Phone) === normalized);
  return viaAssign?.tblUsers || null;
}

export { normalizePhone };
