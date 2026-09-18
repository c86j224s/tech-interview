#!/usr/bin/env python3
"""Executable comparison-sorting lab with traces, contracts, tests, and benchmarks."""

from __future__ import annotations

import argparse
import itertools
import time
import unittest
from collections import Counter
from dataclasses import dataclass
from typing import Callable, Dict, Iterable, List, Sequence, Tuple


T = object
Comparator = Callable[[object, object], int]


class ComparatorError(ValueError):
    """The comparator does not satisfy the requested ordering contract."""


class SortContractError(AssertionError):
    """A sorting result violates an observable result contract."""


@dataclass
class Stats:
    comparisons: int = 0
    writes: int = 0


@dataclass
class TraceStep:
    event: str
    array: List[object]
    detail: str


class CountingComparator:
    def __init__(self, comparator: Comparator, stats: Stats):
        self.comparator = comparator
        self.stats = stats

    def __call__(self, left: object, right: object) -> int:
        self.stats.comparisons += 1
        value = self.comparator(left, right)
        if value < 0:
            return -1
        if value > 0:
            return 1
        return 0


def int_compare(left: object, right: object) -> int:
    return (left > right) - (left < right)


def key_compare(key: Callable[[object], object]) -> Comparator:
    def compare(left: object, right: object) -> int:
        return int_compare(key(left), key(right))

    return compare


def total_order_compare(left: object, right: object) -> int:
    """A total order for the demo records: primary value, then input id."""
    return int_compare((left[0], left[1]), (right[0], right[1]))


def validate_order(items: Sequence[object], comparator: Comparator, require_total: bool = False) -> None:
    """Check finite samples for strict-weak ordering, optionally total ordering.

    This is a diagnostic validator, not a proof for an infinite domain. Strict
    weak ordering requires irreflexivity, asymmetry, transitivity of '<', and
    transitivity of incomparability. A total order additionally requires every
    distinct pair to be strictly comparable.
    """
    values = list(items)
    for item in values:
        if comparator(item, item) != 0:
            raise ComparatorError("comparator is not irreflexive under equality")
    for left in values:
        for right in values:
            lr = comparator(left, right)
            rl = comparator(right, left)
            if (lr < 0 and rl <= 0) or (lr > 0 and rl >= 0):
                raise ComparatorError("comparator violates asymmetry")
            if require_total and left != right and lr == 0:
                raise ComparatorError("distinct items are incomparable under total-order mode")
    for a in values:
        for b in values:
            for c in values:
                if comparator(a, b) < 0 and comparator(b, c) < 0 and comparator(a, c) >= 0:
                    raise ComparatorError("comparator violates transitivity")
                ab_equal = comparator(a, b) == 0
                bc_equal = comparator(b, c) == 0
                if ab_equal and bc_equal and comparator(a, c) != 0:
                    raise ComparatorError("incomparability is not transitive")


def _record(trace: List[TraceStep], event: str, array: List[object], detail: str) -> None:
    if trace is not None:
        trace.append(TraceStep(event, list(array), detail))


def _swap(array: List[object], left: int, right: int, stats: Stats) -> None:
    if left != right:
        array[left], array[right] = array[right], array[left]
        stats.writes += 2


def insertion_sort(values: Iterable[object], comparator: Comparator = int_compare,
                   trace: List[TraceStep] | None = None,
                   stats: Stats | None = None) -> List[object]:
    array = list(values)
    stats = stats if stats is not None else Stats()
    counted = comparator if isinstance(comparator, CountingComparator) else CountingComparator(comparator, stats)
    _record(trace, "start", array, "왼쪽 prefix가 정렬 구간입니다.")
    for index in range(1, len(array)):
        value = array[index]
        position = index - 1
        while position >= 0 and counted(array[position], value) > 0:
            array[position + 1] = array[position]
            stats.writes += 1
            position -= 1
        array[position + 1] = value
        stats.writes += 1
        _record(trace, "insert", array, "현재 값을 정렬된 prefix에 삽입했습니다.")
    return array


def selection_sort(values: Iterable[object], comparator: Comparator = int_compare,
                   trace: List[TraceStep] | None = None,
                   stats: Stats | None = None) -> List[object]:
    array = list(values)
    stats = stats if stats is not None else Stats()
    counted = comparator if isinstance(comparator, CountingComparator) else CountingComparator(comparator, stats)
    _record(trace, "start", array, "앞쪽 prefix의 위치를 하나씩 확정합니다.")
    for start in range(len(array) - 1):
        minimum = start
        for index in range(start + 1, len(array)):
            if counted(array[index], array[minimum]) < 0:
                minimum = index
        _swap(array, start, minimum, stats)
        _record(trace, "select", array, "남은 구간의 최솟값을 앞에 배치했습니다.")
    return array


def bubble_sort(values: Iterable[object], comparator: Comparator = int_compare,
                trace: List[TraceStep] | None = None,
                stats: Stats | None = None) -> List[object]:
    array = list(values)
    stats = stats if stats is not None else Stats()
    counted = comparator if isinstance(comparator, CountingComparator) else CountingComparator(comparator, stats)
    _record(trace, "start", array, "인접 역순 쌍을 교환하고 큰 값을 뒤로 보냅니다.")
    for end in range(len(array) - 1, 0, -1):
        changed = False
        for index in range(end):
            if counted(array[index], array[index + 1]) > 0:
                _swap(array, index, index + 1, stats)
                changed = True
        _record(trace, "pass", array, "이번 순회에서 가장 큰 값이 뒤쪽에 놓였습니다.")
        if not changed:
            break
    return array


def merge_sort(values: Iterable[object], comparator: Comparator = int_compare,
               trace: List[TraceStep] | None = None,
               stats: Stats | None = None) -> List[object]:
    array = list(values)
    stats = stats if stats is not None else Stats()
    counted = comparator if isinstance(comparator, CountingComparator) else CountingComparator(comparator, stats)
    _record(trace, "start", array, "정렬된 두 절반을 안정적으로 병합합니다.")

    def sort_range(lo: int, hi: int) -> None:
        if hi - lo <= 1:
            return
        middle = (lo + hi) // 2
        sort_range(lo, middle)
        sort_range(middle, hi)
        left = array[lo:middle]
        right = array[middle:hi]
        i = j = 0
        output: List[object] = []
        while i < len(left) and j < len(right):
            if counted(left[i], right[j]) <= 0:
                output.append(left[i])
                i += 1
            else:
                output.append(right[j])
                j += 1
        output.extend(left[i:])
        output.extend(right[j:])
        array[lo:hi] = output
        stats.writes += len(output)
        _record(trace, "merge", array, "왼쪽 동률을 먼저 꺼내 안정성을 보존했습니다.")

    sort_range(0, len(array))
    return array


def _sift_down(array: List[object], root: int, size: int, comparator: Comparator, stats: Stats) -> None:
    while True:
        child = root * 2 + 1
        if child >= size:
            return
        if child + 1 < size and comparator(array[child], array[child + 1]) < 0:
            child += 1
        if comparator(array[root], array[child]) >= 0:
            return
        _swap(array, root, child, stats)
        root = child


def heap_sort(values: Iterable[object], comparator: Comparator = int_compare,
              trace: List[TraceStep] | None = None,
              stats: Stats | None = None) -> List[object]:
    array = list(values)
    stats = stats if stats is not None else Stats()
    counted = comparator if isinstance(comparator, CountingComparator) else CountingComparator(comparator, stats)
    _record(trace, "start", array, "max heap을 만든 뒤 최댓값을 끝에 확정합니다.")
    for root in range(len(array) // 2 - 1, -1, -1):
        _sift_down(array, root, len(array), counted, stats)
    _record(trace, "heapify", array, "배열 prefix가 max heap 조건을 만족합니다.")
    for end in range(len(array) - 1, 0, -1):
        _swap(array, 0, end, stats)
        _sift_down(array, 0, end, counted, stats)
        _record(trace, "extract", array, "현재 최댓값을 suffix에 확정했습니다.")
    return array


ALGORITHMS: Dict[str, Callable[..., List[object]]] = {
    "insertion": insertion_sort,
    "selection": selection_sort,
    "bubble": bubble_sort,
    "merge": merge_sort,
    "heap": heap_sort,
}
STABLE_ALGORITHMS = {"insertion", "bubble", "merge"}


def assert_result(original: Sequence[object], result: Sequence[object], comparator: Comparator) -> None:
    for left, right in zip(result, result[1:]):
        if comparator(left, right) > 0:
            raise SortContractError("output is not nondecreasing")
    if Counter(original) != Counter(result):
        raise SortContractError("output does not preserve the input multiset")


def run_exhaustive_contract_tests() -> None:
    """Run every length-four sequence over values 0, 1, 2 through each algorithm."""
    for name, algorithm in ALGORITHMS.items():
        for values in itertools.chain.from_iterable(itertools.product(range(3), repeat=n) for n in range(5)):
            result = algorithm(values)
            assert_result(values, result, int_compare)
            if result != sorted(values):
                raise SortContractError("algorithm %s disagrees with reference" % name)


def run_stability_tests() -> None:
    for values in itertools.chain.from_iterable(itertools.product(range(3), repeat=n) for n in range(5)):
        records = [(value, index) for index, value in enumerate(values)]
        expected = sorted(records, key=lambda record: record[0])
        for name in STABLE_ALGORITHMS:
            result = ALGORITHMS[name](records, comparator=key_compare(lambda record: record[0]))
            assert_result(records, result, key_compare(lambda record: record[0]))
            if result != expected:
                raise SortContractError("stable algorithm %s changed equal-key order" % name)


def cycle_compare(left: object, right: object) -> int:
    relation = {(0, 1): -1, (1, 2): -1, (2, 0): -1}
    if left == right:
        return 0
    if (left, right) in relation:
        return -1
    if (right, left) in relation:
        return 1
    return 0


def run_failure_demo() -> str:
    try:
        validate_order([0, 1, 2], cycle_compare, require_total=False)
    except ComparatorError as error:
        return "EXPECTED_FAILURE comparator validation: %s" % error
    raise AssertionError("failure injection unexpectedly passed")


def trace_lines(name: str, values: Sequence[int]) -> List[str]:
    trace: List[TraceStep] = []
    result = ALGORITHMS[name](values, trace=trace)
    lines = ["algorithm=%s input=%s" % (name, list(values))]
    for number, step in enumerate(trace):
        lines.append("%02d %-8s %s | %s" % (number, step.event, step.array, step.detail))
    lines.append("result=%s" % result)
    return lines


def benchmark(name: str, sizes: Sequence[int], repeats: int) -> List[str]:
    lines = ["algorithm,size,repeats,mean_ns,comparisons,writes"]
    for size in sizes:
        total_ns = 0
        total_comparisons = 0
        total_writes = 0
        for repeat in range(repeats):
            values = list(range(size, 0, -1))
            stats = Stats()
            comparator = CountingComparator(int_compare, stats)
            started = time.perf_counter_ns()
            result = ALGORITHMS[name](values, comparator=comparator, stats=stats)
            elapsed = time.perf_counter_ns() - started
            assert_result(values, result, int_compare)
            total_ns += elapsed
            total_comparisons += stats.comparisons
            total_writes += stats.writes
        lines.append("%s,%d,%d,%d,%d,%d" % (
            name, size, repeats, total_ns // repeats,
            total_comparisons // repeats, total_writes // repeats))
    return lines


class LabTests(unittest.TestCase):
    def test_exhaustive_multiset_and_reference_contract(self) -> None:
        run_exhaustive_contract_tests()

    def test_stability_for_duplicate_keys(self) -> None:
        run_stability_tests()

    def test_unstable_algorithms_preserve_multiset(self) -> None:
        records = [(2, "A"), (1, "B"), (2, "C"), (1, "D")]
        comparator = key_compare(lambda record: record[0])
        for name in ("selection", "heap"):
            result = ALGORITHMS[name](records, comparator=comparator)
            assert_result(records, result, comparator)

    def test_strict_weak_and_total_order_diagnostics(self) -> None:
        records = [(1, "A"), (1, "B"), (2, "C")]
        validate_order(records, key_compare(lambda record: record[0]))
        validate_order(records, total_order_compare, require_total=True)
        with self.assertRaises(ComparatorError):
            validate_order([0, 1, 2], cycle_compare)

    def test_traces_have_final_sorted_state(self) -> None:
        for name, algorithm in ALGORITHMS.items():
            trace: List[TraceStep] = []
            result = algorithm([5, 1, 4, 2], trace=trace)
            self.assertTrue(trace)
            self.assertEqual(result, trace[-1].array)
            self.assertEqual(result, [1, 2, 4, 5])

    def test_known_worst_case_shapes(self) -> None:
        for name in ALGORITHMS:
            stats = Stats()
            result = ALGORITHMS[name](list(range(40, 0, -1)), stats=stats)
            self.assertEqual(result, list(range(1, 41)))
            self.assertGreater(stats.comparisons, 0)
        nearly_sorted = list(range(39)) + [-1]
        insertion_stats = Stats()
        insertion_sort(nearly_sorted, stats=insertion_stats)
        reverse_stats = Stats()
        insertion_sort(list(range(40, 0, -1)), stats=reverse_stats)
        self.assertLess(insertion_stats.comparisons, reverse_stats.comparisons)


class CliTests(unittest.TestCase):
    def test_failure_injection_is_observable(self) -> None:
        self.assertIn("EXPECTED_FAILURE", run_failure_demo())


def main() -> int:
    parser = argparse.ArgumentParser(description="comparison sorting contracts and traces")
    parser.add_argument("--test", action="store_true", help="run executable unittest and exhaustive checks")
    parser.add_argument("--trace", choices=sorted(ALGORITHMS), help="print a trace for one algorithm")
    parser.add_argument("--input", default="5,1,4,2", help="comma-separated integer input for --trace")
    parser.add_argument("--failure-demo", action="store_true", help="inject a cyclic comparator and show diagnosis")
    parser.add_argument("--benchmark", choices=sorted(ALGORITHMS), help="measure descending worst-case inputs")
    parser.add_argument("--sizes", default="16,64,128", help="comma-separated benchmark sizes")
    parser.add_argument("--repeats", type=int, default=3, help="benchmark repetitions per size")
    args = parser.parse_args()

    if args.test:
        suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        return 0 if result.wasSuccessful() else 1
    if args.trace:
        values = [int(part.strip()) for part in args.input.split(",") if part.strip()]
        if len(values) > 128:
            parser.error("trace supports at most 128 values")
        print("\n".join(trace_lines(args.trace, values)))
        return 0
    if args.failure_demo:
        print(run_failure_demo())
        return 0
    if args.benchmark:
        sizes = [int(part.strip()) for part in args.sizes.split(",") if part.strip()]
        if not sizes or len(sizes) > 10 or not 1 <= args.repeats <= 20 or any(size < 0 or size > 2048 for size in sizes):
            parser.error("use 1..10 sizes in 0..2048 and repeats in 1..20")
        print("\n".join(benchmark(args.benchmark, sizes, args.repeats)))
        return 0
    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
