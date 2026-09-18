#!/usr/bin/env python3
import re
import sys


def main():
    if len(sys.argv) not in (4, 5):
        raise SystemExit("usage: assert_replication.py DESCRIBE RF EXACT_ISR [ABSENT_BROKER]")
    text = open(sys.argv[1], encoding="utf-8").read()
    expected_rf = int(sys.argv[2])
    expected_isr = int(sys.argv[3])
    absent = int(sys.argv[4]) if len(sys.argv) == 5 else None
    rows = re.findall(r"Replicas:\s*([0-9,]+)\s+Isr:\s*([0-9,]+)", text)
    if len(rows) != 1:
        raise SystemExit(f"expected one topic partition description, found {len(rows)}")
    replicas, isr = ([int(value) for value in field.split(",")] for field in rows[0])
    if len(replicas) != expected_rf:
        raise SystemExit(f"replication factor {len(replicas)} != {expected_rf}")
    if len(isr) != expected_isr:
        raise SystemExit(f"ISR size {len(isr)} != expected {expected_isr}")
    if absent is not None and absent in isr:
        raise SystemExit(f"broker {absent} is still in ISR after stop")
    print(f"PASS replicationFactor={len(replicas)} isr={isr}")


if __name__ == "__main__":
    main()
