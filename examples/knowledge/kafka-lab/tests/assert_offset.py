#!/usr/bin/env python3
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: assert_offset.py LOG EXPECTED_OFFSET")
text = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r"group=lab-inbox partition=0 offset=(\d+)", text)
if not match:
    raise SystemExit("broker group offset evidence missing")
actual = int(match.group(1))
expected = int(sys.argv[2])
if actual != expected:
    raise SystemExit(f"group offset {actual} != expected {expected}")
print(f"PASS groupOffset={actual}")
