import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import {
  getIntelligenceThresholds,
  saveIntelligenceThresholds,
  MEETING_STATUSES,
  DEFAULT_INTELLIGENCE_THRESHOLDS,
} from '../lib/attendanceIntelligenceConfig.js';
import {
  buildAttendanceIntelligence,
  buildStudentTimeline,
} from '../services/attendanceIntelligenceService.js';
import {
  listMeetings,
  createMeeting,
  updateMeeting,
  enrichMeetingsWithStudents,
  notifyParentOfMeeting,
  addNote,
  listNotes,
} from '../services/attendanceMeetingRepo.js';
import {
  isDemoStudentClassId,
} from '../lib/attendanceIntelligenceDemo.js';
import { ensureAttendanceIntelligenceTables } from '../lib/ensureAttendanceIntelligenceTables.js';

const router = Router();
const editors = requireRoles('ADMIN', 'INCHARGE', 'HOD', 'VICE_PRINCIPAL', 'PRINCIPAL', 'HEADMASTER');

router.use(requireAuth, editors);

router.use(async (_req, _res, next) => {
  try {
    await ensureAttendanceIntelligenceTables();
  } catch (err) {
    console.warn('ensureAttendanceIntelligenceTables', err?.message || err);
  }
  next();
});

router.get('/summary', async (req, res) => {
  try {
    const data = await buildAttendanceIntelligence({
      asOf: req.query.asOf ? String(req.query.asOf) : undefined,
      forceDemo: req.query.demo === '1' || req.query.demo === 'true',
    });
    return res.json({
      asOf: data.asOf,
      thresholds: data.thresholds,
      summary: data.summary,
      demo: Boolean(data.demo),
      walkthrough: Boolean(data.walkthrough),
    });
  } catch (err) {
    console.error('intelligence summary', err);
    return res.status(500).json({ error: 'Could not load attendance intelligence' });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const data = await buildAttendanceIntelligence({
      asOf: req.query.asOf ? String(req.query.asOf) : undefined,
      forceDemo: req.query.demo === '1' || req.query.demo === 'true',
    });
    return res.json(data);
  } catch (err) {
    console.error('intelligence overview', err);
    return res.status(500).json({ error: 'Could not load attendance intelligence' });
  }
});

router.get('/thresholds', async (_req, res) => {
  try {
    const thresholds = await getIntelligenceThresholds();
    return res.json({ thresholds, defaults: DEFAULT_INTELLIGENCE_THRESHOLDS });
  } catch (err) {
    console.error('intelligence thresholds get', err);
    return res.json({ thresholds: DEFAULT_INTELLIGENCE_THRESHOLDS, defaults: DEFAULT_INTELLIGENCE_THRESHOLDS });
  }
});

router.put('/thresholds', async (req, res) => {
  try {
    const thresholds = await saveIntelligenceThresholds(req.body || {}, req.user?.id || null);
    return res.json({ thresholds });
  } catch (err) {
    console.error('intelligence thresholds put', err);
    return res.status(500).json({ error: 'Could not save thresholds' });
  }
});

router.get('/meetings', async (req, res) => {
  try {
    const rows = await listMeetings({
      status: req.query.status ? String(req.query.status) : undefined,
      studentClassId: req.query.studentClassId ? String(req.query.studentClassId) : undefined,
      followUpOnly: req.query.followUpOnly === '1' || req.query.followUpOnly === 'true',
    });
    const meetings = await enrichMeetingsWithStudents(rows);
    return res.json({ meetings, statuses: MEETING_STATUSES });
  } catch (err) {
    console.error('intelligence meetings list', err);
    return res.status(500).json({ error: 'Could not load meetings' });
  }
});

const meetingSchema = z.object({
  studentClassId: z.string().min(1),
  studentRecordId: z.string().optional().nullable(),
  parentName: z.string().optional().nullable(),
  reason: z.string().min(1),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffName: z.string().optional().nullable(),
  discussionNotes: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')),
  status: z.string().optional(),
  /** When true (default), WhatsApp parent and set Status → Completed on successful send. */
  notifyParent: z.boolean().optional().default(true),
});

router.post('/meetings', async (req, res) => {
  const parsed = meetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid meeting', details: parsed.error.flatten() });
  }
  if (parsed.data.status && !MEETING_STATUSES.includes(parsed.data.status)) {
    return res.status(400).json({ error: 'Invalid meeting status' });
  }
  if (isDemoStudentClassId(parsed.data.studentClassId)) {
    return res.status(400).json({
      error: 'Demo students are read-only. Import real students to schedule live meetings.',
    });
  }
  try {
    const { notifyParent, ...meetingInput } = parsed.data;
    let meeting = await createMeeting(meetingInput, req.user);
    let [enriched] = await enrichMeetingsWithStudents([meeting]);
    let notify = null;

    if (notifyParent !== false) {
      try {
        notify = await notifyParentOfMeeting(meeting, enriched.student);
        if (notify.sent > 0) {
          meeting = await updateMeeting(meeting.id, { status: 'Completed' }, req.user);
          [enriched] = await enrichMeetingsWithStudents([meeting]);
        }
      } catch (err) {
        console.warn('intelligence meeting parent notify', err?.message || err);
        notify = {
          attempted: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          error: err?.message || 'Notify failed',
        };
      }
    }

    return res.status(201).json({ meeting: enriched, notify });
  } catch (err) {
    console.error('intelligence meetings create', err);
    return res.status(500).json({ error: 'Could not create meeting' });
  }
});

router.patch('/meetings/:id', async (req, res) => {
  if (String(req.params.id || '').startsWith('demo-')) {
    return res.status(400).json({ error: 'Demo meetings are read-only for walkthroughs.' });
  }
  try {
    const body = { ...(req.body || {}) };
    const notifyParent = body.notifyParent === true;
    delete body.notifyParent;

    let meeting = await updateMeeting(req.params.id, body, req.user);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    let [enriched] = await enrichMeetingsWithStudents([meeting]);
    let notify = null;

    if (notifyParent) {
      try {
        notify = await notifyParentOfMeeting(meeting, enriched.student);
        if (notify.sent > 0) {
          meeting = await updateMeeting(meeting.id, { status: 'Completed' }, req.user);
          [enriched] = await enrichMeetingsWithStudents([meeting]);
        }
      } catch (err) {
        console.warn('intelligence meeting parent notify (patch)', err?.message || err);
        notify = {
          attempted: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          error: err?.message || 'Notify failed',
        };
      }
    }

    return res.json({ meeting: enriched, notify });
  } catch (err) {
    console.error('intelligence meetings update', err);
    return res.status(500).json({ error: 'Could not update meeting' });
  }
});

router.get('/students/:studentClassId/timeline', async (req, res) => {
  try {
    if (isDemoStudentClassId(req.params.studentClassId)) {
      const overview = await buildAttendanceIntelligence({ forceDemo: true });
      const row =
        overview.longAbsences.find((s) => s.studentClassId === req.params.studentClassId) ||
        overview.patterns.find((s) => s.studentClassId === req.params.studentClassId);
      if (!row) return res.status(404).json({ error: 'Demo student not found' });
      const asOf = overview.asOf;
      const events = [];
      for (let i = 0; i < 14; i += 1) {
        const d = new Date(`${asOf}T12:00:00`);
        d.setDate(d.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        const status = i < (row.consecutiveAbsent || 0) ? 'A' : i % 5 === 0 ? 'H' : 'P';
        events.push({
          type: 'attendance',
          date,
          status,
          label: status === 'A' ? 'Absent' : status === 'H' ? 'Half Day' : 'Present',
        });
      }
      return res.json({
        demo: true,
        student: row,
        events,
        notes: [
          {
            id: 'demo-note-1',
            text: 'Demo note — parent call logged (sample).',
            createdOn: asOf,
          },
        ],
      });
    }
    const timeline = await buildStudentTimeline(req.params.studentClassId, {
      days: req.query.days ? Number(req.query.days) : 90,
    });
    if (!timeline) return res.status(404).json({ error: 'Student not found' });
    return res.json(timeline);
  } catch (err) {
    console.error('intelligence timeline', err);
    return res.status(500).json({ error: 'Could not load student timeline' });
  }
});

router.get('/students/:studentClassId/notes', async (req, res) => {
  try {
    if (isDemoStudentClassId(req.params.studentClassId)) {
      return res.json({
        notes: [
          {
            id: 'demo-note-1',
            text: 'Demo note — parent call logged (sample).',
            createdOn: new Date().toISOString().slice(0, 10),
          },
        ],
      });
    }
    const notes = await listNotes(req.params.studentClassId);
    return res.json({ notes });
  } catch (err) {
    console.error('intelligence notes list', err);
    return res.status(500).json({ error: 'Could not load notes' });
  }
});

router.post('/students/:studentClassId/notes', async (req, res) => {
  if (isDemoStudentClassId(req.params.studentClassId)) {
    return res.status(400).json({ error: 'Demo students are read-only.' });
  }
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Note text is required' });
  try {
    const note = await addNote(req.params.studentClassId, text, req.user);
    return res.status(201).json({ note });
  } catch (err) {
    console.error('intelligence notes create', err);
    return res.status(500).json({ error: 'Could not save note' });
  }
});

export default router;
