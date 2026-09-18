#!/usr/bin/env python3
import sys
from inbox_format import read_inbox

if len(sys.argv) != 2:
    raise SystemExit("usage: count_inbox.py INBOX_FILE")
print(len(read_inbox(sys.argv[1])))
