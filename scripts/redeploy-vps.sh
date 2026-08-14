#!/bin/bash
set -e
echo "=== extract ==="
ls -lh /tmp/attendance-deploy.tgz
cp /opt/attendance-tracking/server/.env /tmp/attendance.env.backup
tar -xzf /tmp/attendance-deploy.tgz -C /opt/attendance-tracking
cp /tmp/attendance.env.backup /opt/attendance-tracking/server/.env

# Ensure docker can reach host Postgres
sed -i 's#@127.0.0.1:5432/#@host.docker.internal:5432/#g' /opt/attendance-tracking/server/.env
# Prefer HTTPS domain (+ IP fallback) for CORS / Socket.IO
grep -q 'CLIENT_ORIGIN=' /opt/attendance-tracking/server/.env \
  && sed -i 's#^CLIENT_ORIGIN=.*#CLIENT_ORIGIN="https://www.rioassetmanagement.info,https://rioassetmanagement.info,https://attendance.rioassetmanagement.net,http://103.192.199.178:4001"#' /opt/attendance-tracking/server/.env
sed -i 's#^NODE_ENV=.*#NODE_ENV=production#' /opt/attendance-tracking/server/.env

# Local dev Postgres host port (avoid clash with host Postgres)
sed -i 's#"5432:5432"#"5437:5432"#g; s#"5436:5432"#"5437:5432"#g' /opt/attendance-tracking/docker-compose.yml

# Ensure FCM path is set (file itself is secret — must already be on host)
if ! grep -q '^FIREBASE_SERVICE_ACCOUNT_PATH=' /opt/attendance-tracking/server/.env; then
  echo 'FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json' >> /opt/attendance-tracking/server/.env
fi
if [ ! -f /opt/attendance-tracking/server/firebase-service-account.json ]; then
  echo "WARNING: missing /opt/attendance-tracking/server/firebase-service-account.json — parent push will be skipped"
fi

# Force port 4001 in compose
sed -i 's#"80:4000"#"4001:4000"#g; s#"8080:4000"#"4001:4000"#g; s#"\${PORT:-4000}:4000"#"4001:4000"#g; s#"4000:4000"#"4001:4000"#g' /opt/attendance-tracking/docker-compose.prod.yml

echo "=== verify new files ==="
ls -la /opt/attendance-tracking/src/assets/attendance-logo.png
ls -la /opt/attendance-tracking/server/src/lib/sms.js
ls -la /opt/attendance-tracking/server/src/lib/whatsapp.js
grep -n "Presence\|attendance-logo" /opt/attendance-tracking/src/components/LoginPage.jsx | head -5 || true
grep -n "SMS_PROVIDER\|sendSms" /opt/attendance-tracking/server/src/routes/attendance.js | head -5 || true

echo "=== rebuild (takes a few minutes) ==="
cd /opt/attendance-tracking
docker compose -f docker-compose.prod.yml up -d --build

sleep 8
echo "=== health ==="
curl -s http://127.0.0.1:4001/health || true
echo
docker compose -f docker-compose.prod.yml ps
docker logs bright-future-attendance --tail 25
