#!/bin/bash
set -e
cd /opt/attendance-tracking
docker compose -f docker-compose.prod.yml up -d --force-recreate
sleep 6
echo "=== health ==="
curl -s http://127.0.0.1:4001/health || true
echo
echo "=== logs ==="
docker logs bright-future-attendance --tail 40
echo "=== db test ==="
docker exec bright-future-attendance node --input-type=module -e '
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
try {
  const u = await p.tblUsers.findFirst({ select: { email: true } });
  console.log("DB OK", u);
} catch (e) {
  console.error("DB FAIL", e.message);
  process.exitCode = 1;
} finally {
  await p["$disconnect"]();
}
'
