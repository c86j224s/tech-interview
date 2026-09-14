import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('JavaScript study examples preserve binding, receiver and property contracts', () => {
  const shared = [];
  for (var i = 0; i < 3; i++) shared.push(() => i);
  const separate = [];
  for (let j = 0; j < 3; j++) separate.push(() => j);
  assert.deepEqual(shared.map(f => f()), [3, 3, 3]);
  assert.deepEqual(separate.map(f => f()), [0, 1, 2]);
  assert.throws(() => { void value; let value = 1; }, ReferenceError);
  assert.throws(() => { void typeof value; let value = 1; }, ReferenceError);

  const counter = { value: 7, read() { return this.value; } };
  const detached = counter.read;
  assert.throws(() => detached(), TypeError);
  assert.equal(detached.bind(counter)(), 7);
  const box = { value: 10, makePair() {
    return { normal() { return this.value; }, arrow: () => this.value };
  } };
  const pair = box.makePair();
  pair.value = 20;
  assert.deepEqual([pair.normal(), pair.arrow()], [20, 10]);
  box.value = 30;
  assert.equal(pair.arrow.call({ value: 99 }), 30);
  function collect(prefix, event, index) { return [this.id, prefix, event, index]; }
  assert.deepEqual(collect.bind({ id: 'panel' }, 'click')('event', 2), ['panel', 'click', 'event', 2]);

  const item = Object.create({ kind: 'base' });
  item.kind = undefined;
  assert.equal(Object.hasOwn(item, 'kind'), true);
  assert.equal(item.kind, undefined);
  delete item.kind;
  assert.equal(item.kind, 'base');
  assert.equal('kind' in item, true);
  assert.equal(Object.hasOwn(item, 'kind'), false);
  let reads = 0;
  const source = { get value() { reads++; return { n: 1 }; } };
  const copy = { ...source };
  assert.equal(reads, 1);
  assert.deepEqual(Object.getOwnPropertyDescriptor(copy, 'value'), {
    value: copy.value, writable: true, enumerable: true, configurable: true,
  });
});

test('JavaScript study examples distinguish graph copy, transfer and exact integers', () => {
  const source = { prefs: { dark: false } };
  const shallow = { ...source };
  shallow.prefs.dark = true;
  assert.equal(source.prefs.dark, true);
  const graph = { a: source.prefs, b: source.prefs };
  graph.self = graph;
  const deep = structuredClone(graph);
  assert.notEqual(deep.a, graph.a);
  assert.equal(deep.a, deep.b);
  assert.equal(deep.self, deep);
  assert.throws(() => structuredClone({ fn() {} }), { name: 'DataCloneError' });
  const buffer = new ArrayBuffer(8);
  new Uint8Array(buffer)[0] = 42;
  const moved = structuredClone(buffer, { transfer: [buffer] });
  assert.equal(buffer.byteLength, 0);
  assert.equal(new Uint8Array(moved)[0], 42);

  assert.equal('' == 0, true);
  assert.equal(Number(''), 0);
  assert.equal(NaN === NaN, false);
  assert.equal(Object.is(NaN, NaN), true);
  assert.equal(Object.is(0, -0), false);
  assert.equal(new Set([NaN, NaN, 0, -0]).size, 2);
  const parsed = JSON.parse('{"id":9007199254740993}');
  assert.equal(BigInt(parsed.id), 9007199254740992n);
  assert.equal(BigInt('9007199254740993'), 9007199254740993n);
  assert.throws(() => JSON.stringify({ id: 1n }), TypeError);
  const trace = [];
  const value = { [Symbol.toPrimitive](hint) {
    trace.push(hint); return hint === 'string' ? 'label' : 4;
  } };
  assert.deepEqual([String(value), +value, value + 1], ['label', 4, 5]);
  assert.deepEqual(trace, ['string', 'number', 'default']);
});

test('Promise study examples separate recovery, failure and incomplete siblings', async () => {
  const events = [];
  await Promise.resolve('start')
    .then(() => { throw new Error('boom'); })
    .then(() => events.push('skip'))
    .catch(error => { events.push(error.message); return 'recovered'; })
    .then(value => events.push(value));
  assert.deepEqual(events, ['boom', 'recovered']);
  let siblingHandler = false;
  await assert.rejects(Promise.resolve().then(
    () => { throw new Error('success handler failed'); },
    () => { siblingHandler = true; },
  ), /success handler failed/);
  assert.equal(siblingHandler, false);
  await assert.rejects(Promise.reject(new Error('original')).finally(() => {
    throw new Error('cleanup');
  }), /cleanup/);
  const executorEvents = [];
  const rejected = new Promise(() => { executorEvents.push('executor'); throw new Error('executor'); });
  executorEvents.push('after constructor');
  await rejected.catch(() => executorEvents.push('caught'));
  assert.deepEqual(executorEvents, ['executor', 'after constructor', 'caught']);

  let finishA;
  let aFinished = false;
  const a = new Promise(resolve => { finishA = resolve; }).then(value => { aFinished = true; return value; });
  const b = Promise.reject(new Error('B'));
  await assert.rejects(Promise.all([a, b]), /B/);
  assert.equal(aFinished, false);
  finishA('A');
  assert.equal(await a, 'A');
  assert.deepEqual(await Promise.all([]), []);
  assert.deepEqual(await Promise.allSettled([]), []);
  await assert.rejects(Promise.any([]), AggregateError);
  let emptyRaceSettled = false;
  Promise.race([]).then(() => { emptyRaceSettled = true; }, () => { emptyRaceSettled = true; });
  await Promise.resolve();
  assert.equal(emptyRaceSettled, false);
});

test('Node cold module examples expose cycle initialization and scheduling context', () => {
  const dir = mkdtempSync(join(tmpdir(), 'study-runtime-'));
  try {
    writeFileSync(join(dir, 'a.mjs'), "import { b } from './b.mjs'; export const a = b + 1;");
    writeFileSync(join(dir, 'b.mjs'), "import { a } from './a.mjs'; export const b = a + 1;");
    const cycle = spawnSync(process.execPath, [join(dir, 'a.mjs')], { encoding: 'utf8' });
    assert.notEqual(cycle.status, 0);
    assert.match(cycle.stderr, /ReferenceError/);
    const code = "console.log('sync');process.nextTick(()=>console.log('tick'));Promise.resolve().then(()=>console.log('promise'));";
    for (const extension of ['cjs', 'mjs']) {
      const file = join(dir, `schedule.${extension}`);
      writeFileSync(file, code);
      const result = spawnSync(process.execPath, [file], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const lines = result.stdout.trim().split('\n');
      assert.equal(lines[0], 'sync');
      assert.deepEqual(new Set(lines.slice(1)), new Set(['tick', 'promise']));
      console.log(`${process.version} ${extension}: ${lines.join(' → ')}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
