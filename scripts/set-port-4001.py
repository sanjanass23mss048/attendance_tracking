#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import time

compose = Path("/opt/attendance-tracking/docker-compose.prod.yml")
text = compose.read_text()
text = re.sub(r'-\s*"[^"]+:4000"', '- "4001:4000"', text)
compose.write_text(text)
print("Ports section:")
print("\n".join(line for line in compose.read_text().splitlines() if "ports" in line or "4001" in line or ":4000" in line))

subprocess.check_call(
    ["docker", "compose", "-f", "docker-compose.prod.yml", "up", "-d"],
    cwd="/opt/attendance-tracking",
)
time.sleep(5)
r = subprocess.run(["curl", "-s", "http://127.0.0.1:4001/health"], capture_output=True, text=True)
print("health:", r.stdout or r.stderr)
subprocess.check_call(
    ["docker", "compose", "-f", "docker-compose.prod.yml", "ps"],
    cwd="/opt/attendance-tracking",
)
