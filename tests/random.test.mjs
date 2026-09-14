import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuestionDeck, randomIndex, randomStateKey } from '../src/lib/random-questions.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
}

test('a shuffled cycle visits every other question once, including across reloads', () => {
  const ids = Array.from({ length: 1000 }, (_, i) => `q${i}`);
  const storage = memoryStorage();
  let current = ids[0];
  const seen = new Set([current]);
  for (let i = 1; i < ids.length; i++) {
    const deck = createQuestionDeck(ids, storage, () => 0);
    const next = deck.next(current);
    assert.notEqual(next, current);
    assert.ok(!seen.has(next));
    seen.add(next);
    current = next;
  }
  assert.equal(seen.size, ids.length);
  assert.notEqual(createQuestionDeck(ids, storage).next(current), current);
});

test('manual visits are removed from the remaining deck', () => {
  const deck = createQuestionDeck(['a', 'b', 'c', 'd'], memoryStorage(), () => 0);
  deck.visit('b');
  const result = [deck.next('a'), deck.next('a')];
  assert.deepEqual(new Set(result), new Set(['c', 'd']));
});

test('catalog changes retain unseen questions, add new IDs and drop removed IDs', () => {
  const storage = memoryStorage();
  storage.setItem(randomStateKey, JSON.stringify({ catalog: ['a', 'b', 'old'], remaining: ['b', 'old'] }));
  const deck = createQuestionDeck(['a', 'b', 'new'], storage, () => 0);
  assert.deepEqual(new Set([deck.next('a'), deck.next('a')]), new Set(['b', 'new']));
});

test('corrupt or unavailable storage falls back to an in-memory deck', () => {
  for (const storage of [undefined, { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }, { getItem: () => '{bad', setItem() {} }]) {
    const deck = createQuestionDeck(['a', 'b', 'c'], storage, () => 0);
    assert.deepEqual(new Set([deck.next('a'), deck.next('a')]), new Set(['b', 'c']));
  }
});

test('empty and singleton catalogs never select the current question', () => {
  assert.equal(createQuestionDeck([]).next('a'), undefined);
  assert.equal(createQuestionDeck(['a']).next('a'), undefined);
  assert.equal(createQuestionDeck(['a']).next(), 'a');
});

test('random range validation and samples stay within bounds', () => {
  assert.throws(() => randomIndex(0), RangeError);
  for (const size of [1, 2, 500, 1000, 0x100000000]) {
    for (let i = 0; i < 100; i++) {
      const value = randomIndex(size);
      assert.ok(Number.isInteger(value) && value >= 0 && value < size);
    }
  }
});
