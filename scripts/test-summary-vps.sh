#!/bin/bash
set -euo pipefail

login() {
  local email="$1" pass="$2"
  curl -s -m 15 -X POST http://127.0.0.1:4001/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}"
}

RESP=$(login "incharge@brightfuture.edu" "password123" || true)
TOKEN=$(printf '%s' "$RESP" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get("token") or d.get("accessToken") or "")
except Exception:
  print("")')

if [ -z "$TOKEN" ]; then
  echo "login_resp=$RESP"
  RESP=$(login "admin@school.local" "admin123" || true)
  TOKEN=$(printf '%s' "$RESP" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get("token") or d.get("accessToken") or "")
except Exception:
  print("")')
fi

echo "token_len=${#TOKEN}"
CODE=$(curl -s -m 15 -o /tmp/summary.json -w "%{http_code}" \
  "http://127.0.0.1:4001/api/attendance/summary?date=2026-08-11" \
  -H "Authorization: Bearer $TOKEN")
echo "summary_http=$CODE"
head -c 500 /tmp/summary.json; echo
echo "=== recent errors ==="
docker logs bright-future-attendance --tail 40 2>&1 | grep -iE "too many|P2037|summary|Internal" | tail -20 || echo none
