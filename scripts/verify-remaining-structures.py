"""Reference checks for remaining algorithm/data-structure learning examples."""
from collections import deque
import heapq
from itertools import product
from math import isqrt
import random


def coin_dp(coins, target):
    best = [None] * (target+1)
    best[0] = 0
    for x in range(1,target+1):
        options = [best[x-c]+1 for c in coins if c<=x and best[x-c] is not None]
        if options:
            best[x] = min(options)
    return best[target]


def coin_bfs(coins,target):
    q = deque([(0,0)])
    seen = {0}
    while q:
        x,count = q.popleft()
        if x == target:
            return count
        for c in coins:
            if x+c<=target and x+c not in seen:
                seen.add(x+c)
                q.append((x+c,count+1))
    return None


for mask in range(1,32):
    coins = [i+1 for i in range(5) if mask & (1<<i)]
    for target in range(21):
        assert coin_dp(coins,target) == coin_bfs(coins,target)
assert coin_dp([1,3,4],6)==2


def knapsack(items,capacity):
    best = [0]*(capacity+1)
    for weight,gain in items:
        for c in range(capacity,weight-1,-1):
            best[c] = max(best[c],best[c-weight]+gain)
    return best[capacity]


rng = random.Random(20260915)
for _ in range(200):
    items = [(rng.randint(1,6),rng.randint(0,20)) for _ in range(6)]
    capacity = rng.randint(0,20)
    brute = max(sum(g for (w,g),take in zip(items,bits) if take)
                for bits in product([0,1],repeat=len(items))
                if sum(w for (w,g),take in zip(items,bits) if take)<=capacity)
    assert knapsack(items,capacity)==brute
assert knapsack([(10,60),(20,100),(30,120)],50)==220


def count_sort(records,digit,radix):
    count = [0]*radix
    for r in records:
        count[digit(r)]+=1
    for i in range(1,radix):
        count[i]+=count[i-1]
    out = [None]*len(records)
    for r in reversed(records):
        k=digit(r)
        count[k]-=1
        out[count[k]]=r
    return out


records=[(21,0),(12,1),(11,2),(22,3)]
for base in [1,10]:
    records=count_sort(records,lambda r:(r[0]//base)%10,10)
assert records==[(11,2),(12,1),(21,0),(22,3)]
assert sorted(range(-128,128),key=lambda x:(x&255)^128)==list(range(-128,128))
for n in range(6):
    for a in product(range(3),repeat=n):
        decorated=list(zip(a,range(n)))
        assert count_sort(decorated,lambda r:r[0],3)==sorted(decorated,key=lambda r:r[0])


def sieve(n):
    prime=[True]*(n+1)
    prime[0]=False
    if n>=1: prime[1]=False
    for p in range(2,isqrt(n)+1):
        if prime[p]:
            for x in range(p*p,n+1,p): prime[x]=False
    return prime


def segment(l,r):
    base=sieve(isqrt(r))
    prime=[True]*(r-l+1)
    for p in range(2,len(base)):
        if base[p]:
            start=max(p*p,((l+p-1)//p)*p)
            for x in range(start,r+1,p): prime[x-l]=False
    for x in [0,1]:
        if l<=x<=r: prime[x-l]=False
    return prime


reference=sieve(100)
for l in range(101):
    for r in range(l,101):
        assert segment(l,r)==reference[l:r+1]
for x in range(101):
    assert reference[x]==(x>=2 and all(x%d for d in range(2,isqrt(x)+1)))


def zero_one(graph,source):
    dist=[float('inf')]*len(graph)
    dist[source]=0
    settled=set()
    q=deque([(0,source)])
    while q:
        d,u=q.popleft()
        if d!=dist[u] or u in settled: continue
        settled.add(u)
        for v,w in graph[u]:
            if d+w<dist[v]:
                dist[v]=d+w
                (q.appendleft if w==0 else q.append)((d+w,v))
    return dist


def dijkstra(graph,source):
    dist=[float('inf')]*len(graph)
    dist[source]=0
    heap=[(0,source)]
    while heap:
        d,u=heapq.heappop(heap)
        if d!=dist[u]:continue
        for v,w in graph[u]:
            if d+w<dist[v]:
                dist[v]=d+w
                heapq.heappush(heap,(d+w,v))
    return dist


for _ in range(200):
    graph=[[(v,rng.randrange(2)) for v in range(6) if rng.random()<.3] for u in range(6)]
    for source in range(6):
        assert zero_one(graph,source)==dijkstra(graph,source)

# Every user's score is complete in exactly one shard, with one total ordering.
for _ in range(200):
    rows=[(rng.randint(0,20),i) for i in range(30)]
    shards=[[] for _ in range(4)]
    for row in rows: shards[rng.randrange(4)].append(row)
    k=rng.randint(0,10)
    candidates=[r for s in shards for r in sorted(s,reverse=True)[:k]]
    assert sorted(candidates,reverse=True)[:k]==sorted(rows,reverse=True)[:k]

print('PASS: 651 coin cases; 200 knapsack subsets; stable counting and all signed 8-bit keys; 5151 sieve intervals; 1200 graph searches; 200 sharded top-K cases')
