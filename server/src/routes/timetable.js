import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireStaff } from '../middleware/roles.js';
import { newId } from '../lib/ids.js';
import { canAccessSection, findClassSectionById, findClassSectionByNames, mapRoleToApp } from '../services/schoolRepo.js';
import {
  PERIOD_TIMES as LEGACY_PERIOD_TIMES,
  TIMETABLE_DAYS as LEGACY_TIMETABLE_DAYS,
  normalizeWeeklyGrid,
} from '../lib/defaultTimetable.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { ensureTimetableSchedulingTables } from '../lib/ensureTimetableSchedulingTables.js';
import {
  DEFAULT_TIMETABLE_SETTINGS,
  buildEmptyGrid,
  buildPeriodSlots,
  flattenTeachingAssignments,
  initialsFromName,
  isBreakSlot,
  normalizeSchedulingGrid,
  normalizeTimetableSettings,
  parseSubjectNames,
  SLOT_TYPES,
} from '../lib/timetableScheduling.js';

const router = Router();

const SETTINGS_ROW_ID = 'TTS-DEFAULT';

router.use(async (_req, _res, next) => {
  try {
    await ensureTimetableSchedulingTables();
    next();
  } catch (err) {
    next(err);
  }
});

async function loadSettings() {
  await ensureTimetableSchedulingTables();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "Settings_Json" FROM "tblTimetable_Settings" WHERE "Settings_id" = $1 LIMIT 1`,
    SETTINGS_ROW_ID
  );
  const raw = rows?.[0]?.Settings_Json;
  return normalizeTimetableSettings(raw);
}

async function saveSettings(settings, userId) {
  await ensureTimetableSchedulingTables();
  const normalized = normalizeTimetableSettings(settings);
  const json = JSON.stringify(normalized);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "tblTimetable_Settings" ("Settings_id", "Settings_Json", "Updated_On", "Updated_By")
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT ("Settings_id") DO UPDATE
       SET "Settings_Json" = EXCLUDED."Settings_Json",
           "Updated_On" = NOW(),
           "Updated_By" = EXCLUDED."Updated_By"`,
    SETTINGS_ROW_ID,
    json,
    userId || null
  );
  return normalized;
}

function serializeLegacyTimetable(row, classSectionId) {
  return {
    classSectionId,
    days: LEGACY_TIMETABLE_DAYS,
    periods: LEGACY_PERIOD_TIMES,
    grid: normalizeWeeklyGrid(row?.Grid_Json, classSectionId),
    updatedOn: row?.Updated_On?.toISOString?.() || null,
    isDefault: !row,
  };
}

async function serializeSchedulingTimetable(row, classSectionId, settings) {
  const periodSlots = buildPeriodSlots(settings);
  const days = settings.workingDays;
  const grid = row?.Grid_Json
    ? normalizeSchedulingGrid(row.Grid_Json, periodSlots, days.length)
    : buildEmptyGrid(days.length, periodSlots);
  return {
    classSectionId,
    days,
    periods: periodSlots,
    grid,
    settings,
    updatedOn: row?.Updated_On?.toISOString?.() || null,
    isDefault: !row,
  };
}

async function resolveClassSection({ classSectionId, className, sectionName }) {
  const raw = String(classSectionId || '').trim();
  if (raw.includes('||')) {
    const [cn, sn, sid] = raw.split('||').map((s) => String(s || '').trim());
    if (sid) {
      const bySid = await findClassSectionById(sid);
      if (bySid) return bySid;
    }
    if (cn && sn) {
      const byParts = await findClassSectionByNames(cn, sn);
      if (byParts) return byParts;
    }
  }
  if (raw) {
    const byId = await findClassSectionById(raw);
    if (byId) return byId;
  }
  const cn = String(className || '').trim();
  const sn = String(sectionName || '').trim();
  if (cn && sn) return findClassSectionByNames(cn, sn);
  return null;
}

async function listSubjectsDb() {
  await ensureTimetableSchedulingTables();
  return prisma.tblSubjects.findMany({ orderBy: { Text: 'asc' } });
}

async function ensureSubjectByName(name) {
  const text = String(name || '').trim();
  if (!text) return null;
  const all = await listSubjectsDb();
  const found = all.find((s) => s.Text.toLowerCase() === text.toLowerCase());
  if (found) return found;
  const created = await prisma.tblSubjects.create({
    data: { Subject_id: newId('SUB'), Text: text },
  });
  return created;
}

async function listTeacherSubjectRows() {
  await ensureTimetableSchedulingTables();
  return prisma.$queryRawUnsafe(
    `SELECT "Teacher_Subject_id", "Teacher_id", "Subject_id", "Academic_Year", "Int_Status"
     FROM "tblTeacher_Subjects"
     WHERE COALESCE("Int_Status", 1) <> 0`
  );
}

async function upsertTeacherSubject(teacherId, subjectId, academicYear = null) {
  await ensureTimetableSchedulingTables();
  const existing = await prisma.$queryRawUnsafe(
    `SELECT "Teacher_Subject_id" FROM "tblTeacher_Subjects"
     WHERE "Teacher_id" = $1 AND "Subject_id" = $2 LIMIT 1`,
    teacherId,
    subjectId
  );
  if (existing?.[0]?.Teacher_Subject_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "tblTeacher_Subjects" SET "Int_Status" = 1 WHERE "Teacher_Subject_id" = $1`,
      existing[0].Teacher_Subject_id
    );
    return existing[0].Teacher_Subject_id;
  }
  const id = newId('TS');
  await prisma.$executeRawUnsafe(
    `INSERT INTO "tblTeacher_Subjects"
      ("Teacher_Subject_id", "Teacher_id", "Subject_id", "Academic_Year", "Int_Status")
     VALUES ($1, $2, $3, $4, 1)`,
    id,
    teacherId,
    subjectId,
    academicYear
  );
  return id;
}

/** Sync free-text profile.subjects into mapping rows when mapping table is sparse. */
async function syncMappingsFromProfiles() {
  const mappings = await listTeacherSubjectRows();
  if (mappings.length) return mappings;
  const users = await prisma.tblUsers.findMany({
    include: { tblStaff_Profile: true, tblRoles: true },
  });
  const subjects = await listSubjectsDb();
  const byName = new Map(subjects.map((s) => [s.Text.toLowerCase(), s]));
  for (const user of users) {
    const names = parseSubjectNames(user.tblStaff_Profile?.subjects);
    for (const name of names) {
      let sub = byName.get(name.toLowerCase());
      if (!sub) {
        sub = await ensureSubjectByName(name);
        if (sub) byName.set(sub.Text.toLowerCase(), sub);
      }
      if (sub) await upsertTeacherSubject(user.user_id, sub.Subject_id);
    }
  }
  return listTeacherSubjectRows();
}

async function listSchedulingTeachers() {
  const users = await prisma.tblUsers.findMany({
    where: { int_status: { not: 0 } },
    include: { tblStaff_Profile: true, tblRoles: true },
    orderBy: { name: 'asc' },
  });
  const mappings = await syncMappingsFromProfiles();
  const subjects = await listSubjectsDb();
  const subjectById = new Map(subjects.map((s) => [s.Subject_id, s]));

  const out = [];
  for (const user of users) {
    const role = mapRoleToApp(user.role_id, user.tblRoles?.Text);
    if (role === 'PARENT') continue;
    const profile = user.tblStaff_Profile;
    const staffType = profile?.staff_type;
    if (staffType === 'non-teaching') continue;
    const isTeaching =
      staffType === 'teaching' ||
      role === 'TEACHER' ||
      Boolean(profile?.subjects) ||
      mappings.some((m) => m.Teacher_id === user.user_id);
    if (!isTeaching && role !== 'ADMIN' && role !== 'INCHARGE') continue;

    const mapped = mappings
      .filter((m) => m.Teacher_id === user.user_id)
      .map((m) => {
        const sub = subjectById.get(m.Subject_id);
        return sub
          ? {
              teacherSubjectId: m.Teacher_Subject_id,
              subjectId: sub.Subject_id,
              name: sub.Text,
            }
          : null;
      })
      .filter(Boolean);
    const fallbackNames = parseSubjectNames(profile?.subjects);
    out.push({
      id: user.user_id,
      name: user.name,
      email: user.email,
      initials: initialsFromName(user.name),
      subjects: mapped.length
        ? mapped
        : fallbackNames.map((name) => ({ teacherSubjectId: null, subjectId: null, name })),
      subjectNames: mapped.length ? mapped.map((m) => m.name) : fallbackNames,
    });
  }
  return out;
}

function classLabelFromSection(cs) {
  const c = cs?.tblClass?.Class_Name || '';
  const s = cs?.tblSection?.Section_Name || '';
  return c && s ? `${c}-${s}` : cs?.Class_Section_id || '';
}

async function loadAllTimetableRows() {
  return prisma.tblTimetable.findMany({
    include: {
      classSection: { include: { tblClass: true, tblSection: true } },
    },
  });
}

/**
 * Build occupancy map: teacherKey -> dayIndex -> periodNumber -> [{ classSectionId, label, subject }]
 */
function buildTeacherOccupancy(rows, settings, excludeClassSectionId = null) {
  const periodSlots = buildPeriodSlots(settings);
  const dayCount = settings.workingDays.length;
  const map = new Map();

  const touch = (key, dayIndex, periodNumber, info) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, new Map());
    const byDay = map.get(key);
    if (!byDay.has(dayIndex)) byDay.set(dayIndex, new Map());
    const byPeriod = byDay.get(dayIndex);
    if (!byPeriod.has(periodNumber)) byPeriod.set(periodNumber, []);
    byPeriod.get(periodNumber).push(info);
  };

  for (const row of rows) {
    const csId = row.Class_Section_id;
    if (excludeClassSectionId && csId === excludeClassSectionId) continue;
    const grid = normalizeSchedulingGrid(row.Grid_Json, periodSlots, dayCount);
    const label = classLabelFromSection(row.classSection);
    for (const item of flattenTeachingAssignments(grid, periodSlots)) {
      const cell = item.cell;
      const info = {
        classSectionId: csId,
        classLabel: label,
        subject: cell.subject || '',
        teacher: cell.teacher || '',
      };
      if (cell.teacherId) touch(`id:${cell.teacherId}`, item.dayIndex, item.periodNumber, info);
      if (cell.teacher) touch(`name:${String(cell.teacher).trim().toLowerCase()}`, item.dayIndex, item.periodNumber, info);
    }
  }
  return map;
}

function findConflictsForGrid(grid, periodSlots, settings, occupancy, classSectionId) {
  const conflicts = [];
  const local = new Map();
  for (const item of flattenTeachingAssignments(grid, periodSlots)) {
    const cell = item.cell;
    if (!cell.teacherId && !cell.teacher) continue;
    const keys = [];
    if (cell.teacherId) keys.push(`id:${cell.teacherId}`);
    if (cell.teacher) keys.push(`name:${String(cell.teacher).trim().toLowerCase()}`);
    for (const key of keys) {
      const localKey = `${key}|${item.dayIndex}|${item.periodNumber}`;
      if (local.has(localKey)) {
        conflicts.push({
          dayIndex: item.dayIndex,
          periodNumber: item.periodNumber,
          teacher: cell.teacher || cell.teacherId,
          message: `${cell.teacher || 'Teacher'} is assigned twice in this timetable (Period ${item.periodNumber}, ${settings.workingDays[item.dayIndex]})`,
        });
      } else {
        local.set(localKey, true);
      }
      const others = occupancy.get(key)?.get(item.dayIndex)?.get(item.periodNumber) || [];
      for (const other of others) {
        if (other.classSectionId === classSectionId) continue;
        conflicts.push({
          dayIndex: item.dayIndex,
          periodNumber: item.periodNumber,
          teacher: cell.teacher || cell.teacherId,
          otherClass: other.classLabel,
          message: `${cell.teacher || 'Teacher'} already teaching ${other.classLabel} at Period ${item.periodNumber} on ${settings.workingDays[item.dayIndex]}`,
        });
      }
    }
  }
  // de-dupe by message
  const seen = new Set();
  return conflicts.filter((c) => {
    if (seen.has(c.message)) return false;
    seen.add(c.message);
    return true;
  });
}

async function validateTeacherSubjectMappings(grid, periodSlots) {
  const mappings = await syncMappingsFromProfiles();
  const mapSet = new Set(mappings.map((m) => `${m.Teacher_id}::${m.Subject_id}`));
  const teachers = await listSchedulingTeachers();
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const teacherByName = new Map(teachers.map((t) => [t.name.trim().toLowerCase(), t]));
  const subjects = await listSubjectsDb();
  const subjectById = new Map(subjects.map((s) => [s.Subject_id, s]));
  const subjectByName = new Map(subjects.map((s) => [s.Text.toLowerCase(), s]));

  const errors = [];
  for (const item of flattenTeachingAssignments(grid, periodSlots)) {
    const cell = item.cell;
    const slotType = cell.slotType || (cell.teacher || cell.teacherId ? 'teacher' : 'subject');
    if (slotType === 'library' || slotType === 'activity') continue;
    if (!cell.teacherId && !cell.teacher) continue;
    if (!cell.subjectId && !cell.subject) continue;

    const teacher =
      (cell.teacherId && teacherById.get(cell.teacherId)) ||
      (cell.teacher && teacherByName.get(String(cell.teacher).trim().toLowerCase()));
    const subject =
      (cell.subjectId && subjectById.get(cell.subjectId)) ||
      (cell.subject && subjectByName.get(String(cell.subject).trim().toLowerCase()));

    if (!teacher || !subject) continue;

    // If teacher has no mappings at all, allow (legacy free-text) but prefer mapped when present
    const teacherMaps = mappings.filter((m) => m.Teacher_id === teacher.id);
    if (!teacherMaps.length) continue;

    if (!mapSet.has(`${teacher.id}::${subject.Subject_id}`)) {
      errors.push({
        dayIndex: item.dayIndex,
        periodNumber: item.periodNumber,
        message: `${teacher.name} is not mapped to subject ${subject.Text}`,
      });
    }
  }
  return errors;
}

/* -------------------- Routes -------------------- */

router.get('/', requireAuth, async (req, res) => {
  const classSectionId = req.query.classSectionId ? String(req.query.classSectionId) : '';
  if (!classSectionId) {
    return res.status(400).json({ error: 'classSectionId is required' });
  }
  const role = String(req.user?.role || '').toUpperCase();
  if (role === 'PARENT') {
    const { listChildrenForParent } = await import('../services/schoolRepo.js');
    const children = await listChildrenForParent(req.user.sub);
    if (!children.some((c) => c.sectionId === classSectionId)) {
      return res.status(403).json({ error: 'Forbidden for this class' });
    }
  } else {
    const ok = await canAccessSection(req.user.sub, req.user.role, classSectionId);
    if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });
  }

  const mode = String(req.query.mode || 'legacy').toLowerCase();
  const row = await prisma.tblTimetable.findUnique({
    where: { Class_Section_id: classSectionId },
  });

  if (mode === 'scheduling') {
    const settings = await loadSettings();
    const timetable = await serializeSchedulingTimetable(row, classSectionId, settings);
    return res.json({ timetable });
  }

  return res.json({ timetable: serializeLegacyTimetable(row, classSectionId) });
});

const putSchema = z.object({
  classSectionId: z.string().min(1),
  className: z.string().optional(),
  sectionName: z.string().optional(),
  grid: z.array(z.array(z.any())).min(1),
  mode: z.enum(['legacy', 'scheduling']).optional(),
  settings: z.any().optional(),
});

router.put('/', requireAuth, requireStaff, async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid timetable payload', details: parsed.error.flatten() });
  }
  const { classSectionId: rawId, className, sectionName, grid, mode } = parsed.data;
  const section = await resolveClassSection({
    classSectionId: rawId,
    className,
    sectionName,
  });
  if (!section) {
    return res.status(400).json({ error: 'Unknown class / section — pick a class from the list and save again' });
  }
  const classSectionId = section.Class_Section_id;
  const ok = await canAccessSection(req.user.sub, req.user.role, classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const schedulingMode = mode === 'scheduling';

  try {
    if (schedulingMode) {
      const settings = await loadSettings();
      const periodSlots = buildPeriodSlots(settings);
      const normalized = normalizeSchedulingGrid(grid, periodSlots, settings.workingDays.length);

      const allRows = await loadAllTimetableRows();
      const occupancy = buildTeacherOccupancy(allRows, settings, classSectionId);
      const conflicts = findConflictsForGrid(normalized, periodSlots, settings, occupancy, classSectionId);
      if (conflicts.length) {
        return res.status(409).json({
          error: conflicts[0].message,
          conflicts,
        });
      }
      const mappingErrors = await validateTeacherSubjectMappings(normalized, periodSlots);
      if (mappingErrors.length) {
        return res.status(400).json({
          error: mappingErrors[0].message,
          mappingErrors,
        });
      }

      const row = await prisma.$transaction(async (tx) => {
        return tx.tblTimetable.upsert({
          where: { Class_Section_id: classSectionId },
          create: {
            Timetable_id: newId('TTB'),
            Class_Section_id: classSectionId,
            Grid_Json: normalized,
          },
          update: {
            Grid_Json: normalized,
            Updated_On: new Date(),
          },
        });
      });

      logAdminAudit(req, {
        action: 'TIMETABLE_UPDATE',
        category: 'TIMETABLE',
        entityType: 'timetable',
        entityId: row.Timetable_id,
        summary: `Updated timetable for ${classSectionId}`,
        details: { classSectionId, mode: 'scheduling', days: settings.workingDays.length },
      });

      const timetable = await serializeSchedulingTimetable(row, classSectionId, settings);
      return res.json({ timetable });
    }

    const row = await prisma.tblTimetable.upsert({
      where: { Class_Section_id: classSectionId },
      create: {
        Timetable_id: newId('TTB'),
        Class_Section_id: classSectionId,
        Grid_Json: grid,
      },
      update: {
        Grid_Json: grid,
        Updated_On: new Date(),
      },
    });
    logAdminAudit(req, {
      action: 'TIMETABLE_UPDATE',
      category: 'TIMETABLE',
      entityType: 'timetable',
      entityId: row.Timetable_id,
      summary: `Updated timetable for ${classSectionId}`,
      details: { classSectionId, days: Array.isArray(grid) ? grid.length : null },
    });
    return res.json({ timetable: serializeLegacyTimetable(row, classSectionId) });
  } catch (err) {
    if (err?.code === 'P2003') {
      return res.status(400).json({
        error: 'This class section is missing in the database, so the timetable could not be saved',
      });
    }
    console.error('Timetable save failed', err);
    return res.status(500).json({ error: err?.message || 'Could not save timetable' });
  }
});

router.delete('/assignment', requireAuth, requireStaff, async (req, res) => {
  const classSectionId = String(req.body?.classSectionId || req.query.classSectionId || '').trim();
  const dayIndex = Number(req.body?.dayIndex ?? req.query.dayIndex);
  const periodIndex = Number(req.body?.periodIndex ?? req.query.periodIndex);
  if (!classSectionId || !Number.isInteger(dayIndex) || !Number.isInteger(periodIndex)) {
    return res.status(400).json({ error: 'classSectionId, dayIndex, and periodIndex are required' });
  }
  const ok = await canAccessSection(req.user.sub, req.user.role, classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const settings = await loadSettings();
  const periodSlots = buildPeriodSlots(settings);
  if (isBreakSlot(periodSlots[periodIndex])) {
    return res.status(400).json({ error: 'Cannot clear a break slot' });
  }

  const row = await prisma.tblTimetable.findUnique({ where: { Class_Section_id: classSectionId } });
  if (!row) return res.status(404).json({ error: 'Timetable not found' });

  const grid = normalizeSchedulingGrid(row.Grid_Json, periodSlots, settings.workingDays.length);
  if (!grid[periodIndex]?.[dayIndex]) {
    return res.json({ timetable: await serializeSchedulingTimetable(row, classSectionId, settings) });
  }
  grid[periodIndex][dayIndex] = {
    subject: '',
    teacher: '',
    teacherId: null,
    subjectId: null,
    teacherSubjectId: null,
    slotType: null,
  };

  const updated = await prisma.tblTimetable.update({
    where: { Class_Section_id: classSectionId },
    data: { Grid_Json: grid, Updated_On: new Date() },
  });
  return res.json({ timetable: await serializeSchedulingTimetable(updated, classSectionId, settings) });
});

router.get('/teachers', requireAuth, requireStaff, async (_req, res) => {
  try {
    const teachers = await listSchedulingTeachers();
    return res.json({ teachers });
  } catch (err) {
    console.error('timetable teachers', err);
    return res.status(500).json({ error: err?.message || 'Could not load teachers' });
  }
});

router.get('/subjects', requireAuth, requireStaff, async (_req, res) => {
  try {
    const subjects = await listSubjectsDb();
    return res.json({
      subjects: subjects.map((s) => ({
        id: s.Subject_id,
        name: s.Text,
        slotTypeHint:
          String(s.Text).toLowerCase() === 'library'
            ? 'library'
            : /game|sport|draw|art|music|activity/i.test(s.Text)
              ? 'activity'
              : 'subject',
      })),
    });
  } catch (err) {
    console.error('timetable subjects', err);
    return res.status(500).json({ error: err?.message || 'Could not load subjects' });
  }
});

router.get('/teacher-subjects', requireAuth, requireStaff, async (_req, res) => {
  try {
    const mappings = await syncMappingsFromProfiles();
    const subjects = await listSubjectsDb();
    const subjectById = new Map(subjects.map((s) => [s.Subject_id, s.Text]));
    return res.json({
      mappings: mappings.map((m) => ({
        id: m.Teacher_Subject_id,
        teacherId: m.Teacher_id,
        subjectId: m.Subject_id,
        subjectName: subjectById.get(m.Subject_id) || null,
        academicYear: m.Academic_Year || null,
      })),
    });
  } catch (err) {
    console.error('timetable teacher-subjects', err);
    return res.status(500).json({ error: 'Could not load teacher–subject mappings' });
  }
});

const mappingPutSchema = z.object({
  teacherId: z.string().min(1),
  subjectId: z.string().min(1),
  academicYear: z.string().optional().nullable(),
});

router.put('/teacher-subjects', requireAuth, requireStaff, async (req, res) => {
  const parsed = mappingPutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'teacherId and subjectId are required' });
  }
  try {
    const id = await upsertTeacherSubject(
      parsed.data.teacherId,
      parsed.data.subjectId,
      parsed.data.academicYear || null
    );
    return res.json({ ok: true, id });
  } catch (err) {
    console.error('timetable teacher-subjects put', err);
    return res.status(500).json({ error: 'Could not save mapping' });
  }
});

router.get('/settings', requireAuth, requireStaff, async (_req, res) => {
  try {
    const settings = await loadSettings();
    return res.json({
      settings,
      periods: buildPeriodSlots(settings),
      defaults: DEFAULT_TIMETABLE_SETTINGS,
      slotTypes: SLOT_TYPES,
    });
  } catch (err) {
    console.error('timetable settings get', err);
    return res.status(500).json({ error: 'Could not load timetable settings' });
  }
});

router.put('/settings', requireAuth, requireStaff, async (req, res) => {
  try {
    const settings = await saveSettings(req.body?.settings || req.body || {}, req.user?.sub);
    logAdminAudit(req, {
      action: 'TIMETABLE_SETTINGS_UPDATE',
      category: 'TIMETABLE',
      entityType: 'timetable_settings',
      entityId: SETTINGS_ROW_ID,
      summary: 'Updated timetable period settings',
      details: { periodCount: settings.periodCount, workingDays: settings.workingDays },
    });
    return res.json({ settings, periods: buildPeriodSlots(settings) });
  } catch (err) {
    console.error('timetable settings put', err);
    return res.status(500).json({ error: 'Could not save timetable settings' });
  }
});

router.get('/teacher-availability', requireAuth, requireStaff, async (req, res) => {
  const teacherId = String(req.query.teacherId || '').trim();
  if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
  try {
    const settings = await loadSettings();
    const periodSlots = buildPeriodSlots(settings);
    const teachingSlots = periodSlots.filter((s) => !isBreakSlot(s));
    const rows = await loadAllTimetableRows();
    const occupancy = buildTeacherOccupancy(rows, settings);
    const teacher = (await listSchedulingTeachers()).find((t) => t.id === teacherId);
    const nameKey = teacher ? `name:${teacher.name.trim().toLowerCase()}` : null;
    const idKey = `id:${teacherId}`;

    const days = settings.workingDays.map((dayName, dayIndex) => {
      const periods = teachingSlots.map((slot) => {
        const fromId = occupancy.get(idKey)?.get(dayIndex)?.get(slot.period) || [];
        const fromName = nameKey ? occupancy.get(nameKey)?.get(dayIndex)?.get(slot.period) || [] : [];
        const merged = [...fromId];
        for (const item of fromName) {
          if (!merged.some((m) => m.classSectionId === item.classSectionId)) merged.push(item);
        }
        const occupied = merged.length > 0;
        return {
          period: slot.period,
          time: slot.time,
          status: occupied ? 'O' : 'U',
          assignments: merged,
        };
      });
      return { dayIndex, dayName, periods };
    });

    return res.json({
      teacherId,
      teacherName: teacher?.name || null,
      days,
      legend: { O: 'Occupied', U: 'Unoccupied' },
    });
  } catch (err) {
    console.error('teacher-availability', err);
    return res.status(500).json({ error: 'Could not load teacher availability' });
  }
});

router.post('/validate', requireAuth, requireStaff, async (req, res) => {
  const classSectionId = String(req.body?.classSectionId || '').trim();
  const grid = req.body?.grid;
  if (!classSectionId || !Array.isArray(grid)) {
    return res.status(400).json({ error: 'classSectionId and grid are required' });
  }
  try {
    const settings = await loadSettings();
    const periodSlots = buildPeriodSlots(settings);
    const normalized = normalizeSchedulingGrid(grid, periodSlots, settings.workingDays.length);
    const allRows = await loadAllTimetableRows();
    const occupancy = buildTeacherOccupancy(allRows, settings, classSectionId);
    const conflicts = findConflictsForGrid(normalized, periodSlots, settings, occupancy, classSectionId);
    const mappingErrors = await validateTeacherSubjectMappings(normalized, periodSlots);
    return res.json({
      ok: !conflicts.length && !mappingErrors.length,
      conflicts,
      mappingErrors,
    });
  } catch (err) {
    console.error('timetable validate', err);
    return res.status(500).json({ error: 'Validation failed' });
  }
});

export default router;
