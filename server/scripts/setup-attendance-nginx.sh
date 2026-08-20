#!/bin/bash
set -euo pipefail

CONF=/root/alm-main/nginx/nginx-ssl.conf
cp -a "$CONF" "${CONF}.bak.$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
from pathlib import Path
path = Path("/root/alm-main/nginx/nginx-ssl.conf")
text = path.read_text()
marker = "# ---------------------------\n# TENANT ALM (apex + wildcard)"
block = """
# ---------------------------
# ATTENDANCE (rioassetmanagement.info)
# ---------------------------

server {
    listen 80;
    listen [::]:80;
    server_name rioassetmanagement.info www.rioassetmanagement.info *.rioassetmanagement.info;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name rioassetmanagement.info www.rioassetmanagement.info *.rioassetmanagement.info;

    ssl_certificate     /etc/nginx/ssl/fullchain-wildcard.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey-wildcard.pem;

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
}

"""
if "rioassetmanagement.info" in text and "*.rioassetmanagement.info" in text:
    print("ALREADY_PRESENT")
else:
    if marker not in text:
        raise SystemExit("MARKER_NOT_FOUND")
    path.write_text(text.replace(marker, block + marker, 1))
    print("INSERTED")
PY

docker exec alm_nginx nginx -t
docker exec alm_nginx nginx -s reload
echo NGINX_RELOADED

cd /opt/attendance-tracking
sed -i 's|^CLIENT_ORIGIN=.*|CLIENT_ORIGIN="https://www.rioassetmanagement.info,https://rioassetmanagement.info,https://attendance.rioassetmanagement.net,http://103.192.199.178:4001"|' server/.env
grep '^CLIENT_ORIGIN=' server/.env || true
grep -q '^MAIN_DOMAIN=' server/.env || echo 'MAIN_DOMAIN=rioassetmanagement.info' >> server/.env
grep '^MAIN_DOMAIN=' server/.env
docker-compose -f docker-compose.prod.yml up -d
sleep 2
curl -sk -m 8 https://www.rioassetmanagement.info/health || true
echo
curl -sk -m 5 -H 'Host: www.rioassetmanagement.info' https://127.0.0.1/health
echo
