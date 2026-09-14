"""Executable small models, not a production game engine or distributed proof."""
import heapq
import itertools
import math
import random
import unicodedata
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def search(graph, h, start, goal, weight=1, reopen=True):
    best = {start: 0}
    parent = {}
    closed = set()
    queue = [(weight * h[start], 0, start)]
    while queue:
        _, cost, node = heapq.heappop(queue)
        if cost != best[node] or node in closed:
            continue
        if node == goal:
            path = [goal]
            while path[-1] != start:
                path.append(parent[path[-1]])
                assert len(path) <= len(graph)
            return cost, path[::-1]
        closed.add(node)
        for target, edge in graph[node]:
            new_cost = cost + edge
            if new_cost < best.get(target, math.inf):
                if target in closed and not reopen:
                    continue
                best[target] = new_cost
                parent[target] = node
                closed.discard(target)
                heapq.heappush(queue, (new_cost + weight * h[target], new_cost, target))
    return math.inf, []


graph = {'S': [('A', 3), ('B', 1)], 'A': [('G', 3)], 'B': [('A', 1)], 'G': []}
h = {'S': 0, 'A': 0, 'B': 4, 'G': 0}
assert search(graph, h, 'S', 'G') == (5, ['S', 'B', 'A', 'G'])
assert search(graph, h, 'S', 'G', reopen=False)[0] == 6

# Random directed positive-cost graphs. Floyd-Warshall is an independent oracle.
rng = random.Random(20260915)
trials = 300
for _ in range(trials):
    n = 7
    graph = {i: [] for i in range(n)}
    dist = [[0 if i == j else math.inf for j in range(n)] for i in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j and rng.random() < 0.35:
                cost = rng.randrange(1, 10)
                graph[i].append((j, cost))
                dist[i][j] = cost
    for k in range(n):
        for i in range(n):
            for j in range(n):
                dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
    goal = n - 1
    h = {i: rng.randrange(int(dist[i][goal]) + 1) if math.isfinite(dist[i][goal]) else 0
         for i in range(n)}
    for start in range(n):
        cost, path = search(graph, h, start, goal)
        assert cost == dist[start][goal]
        if path:
            assert sum(dict(graph[a])[b] for a, b in zip(path, path[1:])) == cost
        approximate, _ = search(graph, h, start, goal, weight=2)
        if math.isfinite(dist[start][goal]):
            assert dist[start][goal] <= approximate <= 2 * dist[start][goal]
        else:
            assert approximate == math.inf
print(f'PASS A* reopen counterexample and {trials * 7} A*/Weighted-A* oracle comparisons')

# Independent cell-box intersection reference for a closed-cell supercover.
def segment_box(origin, direction, cell):
    lo, hi = 0.0, 1.0
    for o, d, c in zip(origin, direction, cell):
        if d == 0:
            if not c <= o <= c + 1:
                return False
        else:
            a, b = (c - o) / d, (c + 1 - o) / d
            lo, hi = max(lo, min(a, b)), min(hi, max(a, b))
            if lo > hi:
                return False
    return True


def diagonal_supercover(dimensions):
    cells = {(0,) * dimensions}
    # Segment .5 -> 1.5 crosses all axes at t=.5.
    for mask in range(1, 1 << dimensions):
        cells.add(tuple((mask >> axis) & 1 for axis in range(dimensions)))
    return cells


for dimensions in (2, 3):
    origin, direction = (0.5,) * dimensions, (1.0,) * dimensions
    reference = {c for c in itertools.product(range(-1, 3), repeat=dimensions)
                 if segment_box(origin, direction, c)}
    assert diagonal_supercover(dimensions) == reference
assert diagonal_supercover(2) == {(0, 0), (1, 0), (0, 1), (1, 1)}
# A ray lying on x=1 touches cells on both sides for its full length.
face_cells = {c for c in itertools.product(range(3), repeat=2)
              if segment_box((1, 0.25), (0, 1.5), c)}
assert face_cells == {(0, 0), (1, 0), (0, 1), (1, 1)}
print('PASS closed-cell 2D/3D corner and face-contact reference sets (not a full DDA implementation)')

for x in range(-65, 66):
    chunk, local = divmod(x, 16)
    assert 0 <= local < 16 and chunk * 16 + local == x
assert divmod(-1, 16) == (-1, 15)
assert unicodedata.normalize('NFC', 'é') == 'é'
assert unicodedata.normalize('NFKC', 'Ａ') == 'A'
assert unicodedata.normalize('NFC', 'a') != unicodedata.normalize('NFC', 'а')
ny = ZoneInfo('America/New_York')
a = datetime(2024, 3, 9, 9, tzinfo=ny)
b = datetime(2024, 3, 10, 9, tzinfo=ny)
assert (b.astimezone(timezone.utc) - a.astimezone(timezone.utc)).total_seconds() == 23 * 3600
assert (a.astimezone(timezone.utc) + timedelta(hours=24)).astimezone(ny).hour == 10
print('PASS negative chunk coordinates, Unicode distinctions, New York 23-hour calendar day')


def euler(steps):
    x = v = 0.0
    for dt in steps:
        x += v * dt
        v += dt
    return x, v


assert euler([0.1]) == (0.0, 0.1)
assert math.isclose(euler([0.05, 0.05])[0], 0.0025)
assert math.isclose((3.5 - 0) / (10 - 0), 0.35)
assert 4 * 3 + 2 * 1 == 14 > 10
assert 16 ** 3 // 8 == 512
assert 16 ** 3 * 2 // 8 == 1024
print('PASS Euler step difference, simple contact time, weighted shortcut and bitmap arithmetic')


def valid_order(events):
    if sorted(events) != ['A', 'L', 'W']:
        return False
    return events.index('L') < events.index('A') and events.index('L') < events.index('W')


assert valid_order(['L', 'A', 'W'])
assert valid_order(['L', 'W', 'A'])
assert not valid_order(['A', 'L', 'W'])
assert not valid_order(['L', 'A', 'A', 'W'])
print('PASS protocol partial-order and duplicate-event counterexamples')
