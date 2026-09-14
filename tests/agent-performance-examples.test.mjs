import test from 'node:test';
import assert from 'node:assert/strict';

// Small executable models of the notes' arithmetic and state boundaries.
// These do not run an LLM, broker, distributed cache, or external payment API.
test('performance examples preserve workload denominators and backlog rates', () => {
  const durations = [...Array(1000).fill(10), 1000].sort((a, b) => a - b);
  const p99 = durations[Math.ceil(durations.length * 0.99) - 1];
  assert.equal(p99, 10);
  assert.equal((10 + 1000) / 2, 505);
  assert.equal(20 * 5 * 10 * (10 + 2), 12_000);
  assert.equal(12_000 / (1400 - 1000), 30);
  assert.equal(200 - 180, 20);
  assert.equal(200 - 160, 40);
});

test('repeated trial formulas differ from pooled task probabilities', () => {
  const p = 0.75;
  assert.equal(1 - (1 - p) ** 3, 0.984375);
  assert.equal(p ** 3, 0.421875);
  const taskProbabilities = [0, 1];
  const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
  assert.equal(mean(taskProbabilities) ** 2, 0.25);
  assert.equal(mean(taskProbabilities.map(x => x ** 2)), 0.5);
});

test('logical intent survives lost replies without merging independent intent', () => {
  const effects = new Map();
  let nextId = 0;
  function execute(key, args) {
    const canonical = JSON.stringify([args.user, args.date, args.amount]);
    const previous = effects.get(key);
    if (previous) {
      if (previous.canonical !== canonical) throw new Error('intent conflict');
      return previous.id;
    }
    const id = ++nextId;
    effects.set(key, { canonical, id });
    return id;
  }
  const args = { user: 'user-a', date: '2030-01-01', amount: 1000 };
  execute('intent-1', args); // External success; caller loses the response.
  assert.equal(execute('intent-1', args), 1);
  assert.throws(() => execute('intent-1', { ...args, amount: 2000 }), /conflict/);
  assert.equal(execute('intent-2', args), 2);
  assert.equal(effects.size, 2);
});

test('approval is bound to exact proposal and current version', () => {
  const proposal = { recipient: 'user-a', body: 'draft', attachmentVersion: 3 };
  const approval = { proposal: JSON.stringify(proposal), expectedVersion: 7 };
  function allowed(candidate, currentVersion) {
    return approval.proposal === JSON.stringify(candidate)
      && approval.expectedVersion === currentVersion;
  }
  assert.equal(allowed(proposal, 7), true);
  assert.equal(allowed({ ...proposal, recipient: 'user-b' }, 7), false);
  assert.equal(allowed({ ...proposal, attachmentVersion: 4 }, 7), false);
  assert.equal(allowed(proposal, 8), false);
});

test('late refill and cleanup cannot replace a newer generation', () => {
  let state = { generation: 3, value: null };
  const observedGeneration = state.generation;
  state = { generation: 4, value: 'new item' };
  function refill(generation, value) {
    if (state.generation !== generation) return false;
    state = { generation, value };
    return true;
  }
  function cleanup(generation) {
    if (state.generation !== generation) return false;
    state = { generation: generation + 1, value: null };
    return true;
  }
  assert.equal(refill(observedGeneration, null), false);
  assert.equal(cleanup(observedGeneration), false);
  assert.equal(state.value, 'new item');
});
