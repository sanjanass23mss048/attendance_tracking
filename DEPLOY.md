# Deploy Bright Future Attendance (UI + API on one Node process)

One process serves the Vite `dist/` UI and Express `/api` + Socket.IO.
Point `DATABASE_URL` at the existing **Attendence** Postgres (do not wipe it).

## Browser URL (instead of localhost:5173)

After deploy, open:

**http://103.192.199.178:4000**

(or `http://YOUR_VPS_IP:4000`, or your domain if nginx terminates TLS on 80/443)

Health check: `http://103.192.199.178:4000/health`

---

## What was prepared in this repo

| Artifact | Purpose |
|----------|---------|
| `Dockerfile` | Multi-stage: build frontend, run Node server |
| `docker-compose.prod.yml` | Run `api` service; uses external Postgres |
| `server/src/index.js` | Serves `dist/` in production + SPA fallback |
| `vite.config.js` | Dev proxy for `/api` + `/socket.io` |
| Client `VITE_API_URL` | Empty in prod → same-origin `/api` |
| `server/.env.example` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `CLIENT_ORIGIN` |

---

## A. Docker on the VPS (recommended)

### 1. Copy the project to the VPS

From your machine (with SSH key set up):

```bash
# once: ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
# then: ssh-copy-id root@103.192.199.178

scp -r "d:\attendance tracking" root@103.192.199.178:/opt/attendance-tracking
```

Or clone from git if the repo is remote.

### 2. Configure `server/.env` on the VPS

```bash
cd /opt/attendance-tracking
cp server/.env.example server/.env
nano server/.env
```

Set at least:

```env
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/Attendence"
JWT_SECRET="a-long-random-secret"
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN="http://103.192.199.178:4000"
```

If Postgres is on the same host, use `127.0.0.1` (or the Docker host gateway).  
If Postgres only listens on the public IP, use that host — **do not** change/wipe the Attendence DB.

### 3. Build and run

```bash
cd /opt/attendance-tracking
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1:4000/health
```

Open **http://103.192.199.178:4000** in a browser.

### 4. Optional: nginx on port 80

```nginx
server {
  listen 80;
  server_name 103.192.199.178;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

Then set `CLIENT_ORIGIN=http://103.192.199.178` and browse **http://103.192.199.178**.

---

## B. Without Docker (Node on the VPS)

```bash
cd /opt/attendance-tracking
npm ci
npm run build
cd server && npm ci && npx prisma generate
# ensure server/.env has NODE_ENV=production and DATABASE_URL
npm start
# or: NODE_ENV=production node src/index.js
```

Keep it up with systemd or pm2:

```bash
cd /opt/attendance-tracking/server
pm2 start src/index.js --name attendance --env production
```

---

## C. Local production smoke test

```bash
# In server/.env: NODE_ENV=production, DATABASE_URL → Attendence
npm run build
cd server && npm start
# Open http://localhost:4000
```

Local **dev** (two processes):

```bash
# terminal 1
cd server && npm run dev

# terminal 2 — .env.local: VITE_USE_MOCK=false, VITE_API_URL= empty (proxy) or http://localhost:4000
npm run dev
# Open http://localhost:5173
```

---

# Deploy status from this environment

- SSH to `103.192.199.178`: **blocked** (no SSH keys; `Permission denied`)
- Docker / vercel / railway / flyctl / gh: **not installed** here

Artifacts above are ready; run section **A** on the VPS after adding an SSH key or logging in via panel console.

## Firewall

Ensure TCP **4000** (or **80** if using nginx) is open on the VPS security group / `ufw`.
