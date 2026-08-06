#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("/opt/attendance-tracking/docker-compose.prod.yml")
text = p.read_text()
text = re.sub(r'-\s*"[^"]+:4000"', '- "8080:4000"', text)
p.write_text(text)
print("Updated ports:")
for line in p.read_text().splitlines():
    if "ports" in line or "8080" in line or "4000" in line:
        print(line)
