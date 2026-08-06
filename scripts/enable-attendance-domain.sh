#!/bin/bash
set -euo pipefail

CONF=/root/alm-main/nginx/nginx-ssl.conf
cp -a "$CONF" "${CONF}.bak.attendance.$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
from pathlib import Path

path = Path("/root/alm-main/nginx/nginx-ssl.conf")
text = path.read_text()

# Point all attendance proxies at host port 4001
updated = text.replace(
    "server_name attendance.rioassetmanagement.net;\n\n    client_max_body_size 20m;\n\n    location / {\n        proxy_pass http://172.17.0.1:4000;",
    "server_name attendance.rioassetmanagement.net;\n\n    client_max_body_size 20m;\n\n    location / {\n        proxy_pass http://172.17.0.1:4001;",
)
updated = updated.replace(
    "server_name attendance.rioassetmanagement.net;\n\n    ssl_certificate     /etc/nginx/ssl/fullchain-wildcard.pem;\n    ssl_certificate_key /etc/nginx/ssl/privkey-wildcard.pem;\n\n    client_max_body_size 20m;\n\n    location / {\n        proxy_pass http://172.17.0.1:4000;",
    "server_name attendance.rioassetmanagement.net;\n\n    ssl_certificate     /etc/nginx/ssl/fullchain-wildcard.pem;\n    ssl_certificate_key /etc/nginx/ssl/privkey-wildcard.pem;\n\n    client_max_body_size 20m;\n\n    location / {\n        proxy_pass http://172.17.0.1:4001;",
)

# Prefer HTTPS redirect on port 80 if still proxying HTTP
http_proxy = """server {
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
http_redirect = """server {
    listen 80;
    listen [::]:80;
    server_name attendance.rioassetmanagement.net;
    return 301 https://$host$request_uri;
}"""

if http_proxy in updated:
    updated = updated.replace(http_proxy, http_redirect, 1)
    print("HTTP_REDIRECT_SET")
elif "attendance.rioassetmanagement.net;\n    return 301 https://" in updated:
    print("HTTP_REDIRECT_ALREADY")
else:
    print("HTTP_BLOCK_CHECK_MANUAL")

if "proxy_pass http://172.17.0.1:4001;" not in updated:
    # fallback: replace any remaining 4000 under attendance context via simple global for attendance blocks only
    raise SystemExit("PROXY_4001_NOT_SET")

if updated == text:
    print("NO_TEXT_CHANGE")
else:
    path.write_text(updated)
    print("NGINX_UPDATED")
PY

docker exec alm_nginx nginx -t
docker exec alm_nginx nginx -s reload
echo NGINX_RELOADED

ENV_FILE=/opt/attendance-tracking/server/.env
sed -i 's|^CLIENT_ORIGIN=.*|CLIENT_ORIGIN="https://attendance.rioassetmanagement.net,http://103.192.199.178:4001"|' "$ENV_FILE"
grep '^CLIENT_ORIGIN=' "$ENV_FILE"

docker restart bright-future-attendance
sleep 6

echo "=== health ==="
curl -sk -m 10 https://attendance.rioassetmanagement.net/health || true
echo
curl -sk -m 10 -o /dev/null -w "https_root:%{http_code}\n" https://attendance.rioassetmanagement.net/
curl -sI -m 8 http://attendance.rioassetmanagement.net/ | head -n 5
docker logs bright-future-attendance --tail 10
