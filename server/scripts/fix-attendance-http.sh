#!/bin/bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
p = Path('/root/alm-main/nginx/nginx-ssl.conf')
t = p.read_text()
old = """server {
    listen 80;
    listen [::]:80;
    server_name attendance.rioassetmanagement.net;
    return 301 https://$host$request_uri;
}"""
new = """server {
    listen 80;
    listen [::]:80;
    server_name attendance.rioassetmanagement.net;

    client_max_body_size 20m;

    location / {
        proxy_pass http://172.17.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 86400;
    }
}"""
if old not in t:
    raise SystemExit('BLOCK_NOT_FOUND')
p.write_text(t.replace(old, new, 1))
print('UPDATED')
PY
docker exec alm_nginx nginx -t
docker exec alm_nginx nginx -s reload
cd /opt/attendance-tracking
sed -i 's|^CLIENT_ORIGIN=.*|CLIENT_ORIGIN="http://attendance.rioassetmanagement.net"|' server/.env
docker restart bright-future-attendance
sleep 3
curl -s -m 5 -H 'Host: attendance.rioassetmanagement.net' http://127.0.0.1/health
echo
