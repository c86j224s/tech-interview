import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, simulate } from '../src/lab.mjs';

test('golden DNS trace exposes TTL caching, DNS-returned addresses, and connection reuse', () => {
  const result = simulate({ strategy: 'dns' });
  assert.deepEqual(result.requests.map((row) => row.selected), ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'B', 'C']);
  assert.deepEqual(result.requests.map((row) => row.dnsReturned), [
    ['A', 'B'], ['A', 'B'], ['A', 'B'], ['A', 'B'], ['A', 'B'], ['A', 'B'],
    ['A', 'B'], ['A', 'B'], ['A', 'B'], ['A', 'B'], ['B', 'C'], ['B', 'C'],
  ]);
  assert.deepEqual(result.requests.map((row) => row.reused), [true, true, true, true, false, true, true, true, true, true, true, false]);
  assert.equal(result.requests[6].dnsCacheExpiresAt, 10);
  assert.equal(result.requests[7].dnsCacheExpiresAt, 10);
  assert.equal(result.requests[10].dnsCacheExpiresAt, 15);
  assert.equal(result.connections.length, 4);
});

test('weighted proxy selection follows deterministic weighted slots and ignores DNS TTL', () => {
  const result = simulate({ strategy: 'proxy-weighted' });
  assert.deepEqual(result.requests.map((row) => row.selected), ['A', 'A', 'A', 'A', 'A', 'B', 'C', 'A', 'A', 'A', 'A', 'A']);
  assert.equal(result.requests.every((row) => row.reused === false), true);
  assert.equal(result.requests[7].dnsReturned.join(','), 'A,B');
});

test('least connections accounts for service duration and weights', () => {
  const result = simulate({ strategy: 'proxy-least' });
  assert.deepEqual(result.requests.map((row) => row.selected), ['A', 'B', 'B', 'C', 'A', 'C', 'A', 'C', 'C', 'B', 'A', 'A']);
  assert.equal(result.requests.every((row) => row.connection === null), true);
});

test('DNS does not remove an unhealthy address; proxy health filtering does', () => {
  const unhealthyB = DEFAULTS.backends.map((backend) => ({ ...backend, healthy: backend.id !== 'B' }));
  assert.throws(() => simulate({ strategy: 'dns', backends: unhealthyB, arrivals: [0, 1], services: [1, 1] }), /DNS returned unhealthy backend B|DNS returned unhealthy backend/);
  const proxy = simulate({ strategy: 'proxy-weighted', backends: unhealthyB, arrivals: [0, 1, 2], services: [1, 1, 1] });
  assert.deepEqual(proxy.requests.map((row) => row.selected), ['A', 'A', 'A']);
});

test('invalid and duplicate inputs fail before simulation', () => {
  assert.throws(() => simulate({ strategy: 'unsupported' }), /unknown strategy/);
  assert.throws(() => simulate({ arrivals: [0, 2, 1], services: [1, 1, 1] }), /non-decreasing/);
  assert.throws(() => simulate({ backends: [{ id: 'A', weight: 1, healthy: true }, { id: 'A', weight: 2, healthy: true }] }), /duplicate backend ID/);
  assert.throws(() => simulate({ connections: [{ id: 'conn-1', address: 'A', maxStreams: 1 }, { id: 'conn-1', address: 'B', maxStreams: 1 }] }), /duplicate connection ID/);
});

test('generated connection IDs do not collide with supplied connection IDs', () => {
  const result = simulate({
    strategy: 'dns',
    arrivals: [0],
    services: [10],
    connections: [{ id: 'conn-1', createdAt: 0, address: 'A', reusableUntil: 0, maxStreams: 1 }],
    dnsSequence: [{ at: 0, addresses: ['A'], ttl: 30 }],
  });
  assert.equal(result.requests[0].connection, 'conn-2');
});

test('long-lived HTTP/2-style streams reuse a connection until stream capacity, then open another', () => {
  const result = simulate({
    strategy: 'dns',
    arrivals: [0, 0, 0],
    services: [10, 10, 1],
    connections: [],
    dnsSequence: [{ at: 0, addresses: ['A'], ttl: 30 }],
    maxStreams: 2,
  });
  assert.deepEqual(result.requests.map((row) => row.reused), [false, true, false]);
  assert.deepEqual(result.requests.map((row) => row.connection), ['conn-1', 'conn-1', 'conn-2']);
});
