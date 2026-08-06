import 'dotenv/config';

const base = process.env.API_BASE || 'http://127.0.0.1:4000';

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${opts.method || 'GET'} ${path} -> ${res.status}`);
    err.body = body;
    throw err;
  }
  return body;
}

const login = await req('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'incharge@brightfuture.edu.in',
    password: 'password123',
  }),
});
const auth = { Authorization: `Bearer ${login.token}` };
const date = new Date().toISOString().slice(0, 10);
const sectionId = 'CS-1-A';

const daily = await req(
  `/api/attendance/daily?date=${date}&sectionId=${encodeURIComponent(sectionId)}`,
  { headers: auth }
);
const absent = (daily.marks || []).filter((m) => m.status === 'A').slice(0, 2);
const targets =
  absent.length > 0
    ? absent
    : [{ studentId: daily.marks[0].studentId, status: 'A' }];

const initiatedAt = new Date().toISOString();
const saved = await req('/api/attendance/parent-messages', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    sectionId,
    date,
    initiatedAt,
    messages: targets.map((t) => ({
      studentId: String(t.studentId),
      status: t.status || 'A',
      message: 'test parent message',
    })),
  }),
});
console.log('RECORDED', saved.recorded, 'sent', saved.sentMessages?.length);

const again = await req(
  `/api/attendance/daily?date=${date}&sectionId=${encodeURIComponent(sectionId)}`,
  { headers: auth }
);
console.log(
  'FETCH_SENT',
  again.sentMessages?.map((m) => `${m.studentId}:${m.status}`).join(', ')
);
console.log('OK');
