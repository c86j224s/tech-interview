"""Executable checks for the examples in the algorithm study notes.

These are independent reference implementations, not production algorithms.
Run: python3 scripts/verify-algorithm-study.py
"""
from collections import Counter, deque
from itertools import combinations, product
import heapq
import random


def next_greater(a):
    result, stack = [None] * len(a), []
    for i, value in enumerate(a):
        while stack and a[stack[-1]] < value:
            result[stack.pop()] = i
        stack.append(i)
    return result


def window_max(a, k):
    q, result = deque(), []
    for i, value in enumerate(a):
        while q and q[0] <= i-k:
            q.popleft()
        while q and a[q[-1]] <= value:
            q.pop()
        q.append(i)
        if i >= k-1:
            result.append(a[q[0]])
    return result


arrays = 0
for n in range(7):
    for a in product(range(3), repeat=n):
        assert next_greater(a) == [next((j for j in range(i+1, n) if a[j] > a[i]), None) for i in range(n)]
        for k in range(1, n+2):
            assert window_max(a, k) == [max(a[i:i+k]) for i in range(n-k+1)]
        arrays += 1
assert next_greater([2,1,2,4,3]) == [3,2,3,None,None]
assert window_max([4,2,3,1,5],3) == [4,3,5]

permutations = Counter()
for choices in product(range(4), range(3), range(2)):
    a = list('ABCD')
    for i, j in zip([3,2,1], choices):
        a[i], a[j] = a[j], a[i]
    permutations[tuple(a)] += 1
assert len(permutations) == 24 and set(permutations.values()) == {1}
subsets = Counter()
for j3, j4 in product(range(3), range(4)):
    reservoir = ['A','B']
    for item,j in [('C',j3),('D',j4)]:
        if j < 2:
            reservoir[j] = item
    subsets[tuple(sorted(reservoir))] += 1
assert len(subsets) == 6 and set(subsets.values()) == {2}
assert Counter(x % 3 for x in range(6)) == {0:2,1:2,2:2}
assert 2**32 - 2**32 % 500 == 4294967000
assert [next(i for i,c in enumerate([1,4,6]) if c > r) for r in range(6)] == [0,1,1,1,2,2]


class DSU:
    def __init__(self, n):
        self.parent = list(range(n))
        self.size = [1] * n
        self.history = []

    def find(self, x):
        while x != self.parent[x]:
            x = self.parent[x]
        return x

    def union(self, a, b):
        a,b = self.find(a),self.find(b)
        if a == b:
            return False
        if self.size[a] < self.size[b]:
            a,b = b,a
        self.history.append((b,a,self.size[a]))
        self.parent[b] = a
        self.size[a] += self.size[b]
        return True

    def rollback(self, mark):
        while len(self.history) > mark:
            b,a,size = self.history.pop()
            self.parent[b] = b
            self.size[a] = size


dsu = DSU(5)
dsu.union(0,1)
dsu.union(2,3)
mark = len(dsu.history)
before = (dsu.parent[:], dsu.size[:])
dsu.union(0,2)
assert dsu.find(3) == dsu.find(0)
assert not dsu.union(1,3)
dsu.rollback(mark)
assert (dsu.parent,dsu.size) == before


def mst_cost(edges):
    dsu = DSU(4)
    total = 0
    for w,u,v in sorted(edges):
        if dsu.union(u,v):
            total += w
    return total


def exhaustive_tree_cost(edges):
    costs = []
    for subset in combinations(edges,3):
        dsu = DSU(4)
        if all(dsu.union(u,v) for w,u,v in subset):
            costs.append(sum(w for w,u,v in subset))
    return min(costs)


edges = [(1,0,1),(2,1,2),(3,0,2),(4,2,3),(5,1,3)]
assert mst_cost(edges) == exhaustive_tree_cost(edges) == 7
assert mst_cost(edges+[(2,0,3)]) == exhaustive_tree_cost(edges+[(2,0,3)]) == 5
rng = random.Random(20260915)
for _ in range(200):
    graph = [(rng.randint(-3,8),u,v) for u,v in combinations(range(4),2)]
    assert mst_cost(graph) == exhaustive_tree_cost(graph)


class LazySum:
    def __init__(self, values):
        self.n = len(values)
        self.sums = [0] * (4*self.n)
        self.lazy = [0] * (4*self.n)
        for i,v in enumerate(values):
            self.add(1,0,self.n,i,i+1,v)

    def apply(self,node,l,r,d):
        self.sums[node] += (r-l)*d
        self.lazy[node] += d

    def push(self,node,l,r):
        if r-l == 1 or self.lazy[node] == 0:
            return
        m = (l+r)//2
        self.apply(node*2,l,m,self.lazy[node])
        self.apply(node*2+1,m,r,self.lazy[node])
        self.lazy[node] = 0

    def add(self,node,l,r,ql,qr,d):
        if qr <= l or r <= ql:
            return
        if ql <= l and r <= qr:
            self.apply(node,l,r,d)
            return
        self.push(node,l,r)
        m = (l+r)//2
        self.add(node*2,l,m,ql,qr,d)
        self.add(node*2+1,m,r,ql,qr,d)
        self.sums[node] = self.sums[node*2] + self.sums[node*2+1]

    def query(self,node,l,r,ql,qr):
        if qr <= l or r <= ql:
            return 0
        if ql <= l and r <= qr:
            return self.sums[node]
        self.push(node,l,r)
        m = (l+r)//2
        return self.query(node*2,l,m,ql,qr)+self.query(node*2+1,m,r,ql,qr)


checks = 0
for n in range(1,9):
    values = [rng.randint(-5,5) for _ in range(n)]
    tree = LazySum(values)
    for _ in range(50):
        l = rng.randrange(n+1)
        r = rng.randrange(l,n+1)
        d = rng.randint(-5,5)
        tree.add(1,0,n,l,r,d)
        for i in range(l,r):
            values[i] += d
        for left in range(n+1):
            for right in range(left,n+1):
                assert tree.query(1,0,n,left,right) == sum(values[left:right])
                checks += 1
def topological(vertices, edges):
    outgoing = {v: [] for v in vertices}
    degree = dict.fromkeys(vertices, 0)
    for u,v in sorted(set(edges)):
        outgoing[u].append(v)
        degree[v] += 1
    ready = deque(v for v in vertices if degree[v] == 0)
    order = []
    while ready:
        u = ready.popleft()
        order.append(u)
        for v in outgoing[u]:
            degree[v] -= 1
            if degree[v] == 0:
                ready.append(v)
    return order, set(vertices)-set(order)


order, remaining = topological('ABCD', [('A','B'),('A','C'),('B','D'),('C','D')])
assert order == list('ABCD') and not remaining
assert topological('ABC', [('A','B'),('B','A'),('B','C')]) == ([],set('ABC'))
assert topological('A', [('A','A')]) == ([],{'A'})
assert topological('AB', [('A','B'),('A','B')]) == (list('AB'),set())
# Tag composition: a pending set is applied before its pending add.
for operations in product([('set',0),('set',5),('add',3),('add',-2)], repeat=4):
    has_set, set_value, add_value = False, 0, 0
    for kind,value in operations:
        if kind == 'set':
            has_set,set_value,add_value = True,value,0
        else:
            add_value += value
    for original in range(-3,4):
        expected = original
        for kind,value in operations:
            expected = value if kind == 'set' else expected+value
        actual = (set_value if has_set else original)+add_value
        assert actual == expected
assert list(heapq.merge([2,5,7],[1,3,8],[4,6])) == list(range(1,9))
capacity, moves = 1,0
for size in range(9):
    if size == capacity:
        moves += size
        capacity *= 2
assert (capacity,moves) == (16,15)
print(f'PASS: {arrays} arrays for stack/deque; 24 shuffle paths; 12 reservoir paths; 200 MST graphs; {checks} lazy range sums; numeric and merge examples')
