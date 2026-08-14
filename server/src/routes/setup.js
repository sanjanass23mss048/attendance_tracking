import { Router } from 'express';
import { z } from 'zod';
import { attendanceMainHost } from '../lib/tenantHost.js';
import { checkSlugAvailability, createSchoolTenant } from '../services/tenantProvisionService.js';
import { INITIAL_PASSWORD } from '../lib/initialPassword.js';

const router = Router();
function assertSetupSecret(req, res) {
  const expected = String(process.env.SETUP_SECRET || '').trim();
  if (!expected) return true;
  const provided =
    req.headers['x-setup-secret'] ||
    req.body?.setupSecret ||
    req.query?.secret ||
    '';
  if (String(provided) !== expected) {
    res.status(403).json({ error: 'Invalid setup secret' });
    return false;
  }
  return true;
}

const slugSchema = z.object({
  slug: z.string().min(3),
});

const createSchema = z.object({
  schoolName: z.string().min(2),
  slug: z.string().min(3),
  city: z.string().optional().nullable(),
  board: z.string().optional().nullable(),
  includeKg: z.boolean().optional().default(true),
  maxGrade: z.coerce.number().int().min(1).max(12).optional().default(12),
  setupSecret: z.string().optional(),
  admin: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional().nullable(),
  }),
});

router.get('/meta', (_req, res) => {
  return res.json({
    requiresSecret: Boolean(String(process.env.SETUP_SECRET || '').trim()),
    mainHost: attendanceMainHost(),
    initialPassword: INITIAL_PASSWORD,
  });
});

router.post('/check-slug', async (req, res) => {  if (!assertSetupSecret(req, res)) return;
  const parsed = slugSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid slug', details: parsed.error.flatten() });
  }
  try {
    const result = await checkSlugAvailability(parsed.data.slug);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Could not check slug' });
  }
});

router.post('/create', async (req, res) => {
  if (!assertSetupSecret(req, res)) return;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid setup payload', details: parsed.error.flatten() });
  }
  try {
    const result = await createSchoolTenant(parsed.data);
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error('[setup/create]', err);
    return res.status(400).json({ error: err.message || 'Could not create school' });
  }
});

export default router;
