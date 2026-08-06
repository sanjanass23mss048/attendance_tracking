import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listClassesForUser } from '../services/schoolRepo.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const classes = await listClassesForUser(req.user.sub, req.user.role);
  return res.json({ classes });
});

export default router;
