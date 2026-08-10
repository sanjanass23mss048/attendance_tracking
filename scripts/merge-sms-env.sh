#!/bin/bash
set -e
ENV=/opt/attendance-tracking/server/.env
SMS=/tmp/attendance-sms.env
grep -v '^SMS_' "$ENV" > /tmp/attendance.env.nosms
cat /tmp/attendance.env.nosms > "$ENV"
printf '\n' >> "$ENV"
sed 's/\r$//' "$SMS" >> "$ENV"
echo "SMS keys:"
grep '^SMS_' "$ENV" | cut -d= -f1
cd /opt/attendance-tracking
docker compose -f docker-compose.prod.yml up -d --force-recreate
sleep 6
curl -s http://127.0.0.1:4001/health
echo
docker exec bright-future-attendance sh -c "printenv | grep '^SMS_' | cut -d= -f1" || true
