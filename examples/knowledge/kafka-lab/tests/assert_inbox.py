#!/usr/bin/env python3
import sys
from inbox_format import read_inbox

if len(sys.argv) != 3:
    raise SystemExit("usage: assert_inbox.py INBOX_FILE EXPECTED_COUNT")
records = read_inbox(sys.argv[1])
expected = int(sys.argv[2])
if records != {f"evt-{i}": f"amount={i + 1}" for i in range(expected)}:
    raise SystemExit(f"inbox does not contain the exact {expected} event payloads")
print(f"PASS inbox events={len(records)} unique IDs and payloads preserved")
