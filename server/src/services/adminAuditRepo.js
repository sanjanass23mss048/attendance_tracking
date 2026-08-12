import { prisma } from '../lib/prisma.js';
import { newId } from '../lib/ids.js';

/**
 * Write a row to the admin audit feed. Never throws — failures are logged only.
 */
export async function writeAdminAudit({
  actor = null,
  action,
  category,
  entityType = null,
  entityId = null,
  summary,
  details = null,
  ip = null,
  userAgent = null,
  success = true,
} = {}) {
  try {
    if (!action || !category || !summary) return null;

    const actorUserId =
      actor?.id || actor?.user_id || actor?.sub || actor?.userId || null;
    const actorName = actor?.name || null;
    const actorEmail = actor?.email || null;
    const actorRole = actor?.role || actor?.role_id || null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "tblAdmin_Audit_Logs"
        ("Log_id","Created_On","Actor_User_id","Actor_Name","Actor_Email","Actor_Role",
         "Action","Category","Entity_Type","Entity_id","Summary","Details_Json",
         "Ip_Address","User_Agent","Success")
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)`,
      newId('AAL'),
      actorUserId ? String(actorUserId).slice(0, 50) : null,
      actorName ? String(actorName).slice(0, 255) : null,
      actorEmail ? String(actorEmail).slice(0, 255) : null,
      actorRole ? String(actorRole).slice(0, 50) : null,
      String(action).slice(0, 80),
      String(category).slice(0, 40),
      entityType ? String(entityType).slice(0, 80) : null,
      entityId ? String(entityId).slice(0, 80) : null,
      String(summary).slice(0, 500),
      details == null ? null : JSON.stringify(details),
      ip ? String(ip).slice(0, 64) : null,
      userAgent ? String(userAgent).slice(0, 500) : null,
      Boolean(success)
    );
    return true;
  } catch (err) {
    console.warn('writeAdminAudit failed', err?.message || err);
    return null;
  }
}

export function auditActorFromReq(req) {
  const u = req?.user || {};
  return {
    id: u.sub || u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  };
}

export function clientMetaFromReq(req) {
  const xf = req?.headers?.['x-forwarded-for'];
  const ip =
    (typeof xf === 'string' && xf.split(',')[0].trim()) ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    null;
  const userAgent = req?.headers?.['user-agent'] || null;
  return { ip, userAgent };
}

/** Fire-and-forget helper for route handlers. */
export function logAdminAudit(req, payload) {
  const actor = payload.actor || auditActorFromReq(req);
  const meta = clientMetaFromReq(req);
  return writeAdminAudit({
    ...payload,
    actor,
    ip: payload.ip ?? meta.ip,
    userAgent: payload.userAgent ?? meta.userAgent,
  }).catch(() => null);
}

/**
 * List audit logs with filters (ADMIN UI).
 */
export async function listAdminAuditLogs({
  category,
  action,
  actorUserId,
  actorSearch,
  q,
  from,
  to,
  success,
  limit = 50,
  offset = 0,
} = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (category) {
    where.push(`"Category" = $${i++}`);
    params.push(String(category));
  }
  if (action) {
    where.push(`"Action" = $${i++}`);
    params.push(String(action));
  }
  if (actorUserId) {
    where.push(`"Actor_User_id" = $${i++}`);
    params.push(String(actorUserId));
  }
  if (actorSearch) {
    where.push(
      `("Actor_Name" ILIKE $${i} OR "Actor_Email" ILIKE $${i} OR "Actor_User_id" ILIKE $${i})`
    );
    params.push(`%${String(actorSearch)}%`);
    i += 1;
  }
  if (q) {
    where.push(
      `("Summary" ILIKE $${i} OR "Action" ILIKE $${i} OR "Entity_id" ILIKE $${i} OR "Entity_Type" ILIKE $${i})`
    );
    params.push(`%${String(q)}%`);
    i += 1;
  }
  if (from) {
    where.push(`"Created_On" >= $${i++}::timestamptz`);
    params.push(String(from));
  }
  if (to) {
    where.push(`"Created_On" <= $${i++}::timestamptz`);
    params.push(String(to));
  }
  if (success === true || success === false) {
    where.push(`"Success" = $${i++}`);
    params.push(success);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);

  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM "tblAdmin_Audit_Logs" ${whereSql}`,
    ...params
  );
  const total = countRows?.[0]?.c ?? 0;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       "Log_id" AS id,
       "Created_On" AS "createdOn",
       "Actor_User_id" AS "actorUserId",
       "Actor_Name" AS "actorName",
       "Actor_Email" AS "actorEmail",
       "Actor_Role" AS "actorRole",
       "Action" AS action,
       "Category" AS category,
       "Entity_Type" AS "entityType",
       "Entity_id" AS "entityId",
       "Summary" AS summary,
       "Details_Json" AS details,
       "Ip_Address" AS "ipAddress",
       "User_Agent" AS "userAgent",
       "Success" AS success
     FROM "tblAdmin_Audit_Logs"
     ${whereSql}
     ORDER BY "Created_On" DESC
     LIMIT ${lim} OFFSET ${off}`,
    ...params
  );

  return {
    total,
    limit: lim,
    offset: off,
    logs: (rows || []).map((r) => ({
      ...r,
      createdOn: r.createdOn instanceof Date ? r.createdOn.toISOString() : r.createdOn,
    })),
  };
}

export const AUDIT_CATEGORIES = [
  'AUTH',
  'ATTENDANCE',
  'NOTIFICATION',
  'NOTICE',
  'STUDENT',
  'TEACHER',
  'HOLIDAY',
  'CALENDAR',
  'DIARY',
  'TIMETABLE',
  'APPROVAL',
  'IMPORT',
  'OTHER',
];
