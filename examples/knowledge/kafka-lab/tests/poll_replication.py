#!/usr/bin/env python3
import argparse
import re
import subprocess
import time


def describe(args):
    result = subprocess.run(
        args.compose + ["-f", args.file, "exec", "-T", args.service,
         "/opt/kafka/bin/kafka-topics.sh", "--bootstrap-server", f"{args.service}:19092",
         "--topic", "lab-events", "--describe"],
        check=True, capture_output=True, text=True, timeout=8)
    with open(args.output, "w", encoding="utf-8") as output:
        output.write(result.stdout)
    return result.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output")
    parser.add_argument("rf", type=int)
    parser.add_argument("isr", type=int)
    parser.add_argument("absent", type=int, nargs="?")
    parser.add_argument("--compose", nargs="+", default=["docker", "compose"])
    parser.add_argument("--file", default="compose.multi.yaml")
    parser.add_argument("--service", default="kafka-2")
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()
    deadline = time.monotonic() + args.timeout
    pattern = re.compile(r"Replicas:\s*([0-9,]+)\s+Isr:\s*([0-9,]+)")
    while time.monotonic() < deadline:
        try:
            text = describe(args)
            rows = pattern.findall(text)
            if len(rows) == 1:
                replicas = [int(value) for value in rows[0][0].split(",")]
                isr = [int(value) for value in rows[0][1].split(",")]
                if (len(replicas) == args.rf and len(isr) == args.isr
                        and (args.absent is None or args.absent not in isr)):
                    print(f"PASS replicationFactor={len(replicas)} isr={isr}")
                    return
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            pass
        time.sleep(1)
    raise SystemExit("timed out waiting for expected replication/ISR state")


if __name__ == "__main__":
    main()
