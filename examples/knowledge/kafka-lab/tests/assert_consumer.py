#!/usr/bin/env python3
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: assert_consumer.py LOG killed|restarted")
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
mode = sys.argv[2]
if mode == "killed":
    if "KILL_BEFORE_COMMIT eventId=evt-2" not in text:
        raise SystemExit("consumer kill marker missing")
elif mode == "restarted":
    replayed = set(re.findall(r"eventId=(evt-\d+) .*inboxApplied=false", text))
    if "evt-2" not in replayed:
        raise SystemExit(f"expected evt-2 replay, observed {sorted(replayed)}")
    if not re.search(r"eventId=evt-2 .*inboxApplied=false", text):
        raise SystemExit("evt-2 replay was not marked inboxApplied=false")
else:
    raise SystemExit("mode must be killed or restarted")
print(f"PASS consumer {mode} assertions")
