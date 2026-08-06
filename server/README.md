# Attendance API (Express + Prisma + Postgres)

Backend for **Bright Future Public School** attendance tracking.

## Prerequisites

- Node.js 20+
- Docker (for Postgres) **or** a local Postgres 16 instance

## 1. Start Postgres

From the repo root:

```bash
docker compose up -d
```

This starts Postgres 16 on port `5432` with:

- user / password: `postgres` / `postgres`
- database: `attendance`

## 2. Configure server env

```bash
cd server
cp .env.example .env
```

Defaults in `.env.example`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendance"
JWT_SECRET="change-me-to-a-long-random-string"
PORT=4000
```

Change `JWT_SECRET` before any real deployment.

For production (UI + API on one port, Docker), see **[DEPLOY.md](../DEPLOY.md)**.

## 3. Install, migrate, seed

```bash
cd server
npm install
npx prisma migrate deploy
npm run prisma:seed
```

First-time local alternative (creates a new migration folder if needed):

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

Or after the DB is up:

```bash
npm run db:setup
```

> If `docker` is not installed, install Docker Desktop (or run Postgres 16 yourself) before migrate/seed.

## 4. Run the API

```bash
npm run dev
```

API: **http://localhost:4000**  
Health: `GET http://localhost:4000/health`

## Default login

| Field    | Value                         |
|----------|-------------------------------|
| Email    | `incharge@brightfuture.edu.in` |
| Password | `password123`                 |
| Role     | `INCHARGE`                    |

## Main routes

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | No auth |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/me` | Bearer JWT |
| GET | `/api/classes` | Classes with sections |
| GET | `/api/students?class=1&section=A` | or `?sectionId=` |
| GET/PUT | `/api/attendance/daily` | Daily marks |
| GET/PUT | `/api/attendance/periods` | Period marks |
| GET/POST | `/api/holidays` | Holidays |

Attendance status values (Zod): `P` \| `A` \| `L` \| `H` \| `O`.

## Realtime (Socket.IO)

After a successful `PUT /api/attendance/daily` or `PUT /api/attendance/periods`, the API emits:

```
attendance:updated → { sectionId, date, type: 'daily' | 'periods' }
```

- Server: `socket.io` on the same HTTP port (`:4000`), CORS allows `http://localhost:5173`
- Client: `socket.io-client` connects after login when `VITE_USE_MOCK=false`
- Browsers viewing the same section/date refetch the grid without a full page reload
- Header shows **Live** / **Reconnecting** connection status

Health also reports `"realtime": "socket.io"`.

## Frontend (mock by default)

Root `.env` / `.env.local`:

```
VITE_USE_MOCK=true
VITE_API_URL=http://localhost:4000
```

Set `VITE_USE_MOCK=false` to call this API from `src/services/*` (login, classes, students, attendance, reports, dashboard summary).

**Remember me:** login accepts `rememberMe`; JWT TTL is `30d` when checked, otherwise `12h`. Email is persisted in localStorage.