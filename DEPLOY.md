# Deploy Presence (UI + API on one Node process)

**Standing instruction for every production deploy:** ship this app so users open **https://www.rioassetmanagement.info** (include `www`). Do not advertise only `attendance.rioassetmanagement.net` or the VPS IP as the public URL.

| Host | Role |
|------|------|
| **https://www.rioassetmanagement.info** | Canonical production URL (use this) |
| https://rioassetmanagement.info | Apex; same app (keep working; do not require users to use this) |
| `{slug}.rioassetmanagement.info` | School tenant subdomains |
| https://attendance.rioassetmanagement.net | Legacy hostname; still proxied to the same container |
| http://103.192.199.178:4001 | Direct container port (ops / fallback, not the public URL) |

Health: **https://www.rioassetmanagement.info/health**

One process serves the Vite `dist/` UI and Express `/api` + Socket.IO. Point `DATABASE_URL` at the existing **Attendence** Postgres (do not wipe it).

---

## What was prepared in this repo

| Artifact | Purpose |
|----------|---------|
| `Dockerfile` | Multi-stage: build frontend, run Node server |
| `docker-compose.prod.yml` | Run `api` service; uses external Postgres |
| `scripts/redeploy-vps.sh` | On-VPS extract + rebuild; sets CORS including www |
| `server/scripts/setup-attendance-nginx.sh` | Insert/reload nginx vhost for `*.rioassetmanagement.info` |
| `server/src/index.js` | Serves `dist/` in production + SPA fallback |
| `vite.config.js` | Dev proxy for `/api` + `/socket.io` |
| Client `VITE_API_URL` | Empty in prod — same-origin `/api` |
| `server/.env.example` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `CLIENT_ORIGIN`, `MAIN_DOMAIN` |

Typical ship path from a Windows machine (tarball, not GitHub Actions):

```bash
# from the repo root, after packing a tarball to /tmp/attendance-deploy.tgz on the VPS:
ssh root@103.192.199.178 "bash /opt/attendance-tracking/scripts/redeploy-vps.sh"
```

Then verify **https://www.rioassetmanagement.info** and `/health`.

---

## VPS nginx (already live)

Nginx container `alm_nginx` terminates TLS on 80/443.

- **`.info` (this app):** `/root/alm-main/nginx/rioassetmanagement.info.conf` mounted as `/etc/nginx/conf.d/rioassetmanagement.info.conf`
  - `server_name rioassetmanagement.info www.rioassetmanagement.info *.rioassetmanagement.info`
  - `proxy_pass http://172.17.0.1:4001` (host port mapped to the attendance container)
  - TLS: `/etc/nginx/ssl/fullchain-info.pem` + `privkey-info.pem`
- **`.net` (ALM + legacy attendance host):** `/root/alm-main/nginx/nginx-ssl.conf` → `conf.d/default.conf`
  - `attendance.rioassetmanagement.net` also proxies to `172.17.0.1:4001`
  - Do **not** put `rioassetmanagement.info` names on the ALM `*.rioassetmanagement.net` block

HTTP on `.info` redirects to HTTPS. After changing nginx:

```bash
docker exec alm_nginx nginx -t && docker exec alm_nginx nginx -s reload
```

If the `.info` vhost is missing, run `server/scripts/setup-attendance-nginx.sh` on the VPS (it inserts a matching server block and reloads nginx). Do not remove the working `.net` attendance server_name.

`CLIENT_ORIGIN` on the VPS must include the canonical host (and keep legacy hosts so existing clients keep working):

```env
CLIENT_ORIGIN="https://www.rioassetmanagement.info,https://rioassetmanagement.info,https://attendance.rioassetmanagement.net,http://103.192.199.178:4001"
MAIN_DOMAIN=rioassetmanagement.info
APP_PUBLIC_URL=https://www.rioassetmanagement.info
```

`MAIN_DOMAIN` stays `rioassetmanagement.info` (no `www`) so tenant hosts remain `{slug}.rioassetmanagement.info`. `www` is reserved and treated as the apex tenant.

---

## A. Docker on the VPS (recommended)

### 1. Copy the project to the VPS

From your machine (with SSH key set up):

```bash
scp -r "d:\attendance tracking" root@103.192.199.178:/opt/attendance-tracking
```

Prefer a tarball over recursive scp of `node_modules`. Or clone from git if the repo is remote.

### 2. Configure `server/.env` on the VPS

```bash
cd /opt/attendance-tracking
cp server/.env.example server/.env
nano server/.env
```

Set at least:

```env
DATABASE_URL="postgresql://USER:PASSWORD@host.docker.internal:5432/Attendence"
JWT_SECRET="a-long-random-secret"
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN="https://www.rioassetmanagement.info,https://rioassetmanagement.info,https://attendance.rioassetmanagement.net,http://103.192.199.178:4001"
MAIN_DOMAIN=rioassetmanagement.info
APP_PUBLIC_URL=https://www.rioassetmanagement.info
```

If Postgres is on the same host, Docker uses `host.docker.internal` (see `scripts/redeploy-vps.sh`). **Do not** change/wipe the Attendence DB.

### 3. Build and run

```bash
cd /opt/attendance-tracking
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1:4001/health
curl -sk https://www.rioassetmanagement.info/health
```

Open **https://www.rioassetmanagement.info** in a browser.

Host port is **4001** → container 4000 (compose maps `"4001:4000"`).

### 4. nginx on 80/443

See **VPS nginx** above. After nginx is in place, browse **https://www.rioassetmanagement.info**, not `:4001`.

---

## B. Without Docker (Node on the VPS)

```bash
cd /opt/attendance-tracking
npm ci
npm run build
cd server && npm ci && npx prisma generate
# ensure server/.env has NODE_ENV=production and DATABASE_URL
npm start
```

Keep it up with systemd or pm2. Still put nginx in front so the public URL is HTTPS on www.

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

## Firewall

Ensure TCP **80** and **443** are open (nginx). Port **4001** is optional for direct ops access.
