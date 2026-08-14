#!/bin/bash
EMAIL="sanjanasenthilkumar11@gmail.com"
BASE="https://st-josephs.rioassetmanagement.info/api/auth/login"
for pw in Initial1 password123 PASSWORD123; do
  echo -n "$pw: "
  curl -sk -X POST "$BASE" -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$pw\"}"
  echo
done
PGPASSWORD='Kovai1252*' psql -h 127.0.0.1 -p 5432 -U postgres -d st_josephs_attdb \
  -c 'SELECT user_id, email, name, role_id FROM "tblUsers";'
