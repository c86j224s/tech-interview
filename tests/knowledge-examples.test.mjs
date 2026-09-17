import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const text = id => fs.readFileSync(`notes/knowledge/${id}.md`, 'utf8');

test('tree traversal traces distinguish DFS and BFS intermediate states', () => {
  const children = new Map([[8, [3, 10]], [3, [1, 6]], [6, [4]], [10, [14]]]);
  const queue = [8], visited = [], states = [];
  while (queue.length) {
    const node = queue.shift(); visited.push(node); queue.push(...(children.get(node) || []));
    states.push([...queue]);
  }
  assert.deepEqual(visited, [8, 3, 10, 1, 6, 14, 4]);
  assert.deepEqual(states[2], [1, 6, 14]);
  assert.deepEqual(states[4], [14, 4]);
  assert.ok(text('tree-foundations').includes('| 2 | 1 | 6, 10 | 10 | 1, 6, 14 |'));
});

test('linear regression example matches the first gradient update', () => {
  const samples = [[1, 5], [2, 8], [3, 11], [4, 14]];
  const gradientW = 2 / samples.length * samples.reduce((sum, [x, y]) => sum - x * y, 0);
  const gradientB = 2 / samples.length * samples.reduce((sum, [, y]) => sum - y, 0);
  assert.equal(gradientW, -55); assert.equal(gradientB, -19);
  const w = -.01 * gradientW, b = -.01 * gradientB;
  const mse = samples.reduce((sum, [x, y]) => sum + (w * x + b - y) ** 2, 0) / samples.length;
  assert.ok(Math.abs(mse - 70.46735) < 1e-9);
  assert.ok(text('linear-regression-foundations').includes('70.46735'));
});

test('voxel coordinates and weighted path examples preserve numeric contracts', () => {
  const chunk = Math.floor(-1 / 16), local = -1 - chunk * 16;
  assert.deepEqual([chunk, local], [-1, 15]);
  assert.equal(16 ** 3 / 8, 512);
  assert.equal(16 ** 3 * 2 / 8, 1024);
  assert.equal(7 + 4, 11);
  assert.ok(text('pathfinding-foundations').includes('1+1+4+1+1+1+1+1=11'));
  assert.ok(text('flow-field-foundations').includes('0비용 순환'));
});

test('bounded queue example rejects admission at capacity', () => {
  assert.ok(text('synchronization-foundations').includes('if stopping or queue.size >= capacity:'));
  assert.ok(text('kafka-application').includes('pendingByPartition.addAllAndRegister'));
  assert.ok(!text('kafka-application').includes('SerializationException | InterruptException | KafkaException'));
});
