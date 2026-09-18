"""Deterministic compound-state race demonstrations for CPython builds."""
from __future__ import annotations

import argparse
import sys
import sysconfig
import threading
from dataclasses import dataclass


@dataclass
class Gate:
    """Two-phase gate used to force both workers between read and write."""

    reads: threading.Barrier
    writes: threading.Barrier


class Counter:
    def __init__(self) -> None:
        self.value = 0
        self.lock = threading.Lock()

    def unsafe_add(self, gate: Gate) -> None:
        observed = self.value
        gate.reads.wait()
        gate.writes.wait()
        self.value = observed + 1

    def safe_add(self, gate: Gate) -> None:
        del gate
        with self.lock:
            self.value += 1


def gil_status() -> tuple[object, object, object]:
    supports = sysconfig.get_config_var("Py_GIL_DISABLED")
    enabled_fn = getattr(sys, "_is_gil_enabled", None)
    enabled = enabled_fn() if enabled_fn is not None else "unavailable"
    return supports, enabled, sys.version.split()[0]


def run(safe: bool) -> tuple[int, int]:
    counter = Counter()
    gate = Gate(threading.Barrier(2, timeout=5), threading.Barrier(2, timeout=5))
    operation = counter.safe_add if safe else counter.unsafe_add
    failures = []
    failure_lock = threading.Lock()
    def invoke():
        try:
            operation(gate)
        except BaseException as error:
            with failure_lock:
                failures.append(error)
    workers = [threading.Thread(target=invoke, name=f"worker-{i}", daemon=True) for i in range(2)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=10)
        if worker.is_alive():
            raise RuntimeError("worker did not terminate")
    if failures:
        raise RuntimeError("worker failed") from failures[0]
    expected = 2
    return counter.value, expected


def main() -> int:
    parser = argparse.ArgumentParser(description="Show why a compound update needs a lock.")
    parser.add_argument("--safe", action="store_true", help="protect the entire compound operation")
    args = parser.parse_args()
    value, expected = run(args.safe)
    supports, enabled, version = gil_status()
    print(f"python={version} free_threaded_build={supports!r} gil_enabled={enabled!r}")
    print(f"mode={'safe' if args.safe else 'unsafe'} actual={value} expected={expected}")
    if args.safe and value != expected:
        raise AssertionError("locked compound update lost an increment")
    if not args.safe and value != 1:
        raise AssertionError("deterministic schedule did not expose the unsafe update")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
