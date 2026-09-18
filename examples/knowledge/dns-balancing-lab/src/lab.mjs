#!/usr/bin/env node

const DEFAULTS = Object.freeze({
  arrivals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  services: [8, 1, 7, 2, 6, 2, 9, 1, 5, 3, 4, 2],
  dnsSequence: [
    { at: 0, addresses: ['A', 'B'], ttl: 5 },
    { at: 7, addresses: ['B', 'C'], ttl: 5 },
  ],
  connections: [
    { id: 'conn-1', createdAt: 0, address: 'A', reusableUntil: 20, maxStreams: 2 },
    { id: 'conn-2', createdAt: 0, address: 'B', reusableUntil: 20, maxStreams: 2 },
  ],
  backends: [
    { id: 'A', weight: 5, healthy: true },
    { id: 'B', weight: 1, healthy: true },
    { id: 'C', weight: 1, healthy: true },
  ],
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function validateInput(input) {
  const strategies = new Set(['dns', 'proxy-rr', 'proxy-weighted', 'proxy-least']);
  assert(strategies.has(input.strategy), `unknown strategy: ${input.strategy}`);
  assert(input.dnsCacheMode === 'ttl' || input.dnsCacheMode === 'fresh', 'dnsCacheMode must be ttl or fresh');
  assert(Number.isInteger(input.maxStreams) && input.maxStreams > 0, 'maxStreams must be a positive integer');
  assert(input.arrivals.length === input.services.length, 'arrivals and services length mismatch');
  assert(input.dnsSequence.length > 0, 'dnsSequence must not be empty');
  for (let index = 0; index < input.arrivals.length; index += 1) {
    assert(Number.isFinite(input.arrivals[index]) && input.arrivals[index] >= 0, 'arrivals must be finite non-negative numbers');
    assert(index === 0 || input.arrivals[index] >= input.arrivals[index - 1], 'arrivals must be non-decreasing');
    assert(Number.isFinite(input.services[index]) && input.services[index] >= 0, 'services must be finite non-negative numbers');
  }
  for (let index = 0; index < input.dnsSequence.length; index += 1) {
    const answer = input.dnsSequence[index];
    assert(Number.isFinite(answer.at) && answer.at >= 0, 'DNS answer times must be finite non-negative numbers');
    assert(index === 0 || answer.at >= input.dnsSequence[index - 1].at, 'dnsSequence must be sorted by at');
    assert(Number.isFinite(answer.ttl) && answer.ttl > 0, 'DNS TTL must be positive');
    assert(Array.isArray(answer.addresses) && answer.addresses.length > 0, 'DNS answers need at least one address');
  }
  const backendIds = new Set();
  for (const backend of input.backends) {
    assert(typeof backend.id === 'string' && backend.id.length > 0, 'backend IDs must be non-empty strings');
    assert(!backendIds.has(backend.id), `duplicate backend ID: ${backend.id}`);
    backendIds.add(backend.id);
    assert(Number.isSafeInteger(backend.weight) && backend.weight >= 0 && backend.weight <= 1_000_000, 'backend weights must be bounded non-negative integers');
    assert(typeof backend.healthy === 'boolean', 'backend healthy must be boolean');
  }
  const connectionIds = new Set();
  for (const connection of input.connections) {
    assert(typeof connection.id === 'string' && connection.id.length > 0, 'connection IDs must be non-empty strings');
    assert(!connectionIds.has(connection.id), `duplicate connection ID: ${connection.id}`);
    connectionIds.add(connection.id);
    assert(Number.isInteger(connection.maxStreams ?? input.maxStreams) && (connection.maxStreams ?? input.maxStreams) > 0, 'connection maxStreams must be a positive integer');
    assert(Number.isInteger(connection.activeStreams ?? 0) && (connection.activeStreams ?? 0) >= 0, 'activeStreams must be a non-negative integer');
  }
}

function weightedRoundRobin(backends, cursor) {
  const eligible = backends.filter((backend) => backend.healthy && backend.weight > 0);
  assert(eligible.length > 0, 'no healthy backend');
  const total = eligible.reduce((sum, backend) => sum + backend.weight, 0);
  let slot = cursor % total;
  for (const backend of eligible) {
    if (slot < backend.weight) return backend;
    slot -= backend.weight;
  }
  throw new Error('weighted selection failed');
}

function selectLeastConnections(backends, active) {
  const eligible = backends.filter((backend) => backend.healthy && backend.weight > 0);
  assert(eligible.length > 0, 'no healthy backend');
  return [...eligible].sort((left, right) => {
    const leftLoad = active.get(left.id) / left.weight;
    const rightLoad = active.get(right.id) / right.weight;
    return leftLoad - rightLoad || left.id.localeCompare(right.id);
  })[0];
}

function dnsAnswer(sequence, time) {
  let selected = sequence[0];
  for (const answer of sequence) if (answer.at <= time) selected = answer;
  return selected;
}

function openOrReuseConnection(state, time, address, maxStreams = 2) {
  const reusable = state.connections.find((connection) => (
    connection.address === address && connection.createdAt <= time && connection.reusableUntil > time && connection.activeStreams < connection.maxStreams
  ));
  if (reusable) return { connection: reusable, reused: true };
  let id;
  do {
    id = `conn-${state.nextConnectionId++}`;
  } while (state.connections.some((connection) => connection.id === id));
  const connection = {
    id,
    createdAt: time,
    address,
    reusableUntil: time + 20,
    maxStreams,
    activeStreams: 0,
  };
  state.connections.push(connection);
  return { connection, reused: false };
}

function simulate({ arrivals, services, dnsSequence, connections, backends, strategy = 'dns', dnsCacheMode = 'ttl', maxStreams = 2 } = {}) {
  const input = {
    arrivals: arrivals ?? DEFAULTS.arrivals,
    services: services ?? DEFAULTS.services,
    dnsSequence: dnsSequence ?? DEFAULTS.dnsSequence,
    connections: connections ?? DEFAULTS.connections,
    backends: backends ?? DEFAULTS.backends,
    strategy,
    dnsCacheMode,
    maxStreams,
  };
  validateInput(input);
  const state = {
    connections: clone(input.connections).map((connection) => ({ ...connection, activeStreams: connection.activeStreams ?? 0 })),
    nextConnectionId: 1,
    dns: null,
    dnsExpiresAt: -1,
    rrCursor: 0,
    active: new Map(input.backends.map((backend) => [backend.id, 0])),
    rows: [],
  };
  const completions = [];
  const backendMap = new Map(clone(input.backends).map((backend) => [backend.id, backend]));
  const release = (completion) => {
    const connection = state.connections.find((candidate) => candidate.id === completion.connectionId);
    if (connection) connection.activeStreams -= 1;
    state.active.set(completion.backend, state.active.get(completion.backend) - 1);
  };
  for (let index = 0; index < input.arrivals.length; index += 1) {
    const time = input.arrivals[index];
    for (let cursor = completions.length - 1; cursor >= 0; cursor -= 1) {
      if (completions[cursor].doneAt <= time) release(completions.splice(cursor, 1)[0]);
    }
    const answer = dnsAnswer(input.dnsSequence, time);
    const cacheValid = input.dnsCacheMode === 'ttl' && state.dns && state.dnsExpiresAt > time;
    if (!cacheValid) {
      state.dns = { ...answer, addresses: [...answer.addresses] };
      state.dnsExpiresAt = time + answer.ttl;
    }
    let selected;
    let dnsReturned = [...state.dns.addresses];
    let reused = false;
    let connectionId = null;
    if (input.strategy === 'proxy-rr') {
      selected = weightedRoundRobin([...backendMap.values()], state.rrCursor);
      state.rrCursor += 1;
    } else if (input.strategy === 'proxy-weighted') {
      selected = weightedRoundRobin([...backendMap.values()], state.rrCursor);
      state.rrCursor += 1;
    } else if (input.strategy === 'proxy-least') {
      selected = selectLeastConnections([...backendMap.values()], state.active);
    } else {
      const address = dnsReturned[index % dnsReturned.length];
      selected = backendMap.get(address);
      assert(selected?.healthy, `DNS returned unhealthy backend ${address}; DNS did not health-route`);
      const opened = openOrReuseConnection(state, time, address, input.maxStreams);
      reused = opened.reused;
      connectionId = opened.connection.id;
    }
    const activeBefore = [...state.active.entries()].map(([id, count]) => ({ id, count }));
    state.active.set(selected.id, state.active.get(selected.id) + 1);
    if (connectionId) {
      const connection = state.connections.find((candidate) => candidate.id === connectionId);
      connection.activeStreams += 1;
    }
    const row = {
      request: `req-${index + 1}`,
      arrival: time,
      service: input.services[index],
      dnsReturned,
      dnsCacheExpiresAt: state.dnsExpiresAt,
      selected: selected.id,
      strategy: input.strategy,
      reused,
      connection: connectionId,
      activeBefore,
      doneAt: time + input.services[index],
    };
    state.rows.push(row);
    completions.push({ doneAt: row.doneAt, backend: selected.id, connectionId });
  }
  return {
    input: clone(input),
    requests: state.rows,
    summary: Object.fromEntries([...state.active.entries()].map(([id, count]) => [id, count])),
    connections: state.connections,
  };
}

function main() {
  const result = {
    dnsWeighted: simulate({ strategy: 'dns' }),
    proxyWeighted: simulate({ strategy: 'proxy-weighted' }),
    proxyLeast: simulate({ strategy: 'proxy-least' }),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export { DEFAULTS, simulate, weightedRoundRobin, selectLeastConnections };

if (import.meta.url === `file://${process.argv[1]}`) main();
