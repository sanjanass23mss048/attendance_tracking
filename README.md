# Bright Future — School Attendance

Vite/React UI plus an optional Express + Prisma + Postgres API.

## Quick start (frontend only)

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. Mock data is used by default (`VITE_USE_MOCK` is not `false`).

## Backend (API + Postgres)

See [server/README.md](server/README.md) for full details. Short version:

```bash
# 1. Postgres
docker compose up -d

# 2. Server
cd server
cp .env.example .env
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

API: **http://localhost:4000**

### Default login

- Email: `incharge@brightfuture.edu.in`
- Password: `password123`

### Connect the UI to the API

Copy root `.env.example` → `.env.local` and set:

```
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:4000
```

Thin clients live in `src/services/` (`authService`, `classService`, `studentService`, `attendanceService`). Existing screens keep working on mocks until you wire them to those services.

## Tech

| Layer | Stack |
|-------|--------|
| Frontend | React 19 · Vite 8 · Tailwind 4 |
| Backend | Express · Prisma · Postgres 16 · JWT · bcrypt · Zod |
