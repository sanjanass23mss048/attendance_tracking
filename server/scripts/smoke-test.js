const base = 'http://localhost:4000';

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(`${opts.method || 'GET'} ${path} -> ${res.status}`);
    err.status = res.status;
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
console.log('LOGIN ok', { user: login.user, tokenLen: login.token?.length });

const auth = { Authorization: `Bearer ${login.token}` };

const classes = await req('/api/classes', { headers: auth });
console.log(
  'CLASSES',
  classes.classes.map((c) => ({
    name: c.name,
    sections: c.sections.map((s) => `${s.name}:${s.studentCount}`),
  }))
);

const sectionId = classes.classes.find((c) => c.name === '1')?.sections?.find((s) => s.name === 'A')?.id;
console.log('SECTION_1A', sectionId);

const students = await req(`/api/students?sectionId=${encodeURIComponent(sectionId)}`, {
  headers: auth,
});
console.log('STUDENTS', students.students.length, students.students.slice(0, 3).map((s) => ({
  id: s.id,
  roll: s.rollNo,
  name: s.name,
})));

const today = new Date().toISOString().slice(0, 10);
const marks = students.students.slice(0, 5).map((s, i) => ({
  studentId: s.id,
  status: ['P', 'A', 'L', 'H', 'OH'][i],
}));

const saved = await req('/api/attendance/daily', {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({ sectionId, date: today, marks }),
});
console.log('SAVE_DAILY', saved);

const loaded = await req(
  `/api/attendance/daily?date=${today}&sectionId=${encodeURIComponent(sectionId)}`,
  { headers: auth }
);
console.log(
  'LOAD_DAILY',
  loaded.marks.filter((m) => m.status).map((m) => ({
    roll: m.rollNo,
    status: m.status,
  }))
);

const summary = await req(`/api/attendance/summary?date=${today}`, { headers: auth });
console.log('SUMMARY', summary);

const me = await req('/api/me', { headers: auth });
console.log('ME', me.user);

console.log('SMOKE_OK');
