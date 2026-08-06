#!/bin/bash
set -euo pipefail
ENV=/opt/attendance-tracking/server/.env
python3 -c "
from pathlib import Path
p = Path('/opt/attendance-tracking/server/.env')
val = 'CLIENT_ORIGIN=\"https://attendance.rioassetmanagement.net,http://103.192.199.178:4001\"'
lines = p.read_text().splitlines()
out, found = [], False
for line in lines:
    if line.startswith('CLIENT_ORIGIN='):
        out.append(val); found = True
    else:
        out.append(line)
if not found:
    out.append(val)
p.write_text('\\n'.join(out) + '\\n')
print(val)
"
cd /opt/attendance-tracking
docker compose -f docker-compose.prod.yml up -d --force-recreate
sleep 5
docker logs bright-future-attendance --tail 5
