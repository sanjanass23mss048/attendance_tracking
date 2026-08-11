#!/bin/bash
set -euo pipefail

ENV_FILE=/opt/attendance-tracking/server/.env

echo "=== patch DATABASE_URL connection_limit ==="
python3 - <<'PY'
from pathlib import Path
import re
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

path = Path("/opt/attendance-tracking/server/.env")
text = path.read_text()
m = re.search(r'^DATABASE_URL=(.*)$', text, re.M)
if not m:
    raise SystemExit("DATABASE_URL missing")
raw = m.group(1).strip().strip('"').strip("'")
u = urlparse(raw)
q = dict(parse_qsl(u.query, keep_blank_values=True))
q["connection_limit"] = "5"
q["pool_timeout"] = "20"
new = urlunparse(u._replace(query=urlencode(q)))
quoted = f'DATABASE_URL="{new}"'
text2, n = re.subn(r'^DATABASE_URL=.*$', quoted, text, count=1, flags=re.M)
if n != 1:
    raise SystemExit("failed to rewrite DATABASE_URL")
path.write_text(text2)
redacted = re.sub(r"://([^:/]+):([^@]+)@", r"://\1:***@", new)
print("DATABASE_URL =>", redacted)
PY

echo "=== restart attendance container ==="
cd /opt/attendance-tracking
docker compose -f docker-compose.prod.yml up -d --force-recreate
sleep 8

echo "=== health ==="
curl -s http://127.0.0.1:4001/health || true
echo
curl -sk -m 10 https://attendance.rioassetmanagement.net/health || true
echo
docker logs bright-future-attendance --tail 20
