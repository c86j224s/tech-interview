#!/usr/bin/env python3
"""Bounded, dependency-free CPU scheduling reference lab.

This models one CPU and finite jobs. It is not a Linux scheduler adapter.
"""
from __future__ import annotations

import argparse
import unittest
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple


@dataclass(frozen=True)
class Job:
    name: str
    arrival: int
    burst: int
    priority: int = 0


@dataclass(frozen=True)
class Segment:
    start: int
    end: int
    job: Optional[str]


@dataclass(frozen=True)
class Metrics:
    completion: int
    turnaround: int
    waiting: int
    response: int


class SimulationError(ValueError):
    pass


def validate_jobs(jobs: Sequence[Job], quantum: Optional[int] = None) -> Tuple[Job, ...]:
    if not jobs or len(jobs) > 1000:
        raise SimulationError("jobs must contain 1..1000 items")
    names = [j.name for j in jobs]
    if len(set(names)) != len(names) or any(not n for n in names):
        raise SimulationError("job names must be non-empty and unique")
    for job in jobs:
        if any(type(value) is not int for value in (job.arrival, job.burst, job.priority)):
            raise SimulationError("arrival, burst and priority must be integers")
        if job.arrival < 0 or job.burst <= 0 or job.burst > 1_000_000:
            raise SimulationError("arrival >= 0 and burst must be 1..1000000")
    if quantum is not None and (type(quantum) is not int or quantum <= 0):
        raise SimulationError("quantum must be positive")
    if sum(job.burst for job in jobs) > 100_000:
        raise SimulationError("total burst must not exceed 100000 ticks")
    return tuple(jobs)


def _append(segments: List[Segment], start: int, end: int, name: Optional[str]) -> None:
    if end <= start:
        return
    if segments and segments[-1].job == name and segments[-1].end == start:
        segments[-1] = Segment(segments[-1].start, end, name)
    else:
        segments.append(Segment(start, end, name))


def simulate(jobs: Sequence[Job], policy: str, quantum: int = 1, aging: bool = False) -> Tuple[List[Segment], Dict[str, Metrics]]:
    jobs = validate_jobs(jobs, quantum if policy == "rr" else None)
    if policy not in {"fcfs", "sjf", "srtf", "rr", "priority"}:
        raise SimulationError("unknown policy")
    remaining = {j.name: j.burst for j in jobs}
    first_start: Dict[str, int] = {}
    completion: Dict[str, int] = {}
    by_name = {j.name: j for j in jobs}
    ready: List[str] = []
    segments: List[Segment] = []
    time = 0
    sequence = {j.name: i for i, j in enumerate(jobs)}
    arrived = set()

    def admit() -> None:
        for job in sorted(jobs, key=lambda job: (job.arrival, sequence[job.name])):
            if job.name not in arrived and job.arrival <= time:
                ready.append(job.name)
                arrived.add(job.name)

    def choose() -> str:
        if policy == "fcfs":
            return min(ready, key=lambda n: (by_name[n].arrival, sequence[n]))
        if policy == "sjf":
            return min(ready, key=lambda n: (by_name[n].burst, by_name[n].arrival, sequence[n]))
        if policy == "srtf":
            return min(ready, key=lambda n: (remaining[n], by_name[n].arrival, sequence[n]))
        if policy == "priority":
            def rank(n: str) -> Tuple[int, int, int]:
                waited = max(0, time - by_name[n].arrival)
                effective = by_name[n].priority - (waited // 3 if aging else 0)
                return (effective, by_name[n].arrival, sequence[n])
            return min(ready, key=rank)
        return ready[0]

    while len(completion) < len(jobs):
        admit()
        if not ready:
            next_arrival = min(j.arrival for j in jobs if j.name not in arrived)
            _append(segments, time, next_arrival, None)
            time = next_arrival
            continue
        name = choose()
        ready.remove(name)
        run_for = remaining[name]
        if policy == "rr":
            run_for = min(run_for, quantum)
        elif policy == "srtf":
            future = [j.arrival for j in jobs if j.name not in arrived and j.arrival < time + run_for]
            if future:
                run_for = min(run_for, min(future) - time)
        _append(segments, time, time + run_for, name)
        first_start.setdefault(name, time)
        time += run_for
        remaining[name] -= run_for
        admit()
        if remaining[name] == 0:
            completion[name] = time
        else:
            ready.append(name)

    metrics = {}
    for job in jobs:
        end = completion[job.name]
        metrics[job.name] = Metrics(end, end - job.arrival, end - job.arrival - job.burst, first_start[job.name] - job.arrival)
    return segments, metrics


def render(segments: Sequence[Segment], metrics: Dict[str, Metrics]) -> None:
    print("timeline:", " | ".join("idle" if s.job is None else s.job + "[{}-{}]".format(s.start, s.end) for s in segments))
    for name in metrics:
        m = metrics[name]
        print("{} completion={} turnaround={} waiting={} response={}".format(name, m.completion, m.turnaround, m.waiting, m.response))


class SchedulerTests(unittest.TestCase):
    jobs = (Job("A", 0, 8), Job("B", 1, 4), Job("C", 2, 2))

    def test_fcfs_metrics(self):
        _, m = simulate(self.jobs, "fcfs")
        self.assertEqual(m["A"], Metrics(8, 8, 0, 0))
        self.assertEqual(m["B"], Metrics(12, 11, 7, 7))
        self.assertEqual(m["C"], Metrics(14, 12, 10, 10))

    def test_sjf_and_srtf_differ_on_arrival(self):
        _, sjf = simulate(self.jobs, "sjf")
        _, srtf = simulate(self.jobs, "srtf")
        self.assertEqual([sjf[n].completion for n in ("A", "B", "C")], [8, 14, 10])
        self.assertEqual([srtf[n].completion for n in ("A", "B", "C")], [14, 7, 4])

    def test_rr_response_and_turnaround(self):
        _, m = simulate(self.jobs, "rr", quantum=2)
        self.assertEqual(m["B"].response, 1)
        self.assertEqual(m["A"].turnaround, 14)
        self.assertEqual(sum(v.waiting + by.burst for v, by in zip(m.values(), self.jobs)), 27)

    def test_priority_aging_changes_choice(self):
        jobs = (Job("long", 0, 5, 5), Job("short", 0, 3, 0), Job("late", 3, 1, 4))
        _, no_aging = simulate(jobs, "priority", aging=False)
        _, with_aging = simulate(jobs, "priority", aging=True)
        self.assertGreater(no_aging["long"].completion, with_aging["long"].completion)

    def test_invalid_and_idle(self):
        with self.assertRaises(SimulationError):
            simulate((Job("A", 0, 1),), "rr", quantum=0)
        segments, metrics = simulate((Job("A", 3, 1),), "fcfs")
        self.assertEqual(segments[0], Segment(0, 3, None))
        self.assertEqual(metrics["A"].response, 0)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test", action="store_true")
    parser.add_argument("--policy", choices=("fcfs", "sjf", "srtf", "rr", "priority"), default="rr")
    parser.add_argument("--quantum", type=int, default=2)
    args = parser.parse_args(argv)
    if args.test:
        result = unittest.main(module=__name__, argv=[__file__], verbosity=2, exit=False)
        return 0 if result.result.wasSuccessful() else 1
    render(*simulate((Job("A", 0, 8), Job("B", 1, 4), Job("C", 2, 2)), args.policy, args.quantum))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
