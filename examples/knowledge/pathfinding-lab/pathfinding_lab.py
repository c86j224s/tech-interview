#!/usr/bin/env python3
"""Small, dependency-free reference lab for static and incremental pathfinding.

The module deliberately uses a directed finite graph and exact numeric costs.
It is a teaching/reference harness, not a game-engine navigation adapter.
"""

from __future__ import annotations

import argparse
import heapq
import math
import sys
import unittest
from collections import deque
from dataclasses import dataclass
from typing import Callable, Dict, Hashable, Iterable, List, Optional, Sequence, Tuple

Node = Hashable
Cost = float
INF = math.inf
Heuristic = Callable[[Node, Node], Cost]


class PathError(ValueError):
    """Raised when a returned parent/successor chain is not a safe path."""


class Graph:
    """Ordered directed graph with replaceable nonnegative edge costs."""

    def __init__(self, nodes: Iterable[Node]):
        self.nodes = tuple(nodes)
        if len(set(self.nodes)) != len(self.nodes):
            raise ValueError("nodes must be unique")
        self._adj: Dict[Node, List[Tuple[Node, Cost]]] = {n: [] for n in self.nodes}

    def add_edge(self, source: Node, target: Node, cost: Cost) -> None:
        self._require_node(source)
        self._require_node(target)
        self._adj[source].append((target, cost))

    def set_edge(self, source: Node, target: Node, cost: Cost) -> None:
        """Replace all parallel edges source->target with one edge."""
        self._require_node(source)
        self._require_node(target)
        self._adj[source] = [
            (v, w) for v, w in self._adj[source] if v != target
        ]
        self._adj[source].append((target, cost))

    def remove_edge(self, source: Node, target: Node) -> None:
        self._require_node(source)
        self._require_node(target)
        self._adj[source] = [
            (v, w) for v, w in self._adj[source] if v != target
        ]

    def successors(self, node: Node) -> Sequence[Tuple[Node, Cost]]:
        self._require_node(node)
        return tuple(self._adj[node])

    def predecessors(self, node: Node) -> Sequence[Tuple[Node, Cost]]:
        self._require_node(node)
        return tuple(
            (u, w)
            for u in self.nodes
            for v, w in self._adj[u]
            if v == node
        )

    def _require_node(self, node: Node) -> None:
        if node not in self._adj:
            raise ValueError("unknown node: {!r}".format(node))

    def validate(self) -> None:
        for u in self.nodes:
            for v, weight in self._adj[u]:
                if v not in self._adj:
                    raise ValueError("edge points to unknown node")
                if not isinstance(weight, (int, float)) or isinstance(weight, bool):
                    raise ValueError("edge cost must be a real number")
                if not math.isfinite(float(weight)) or weight < 0:
                    raise ValueError("edge cost must be finite and nonnegative")


def _checked_add(left: Cost, right: Cost) -> Cost:
    if left == INF or right == INF:
        return INF
    value = left + right
    if not math.isfinite(float(value)):
        raise ValueError("distance overflow or non-finite distance")
    return value


def _require_endpoints(graph: Graph, start: Node, goal: Optional[Node]) -> None:
    if start not in graph.nodes:
        raise ValueError("unknown start: {!r}".format(start))
    if goal is not None and goal not in graph.nodes:
        raise ValueError("unknown goal: {!r}".format(goal))
    graph.validate()


def _require_positive_incremental_costs(graph: Graph) -> None:
    """Reject zero-cost edges because this implementation needs progress labels."""
    if any(weight <= 0 for u in graph.nodes for _, weight in graph.successors(u)):
        raise ValueError("incremental planners require strictly positive edge costs")


def _restore_parent(
    parent: Dict[Node, Optional[Node]], start: Node, goal: Node, limit: int
) -> List[Node]:
    reverse: List[Node] = []
    seen = set()
    node: Optional[Node] = goal
    while node is not None:
        if node in seen:
            raise PathError("parent cycle")
        if len(reverse) >= limit:
            raise PathError("parent chain exceeds graph-size bound")
        seen.add(node)
        reverse.append(node)
        if node == start:
            reverse.reverse()
            return reverse
        node = parent.get(node)
    raise PathError("missing parent before start")


def path_cost(graph: Graph, path: Sequence[Node]) -> Cost:
    """Sum one matching edge per step; reject malformed paths and overflow."""
    total: Cost = 0
    for source, target in zip(path, path[1:]):
        matching = [w for v, w in graph.successors(source) if v == target]
        if not matching:
            raise PathError("path uses a missing edge")
        total = _checked_add(total, min(matching))
    return total


def bfs(graph: Graph, start: Node, goal: Optional[Node] = None) -> "SearchResult":
    _require_endpoints(graph, start, goal)
    if any(weight != 1 for u in graph.nodes for _, weight in graph.successors(u)):
        raise ValueError("BFS requires every edge cost to equal 1")
    distance = {node: INF for node in graph.nodes}
    parent: Dict[Node, Optional[Node]] = {node: None for node in graph.nodes}
    queue = deque([start])
    distance[start] = 0
    expanded: List[Node] = []
    while queue:
        node = queue.popleft()
        expanded.append(node)
        for neighbor, _ in graph.successors(node):
            if distance[neighbor] == INF:
                distance[neighbor] = distance[node] + 1
                parent[neighbor] = node
                queue.append(neighbor)
    if goal is None:
        return SearchResult("all_distances", distance, None, expanded)
    path = [] if distance[goal] == INF else _restore_parent(parent, start, goal, len(graph.nodes))
    return SearchResult("target_result", distance, path, expanded)


def dijkstra(graph: Graph, start: Node, goal: Optional[Node] = None) -> "SearchResult":
    _require_endpoints(graph, start, goal)
    distance = {node: INF for node in graph.nodes}
    parent: Dict[Node, Optional[Node]] = {node: None for node in graph.nodes}
    distance[start] = 0
    sequence = 0
    heap: List[Tuple[Cost, int, Node]] = [(0, sequence, start)]
    expanded: List[Node] = []
    settled = set()
    while heap:
        snapshot, _, node = heapq.heappop(heap)
        if snapshot != distance[node] or node in settled:
            continue
        settled.add(node)
        expanded.append(node)
        if goal is not None and node == goal:
            break
        for neighbor, weight in graph.successors(node):
            candidate = _checked_add(snapshot, weight)
            if candidate < distance[neighbor]:
                distance[neighbor] = candidate
                parent[neighbor] = node
                sequence += 1
                heapq.heappush(heap, (candidate, sequence, neighbor))
    if goal is None:
        return SearchResult("all_distances", distance, None, expanded)
    path = [] if distance[goal] == INF else _restore_parent(parent, start, goal, len(graph.nodes))
    return SearchResult("target_result", distance, path, expanded)


def astar(
    graph: Graph, start: Node, goal: Node, heuristic: Optional[Heuristic] = None
) -> "SearchResult":
    _require_endpoints(graph, start, goal)
    h = heuristic or (lambda _a, _b: 0)
    for node in graph.nodes:
        value = h(node, goal)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError("heuristic must return a real number")
        if not math.isfinite(float(value)) or value < 0:
            raise ValueError("heuristic must be finite and nonnegative")
    distance = {node: INF for node in graph.nodes}
    parent: Dict[Node, Optional[Node]] = {node: None for node in graph.nodes}
    distance[start] = 0
    sequence = 0
    heap: List[Tuple[Cost, Cost, int, Node]] = [(h(start, goal), 0, sequence, start)]
    closed = set()
    expanded: List[Node] = []
    while heap:
        _, snapshot, _, node = heapq.heappop(heap)
        if snapshot != distance[node]:
            continue
        if node in closed:
            continue
        closed.add(node)
        expanded.append(node)
        if node == goal:
            path = _restore_parent(parent, start, goal, len(graph.nodes))
            if path_cost(graph, path) != distance[goal]:
                raise PathError("parent path cost does not match g")
            return SearchResult("target_result", distance, path, expanded)
        for neighbor, weight in graph.successors(node):
            candidate = _checked_add(distance[node], weight)
            if candidate < distance[neighbor]:
                distance[neighbor] = candidate
                parent[neighbor] = node
                closed.discard(neighbor)  # reopen for merely admissible h
                sequence += 1
                priority = _checked_add(candidate, h(neighbor, goal))
                heapq.heappush(heap, (priority, candidate, sequence, neighbor))
    return SearchResult("unreachable", distance, [], expanded)


@dataclass
class SearchResult:
    kind: str
    distances: Dict[Node, Cost]
    path: Optional[List[Node]]
    expanded: List[Node]

    @property
    def cost(self) -> Cost:
        if not self.path:
            return INF
        return self.distances[self.path[-1]]


def reconstruct_successor_path(
    start: Node,
    goal: Node,
    next_step: Callable[[Node, set], Optional[Node]],
    max_nodes: int,
) -> List[Node]:
    """Follow a successor policy with explicit cycle and length guards."""
    if max_nodes <= 0:
        raise ValueError("max_nodes must be positive")
    path = [start]
    seen = {start}
    current = start
    while current != goal:
        if len(path) >= max_nodes:
            raise PathError("successor path exceeds graph-size bound")
        successor = next_step(current, seen)
        if successor is None:
            raise PathError("missing successor before goal")
        if successor in seen:
            raise PathError("successor cycle")
        path.append(successor)
        seen.add(successor)
        current = successor
    return path


def reconstruct_backtracking_path(
    start: Node,
    goal: Node,
    successors: Callable[[Node], Iterable[Node]],
    max_nodes: int,
) -> List[Node]:
    """Find a bounded acyclic route when equal-cost successor ties can branch."""
    if max_nodes <= 0:
        raise ValueError("max_nodes must be positive")
    path = [start]
    seen = {start}

    def visit(current: Node) -> bool:
        if current == goal:
            return True
        if len(path) >= max_nodes:
            return False
        for successor in successors(current):
            if successor in seen:
                continue
            seen.add(successor)
            path.append(successor)
            if visit(successor):
                return True
            path.pop()
            seen.remove(successor)
        return False

    if not visit(start):
        raise PathError("no acyclic successor path before goal")
    return path


class LPAStar:
    """Lifelong Planning A* for a fixed start/goal and changed edge costs."""

    def __init__(self, graph: Graph, start: Node, goal: Node, heuristic: Optional[Heuristic] = None):
        _require_endpoints(graph, start, goal)
        _require_positive_incremental_costs(graph)
        self.graph = graph
        self.start = start
        self.goal = goal
        self.heuristic = heuristic or (lambda _a, _b: 0)
        self.g = {node: INF for node in graph.nodes}
        self.rhs = {node: INF for node in graph.nodes}
        self.parent: Dict[Node, Optional[Node]] = {node: None for node in graph.nodes}
        self.rhs[start] = 0
        self._sequence = 0
        self._queue: List[Tuple[Tuple[Cost, Cost], int, Node]] = []
        self.expanded: List[Node] = []
        self._update_vertex(start)
        self.compute_shortest_path()

    def _key(self, node: Node) -> Tuple[Cost, Cost]:
        base = min(self.g[node], self.rhs[node])
        return (_checked_add(base, self.heuristic(node, self.goal)), base)

    def _push_if_inconsistent(self, node: Node) -> None:
        if self.g[node] != self.rhs[node]:
            self._sequence += 1
            heapq.heappush(self._queue, (self._key(node), self._sequence, node))

    def _top(self) -> Tuple[Tuple[Cost, Cost], Optional[Node]]:
        while self._queue:
            key, _, node = self._queue[0]
            if self.g[node] == self.rhs[node]:
                heapq.heappop(self._queue)
                continue
            current = self._key(node)
            if key != current:
                heapq.heappop(self._queue)
                self._push_if_inconsistent(node)
                continue
            return key, node
        return (INF, INF), None

    def _update_vertex(self, node: Node) -> None:
        if node != self.start:
            candidates = [
                (_checked_add(self.g[pred], weight), pred)
                for pred, weight in self.graph.predecessors(node)
                if self.g[pred] != INF
            ]
            if candidates:
                best_cost, best_parent = min(
                    candidates,
                    key=lambda item: (item[0], self.graph.nodes.index(item[1])),
                )
                self.rhs[node] = best_cost
                self.parent[node] = best_parent
            else:
                self.rhs[node] = INF
                self.parent[node] = None
        self._push_if_inconsistent(node)

    def compute_shortest_path(self, max_steps: Optional[int] = None) -> None:
        steps = 0
        while True:
            top_key, node = self._top()
            if not (top_key < self._key(self.goal) or self.rhs[self.goal] != self.g[self.goal]):
                return
            if node is None:
                raise PathError("LPA* queue exhausted while goal remained inconsistent")
            if max_steps is not None and steps >= max_steps:
                raise TimeoutError("LPA* step budget exhausted")
            heapq.heappop(self._queue)
            if top_key != self._key(node) or self.g[node] == self.rhs[node]:
                continue
            if self.g[node] > self.rhs[node]:
                self.g[node] = self.rhs[node]
                self.expanded.append(node)
                for successor, _ in self.graph.successors(node):
                    self._update_vertex(successor)
            else:
                self.g[node] = INF
                self._update_vertex(node)
                for successor, _ in self.graph.successors(node):
                    self._update_vertex(successor)
            steps += 1

    def notify_edge_change(self, source: Node, target: Node) -> None:
        """Call after changing source->target; rhs(target) depends on that edge."""
        self.graph._require_node(source)
        self.graph._require_node(target)
        self.graph.validate()
        _require_positive_incremental_costs(self.graph)
        self._update_vertex(target)
        self.compute_shortest_path()

    def _restore_path(self) -> List[Node]:
        """Restore a bounded acyclic path through tight forward edges."""
        def tight_successors(node: Node) -> Iterable[Node]:
            return (
                successor
                for successor, weight in self.graph.successors(node)
                if self.g[successor] != INF
                and _checked_add(self.g[node], weight) == self.g[successor]
            )

        return reconstruct_backtracking_path(
            self.start,
            self.goal,
            tight_successors,
            len(self.graph.nodes) + 1,
        )

    def path(self) -> List[Node]:
        self.compute_shortest_path()
        if self.g[self.goal] == INF:
            return []
        route = self._restore_path()
        if path_cost(self.graph, route) != self.g[self.goal]:
            raise PathError("LPA* path cost does not match g[goal]")
        return route


class DStarLite:
    """D* Lite with moving start, rhs/g state, km, and edge-change repair."""

    def __init__(self, graph: Graph, start: Node, goal: Node, heuristic: Optional[Heuristic] = None):
        _require_endpoints(graph, start, goal)
        _require_positive_incremental_costs(graph)
        self.graph = graph
        self.start = start
        self.goal = goal
        self.s_last = start
        self.heuristic = heuristic or (lambda _a, _b: 0)
        self.km: Cost = 0
        self.g = {node: INF for node in graph.nodes}
        self.rhs = {node: INF for node in graph.nodes}
        self.rhs[goal] = 0
        self._sequence = 0
        self._queue: List[Tuple[Tuple[Cost, Cost], int, Node]] = []
        self.expanded: List[Node] = []
        self._push_if_inconsistent(goal)
        self.compute_shortest_path()

    def _key(self, node: Node) -> Tuple[Cost, Cost]:
        base = min(self.g[node], self.rhs[node])
        first = _checked_add(base, self.heuristic(self.start, node))
        first = _checked_add(first, self.km)
        return first, base

    def _push_if_inconsistent(self, node: Node) -> None:
        if self.g[node] != self.rhs[node]:
            self._sequence += 1
            heapq.heappush(self._queue, (self._key(node), self._sequence, node))

    def _top(self) -> Tuple[Tuple[Cost, Cost], Optional[Node]]:
        while self._queue:
            key, _, node = self._queue[0]
            if self.g[node] == self.rhs[node]:
                heapq.heappop(self._queue)
                continue
            current = self._key(node)
            if key != current:
                heapq.heappop(self._queue)
                self._push_if_inconsistent(node)
                continue
            return key, node
        return (INF, INF), None

    def _update_vertex(self, node: Node) -> None:
        if node != self.goal:
            candidates = [
                _checked_add(weight, self.g[successor])
                for successor, weight in self.graph.successors(node)
                if self.g[successor] != INF
            ]
            self.rhs[node] = min(candidates, default=INF)
        self._push_if_inconsistent(node)

    def compute_shortest_path(self, max_steps: Optional[int] = None) -> None:
        steps = 0
        while True:
            top_key, node = self._top()
            if not (top_key < self._key(self.start) or self.rhs[self.start] != self.g[self.start]):
                return
            if node is None:
                raise PathError("D* Lite queue exhausted while start remained inconsistent")
            if max_steps is not None and steps >= max_steps:
                raise TimeoutError("D* Lite step budget exhausted")
            heapq.heappop(self._queue)
            if top_key != self._key(node) or self.g[node] == self.rhs[node]:
                continue
            if self.g[node] > self.rhs[node]:
                self.g[node] = self.rhs[node]
                self.expanded.append(node)
                for predecessor, _ in self.graph.predecessors(node):
                    self._update_vertex(predecessor)
            else:
                self.g[node] = INF
                self._update_vertex(node)
                for predecessor, _ in self.graph.predecessors(node):
                    self._update_vertex(predecessor)
            steps += 1

    def notify_edge_change(self, source: Node, target: Node) -> None:
        """Call after changing source->target; rhs(source) depends on that edge."""
        self.graph._require_node(source)
        self.graph._require_node(target)
        self.graph.validate()
        _require_positive_incremental_costs(self.graph)
        self._update_vertex(source)
        self.compute_shortest_path()

    def move_start(self, new_start: Node) -> None:
        self.graph._require_node(new_start)
        self.km = _checked_add(self.km, self.heuristic(self.s_last, new_start))
        self.s_last = new_start
        self.start = new_start
        self.compute_shortest_path()

    def _next_step(self, node: Node, seen: set) -> Optional[Node]:
        candidates = []
        for successor, weight in self.graph.successors(node):
            if successor in seen or self.g[successor] == INF:
                continue
            candidates.append((_checked_add(weight, self.g[successor]), successor))
        if not candidates:
            return None
        return min(candidates, key=lambda item: (item[0], self.graph.nodes.index(item[1])))[1]

    def path(self) -> List[Node]:
        self.compute_shortest_path()
        if self.g[self.start] == INF:
            return []
        route = reconstruct_successor_path(
            self.start, self.goal, self._next_step, len(self.graph.nodes) + 1
        )
        if path_cost(self.graph, route) != self.g[self.start]:
            raise PathError("D* Lite successor path cost does not match g[start]")
        return route


def weighted_graph() -> Graph:
    graph = Graph(["S", "A", "B", "C", "G"])
    graph.add_edge("S", "A", 5)
    graph.add_edge("S", "B", 1)
    graph.add_edge("B", "A", 2)
    graph.add_edge("B", "C", 8)
    graph.add_edge("A", "C", 1)
    graph.add_edge("A", "G", 8)
    graph.add_edge("C", "G", 3)
    return graph


def unit_grid_graph() -> Graph:
    nodes = [(x, y) for y in range(3) for x in range(3)]
    graph = Graph(nodes)
    for x, y in nodes:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            neighbor = (x + dx, y + dy)
            if neighbor in nodes:
                graph.add_edge((x, y), neighbor, 1)
    return graph


def manhattan(a: Tuple[int, int], b: Tuple[int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


class LabTests(unittest.TestCase):
    def test_bfs_and_dijkstra_contracts(self):
        graph = Graph(["S", "A", "B", "C", "G"])
        graph.add_edge("S", "A", 1)
        graph.add_edge("S", "B", 1)
        graph.add_edge("A", "C", 1)
        graph.add_edge("C", "G", 1)
        graph.add_edge("B", "G", 1)
        bfs_result = bfs(graph, "S", "G")
        self.assertEqual(bfs_result.cost, 2)
        self.assertEqual(path_cost(graph, bfs_result.path), 2)
        self.assertEqual(dijkstra(graph, "S", "G").cost, 2)

    def test_dijkstra_astar_match_reference_oracle(self):
        graph = weighted_graph()
        oracle = dijkstra(graph, "S", "G")
        self.assertEqual(oracle.cost, 7)
        result = astar(graph, "S", "G")
        self.assertEqual(result.cost, oracle.cost)
        self.assertEqual(result.path, ["S", "B", "A", "C", "G"])

    def test_nonnegative_contract(self):
        graph = Graph(["S", "G"])
        graph.add_edge("S", "G", -1)
        with self.assertRaisesRegex(ValueError, "nonnegative"):
            dijkstra(graph, "S", "G")

    def test_lpa_edge_decrease_and_increase(self):
        graph = Graph(["S", "A", "B", "G"])
        graph.add_edge("S", "A", 2)
        graph.add_edge("A", "G", 2)
        graph.add_edge("S", "B", 1)
        graph.add_edge("B", "G", 5)
        planner = LPAStar(graph, "S", "G")
        self.assertEqual(planner.path(), ["S", "A", "G"])
        self.assertEqual(planner.g["G"], 4)
        graph.set_edge("B", "G", 1)
        planner.notify_edge_change("B", "G")
        self.assertEqual(planner.path(), ["S", "B", "G"])
        self.assertEqual(planner.g["G"], 2)
        graph.set_edge("A", "G", 10)
        planner.notify_edge_change("A", "G")
        self.assertEqual(planner.path(), ["S", "B", "G"])
        self.assertEqual(planner.g["G"], 2)

    def test_dstar_move_start_edge_increase_and_km(self):
        graph = unit_grid_graph()
        planner = DStarLite(graph, (0, 0), (2, 0), manhattan)
        self.assertEqual(planner.path(), [(0, 0), (1, 0), (2, 0)])
        planner.move_start((1, 0))
        self.assertEqual(planner.km, 1)
        self.assertEqual(planner.path(), [(1, 0), (2, 0)])
        graph.set_edge((1, 0), (2, 0), 5)
        planner.notify_edge_change((1, 0), (2, 0))
        self.assertEqual(path_cost(graph, planner.path()), 3)
        self.assertEqual(dijkstra(graph, (1, 0), (2, 0)).cost, 3)

    def test_zero_cost_ties_and_reconstruction_guard(self):
        graph = Graph(["S", "A", "B", "G"])
        graph.add_edge("S", "A", 0)
        graph.add_edge("S", "B", 0)
        graph.add_edge("A", "G", 1)
        graph.add_edge("B", "G", 1)
        oracle = dijkstra(graph, "S", "G")
        self.assertEqual(oracle.cost, 1)

        def cycle_policy(node: Node, _seen: set) -> Optional[Node]:
            return {"S": "A", "A": "S"}.get(node)

        with self.assertRaisesRegex(PathError, "cycle"):
            reconstruct_successor_path("S", "G", cycle_policy, 4)

    def test_incremental_planners_reject_zero_cost_edges(self):
        graph = Graph(["S", "G"])
        graph.add_edge("S", "G", 0)
        with self.assertRaisesRegex(ValueError, "strictly positive"):
            LPAStar(graph, "S", "G")
        with self.assertRaisesRegex(ValueError, "strictly positive"):
            DStarLite(graph, "S", "G")

    def test_unreachable_is_not_invalid(self):
        graph = Graph(["S", "G"])
        self.assertEqual(dijkstra(graph, "S", "G").path, [])
        self.assertEqual(DStarLite(graph, "S", "G").path(), [])


def run_demo() -> None:
    graph = weighted_graph()
    oracle = dijkstra(graph, "S", "G")
    print("oracle dijkstra:", oracle.path, "cost=", oracle.cost)
    print("astar:", astar(graph, "S", "G").path)

    dynamic = Graph(["S", "A", "B", "G"])
    dynamic.add_edge("S", "A", 2)
    dynamic.add_edge("A", "G", 2)
    dynamic.add_edge("S", "B", 1)
    dynamic.add_edge("B", "G", 5)
    lpa = LPAStar(dynamic, "S", "G")
    print("lpa initial:", lpa.path(), "cost=", lpa.g["G"])
    dynamic.set_edge("B", "G", 1)
    lpa.notify_edge_change("B", "G")
    print("lpa after decrease:", lpa.path(), "cost=", lpa.g["G"])

    grid = unit_grid_graph()
    dstar = DStarLite(grid, (0, 0), (2, 0), manhattan)
    print("dstar initial:", dstar.path(), "km=", dstar.km)
    dstar.move_start((1, 0))
    print("dstar after move:", dstar.path(), "km=", dstar.km)
    grid.set_edge((1, 0), (2, 0), 5)
    dstar.notify_edge_change((1, 0), (2, 0))
    print("dstar after increase:", dstar.path(), "cost=", path_cost(grid, dstar.path()))


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test", action="store_true", help="run executable tests")
    args = parser.parse_args(argv)
    if args.test:
        result = unittest.main(module=__name__, argv=[sys.argv[0]], verbosity=2, exit=False)
        return 0 if result.result.wasSuccessful() else 1
    run_demo()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
