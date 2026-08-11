#!/bin/bash
set -euo pipefail

echo "=== env connection_limit ==="
grep '^DATABASE_URL=' /opt/attendance-tracking/server/.env | sed -E 's#://([^:/]+):([^@]+)@#://\1:***@#'
echo
docker exec bright-future-attendance printenv DATABASE_URL | sed -E 's#://([^:/]+):([^@]+)@#://\1:***@#' || true

echo "=== locate Attendence postgres ==="
# Host postgres?
if command -v psql >/dev/null 2>&1; then
  echo "host psql present"
fi
ss -lntp | grep ':5432' || netstat -lntp 2>/dev/null | grep ':5432' || true

echo "=== docker postgres-ish ==="
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '5432|postgres|db' || true

# Try common containers with password from env if needed
DBURL=$(grep '^DATABASE_URL=' /opt/attendance-tracking/server/.env | cut -d= -f2- | tr -d '"')
# parse user/pass/db
USER=$(python3 - <<PY
from urllib.parse import urlparse
u=urlparse('''$DBURL''')
print(u.username or '')
PY
)
PASS=$(python3 - <<PY
from urllib.parse import urlparse, unquote
u=urlparse('''$DBURL''')
print(unquote(u.password or ''))
PY
)
DB=$(python3 - <<PY
from urllib.parse import urlparse
u=urlparse('''$DBURL''')
print((u.path or '/').lstrip('/') )
PY
)
echo "db=$DB user=$USER"

export PGPASSWORD="$PASS"

try_psql() {
  local host="$1"
  echo "-- trying $host --"
  psql -h "$host" -U "$USER" -d "$DB" -c "SELECT current_setting('max_connections') AS max_conn, count(*) AS used FROM pg_stat_activity;" 2>&1 | head -20
}

# From inside attendance container
docker exec -e PGPASSWORD="$PASS" bright-future-attendance bash -lc '
  apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq postgresql-client >/dev/null 2>&1 || true
  if command -v psql >/dev/null; then
    psql -h host.docker.internal -U "'"$USER"'" -d "'"$DB"'" -c "SELECT current_setting('\''max_connections'\'') AS max_conn, count(*) AS used FROM pg_stat_activity;"
    psql -h host.docker.internal -U "'"$USER"'" -d "'"$DB"'" -c "SELECT datname, state, count(*) FROM pg_stat_activity GROUP BY 1,2 ORDER BY 3 DESC LIMIT 30;"
    echo "=== terminate idle > 1min ==="
    psql -h host.docker.internal -U "'"$USER"'" -d "'"$DB"'" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IS NOT NULL AND pid <> pg_backend_pid() AND state = '\''idle'\'' AND state_change < now() - interval '\''1 minute'\'';"
    echo "=== after ==="
    psql -h host.docker.internal -U "'"$USER"'" -d "'"$DB"'" -c "SELECT current_setting('\''max_connections'\'') AS max_conn, count(*) AS used FROM pg_stat_activity;"
  else
    echo "psql not available in container"
  fi
' || true
