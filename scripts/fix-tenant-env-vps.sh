#!/bin/bash
set -e
ENV=/opt/attendance-tracking/server/.env
python3 <<'PY'
from pathlib import Path
import re
p = Path("/opt/attendance-tracking/server/.env")
lines = p.read_text().splitlines()
out = []
tenant_set = False
main_set = False
for line in lines:
    if line.startswith("TENANT_DATABASE_URL="):
        continue
    if line.startswith("MAIN_DOMAIN="):
        out.append("MAIN_DOMAIN=rioassetmanagement.info")
        main_set = True
        continue
    if line.startswith("DATABASE_URL="):
        db = line.split("=", 1)[1].strip().strip('"')
        tenant = db.replace("/Attendence", "/Attendence_Tenants", 1)
        out.append(f'TENANT_DATABASE_URL="{tenant}"')
        tenant_set = True
    out.append(line)
if not tenant_set:
    raise SystemExit("DATABASE_URL missing")
if not main_set:
    out.append("MAIN_DOMAIN=rioassetmanagement.info")
p.write_text("\n".join(out) + "\n")
for line in out:
    if line.startswith(("DATABASE_URL=", "TENANT_DATABASE_URL=", "MAIN_DOMAIN=")):
        print(re.sub(r":[^:@]*@", ":***@", line))
PY

cd /opt/attendance-tracking
docker compose -f docker-compose.prod.yml up -d --force-recreate

sleep 10
echo "=== verify ==="
curl -sk https://rioassetmanagement.info/health
echo
curl -sk -X POST https://rioassetmanagement.info/api/setup/check-slug -H "Content-Type: application/json" -d '{"slug":"test"}'
echo
curl -sk https://test.rioassetmanagement.info/api/tenant
echo
docker logs bright-future-attendance --tail 10 2>&1
