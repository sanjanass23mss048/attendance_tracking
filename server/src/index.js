import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma.js';
import { requireAuth, toPublicUser } from './middleware/auth.js';
import { mapRoleToApp } from './services/schoolRepo.js';
import { initRealtime } from './lib/realtime.js';
import authRoutes from './routes/auth.js';
import classRoutes from './routes/classes.js';
import studentRoutes from './routes/students.js';
import studentImportRoutes from './routes/studentImport.js';
import attendanceRoutes from './routes/attendance.js';
import holidayRoutes from './routes/holidays.js';
import calendarRoutes from './routes/calendar.js';
import teacherRoutes from './routes/teachers.js';
import reportRoutes from './routes/reports.js';
import documentRoutes from './routes/documents.js';
import attendanceEditRequestRoutes from './routes/attendanceEditRequests.js';
import whatsappWebhookRoutes from './routes/whatsappWebhook.js';
import teacherNotificationRoutes from './routes/teacherNotifications.js';
import noticeRoutes from './routes/notices.js';
import diaryRoutes from './routes/diary.js';
import timetableRoutes from './routes/timetable.js';
import parentRoutes from './routes/parent.js';
import { requireStaff } from './middleware/roles.js';
import { ensureAttendanceStatuses } from './lib/statusMap.js';
import { ensureUploadDir } from './lib/storage.js';
import { ensureStudentImportTables } from './lib/ensureStudentImportTables.js';
import { ensureTeacherNotificationTables } from './lib/ensureTeacherNotificationTables.js';

const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const distPath = path.resolve(__dirname, '../../dist');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

/** Comma-separated public origins, e.g. http://103.192.199.178:4000 — use * for tunnels */
const extraOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowAnyOrigin = extraOrigins.includes('*');

const CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  ...extraOrigins.filter((o) => o !== '*'),
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server have no Origin header
      if (!origin || allowAnyOrigin || CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith('/api/webhooks/whatsapp')) {
        req.rawBody = buf;
      }
    },
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'attendance-api', realtime: 'socket.io' });
});

const publicDir = path.resolve(__dirname, '../public');
app.use('/public', express.static(publicDir));
app.get('/privacy-policy', (_req, res) => {
  res.sendFile(path.join(publicDir, 'privacy-policy.html'));
});
app.get('/privacy', (_req, res) => {
  res.redirect(301, '/privacy-policy');
});

if (!isProd) {
  app.get('/', (_req, res) => {
    res.json({
      service: 'attendance-api',
      ok: true,
      realtime: 'socket.io',
      try: ['/health', '/api/auth/login'],
      ui: 'http://localhost:5173',
    });
  });
}

app.use('/api/auth', authRoutes);

app.get('/api/me', requireAuth, async (req, res) => {
  const user = await prisma.tblUsers.findUnique({
    where: { user_id: req.user.sub },
    include: { tblRoles: true },
  });
  if (!user || user.int_status === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({
    user: toPublicUser({
      id: user.user_id,
      email: user.email,
      name: user.name,
      role: mapRoleToApp(user.role_id, user.tblRoles?.Text),
    }),
  });
});

app.use('/api/classes', requireAuth, requireStaff, classRoutes);
app.use('/api/students/import', requireAuth, requireStaff, studentImportRoutes);
app.use('/api/students', requireAuth, requireStaff, studentRoutes);
app.use('/api/teachers', requireAuth, requireStaff, teacherRoutes);
app.use('/api/reports', requireAuth, requireStaff, reportRoutes);
app.use('/api/attendance', requireAuth, requireStaff, attendanceRoutes);
app.use('/api/holidays', requireAuth, requireStaff, holidayRoutes);
app.use('/api/calendar', requireAuth, requireStaff, calendarRoutes);
app.use('/api/documents', requireAuth, requireStaff, documentRoutes);
app.use('/api/attendance-edit-requests', requireAuth, requireStaff, attendanceEditRequestRoutes);
app.use('/api/teacher-notifications', requireAuth, requireStaff, teacherNotificationRoutes);
app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/parent', parentRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (isProd) {
  app.use(express.static(distPath));
  // SPA fallback for client-side routes (skip API / health / socket)
  app.get(/^(?!\/api(?:\/|$)|\/health(?:\/|$)|\/socket\.io(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = http.createServer(app);
initRealtime(server, allowAnyOrigin ? true : CORS_ORIGINS);

ensureUploadDir()
  .then(() => ensureAttendanceStatuses())
  .then(() => ensureStudentImportTables())
  .then(() => ensureTeacherNotificationTables())
  .then(() => {
    console.log('Attendance statuses ensured (P/A/L/H/OH/OF)');
    console.log('Student import tables ensured');
    console.log('Teacher notification tables ensured');
  })
  .catch((err) => {
    console.error('Startup init failed', err);
  });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Attendance app listening on http://0.0.0.0:${PORT}`);
  console.log(`Mode: ${isProd ? 'production (UI + API)' : 'api-only'}`);
  console.log(`Realtime: Socket.IO (CORS ${CORS_ORIGINS.join(', ')})`);
});
