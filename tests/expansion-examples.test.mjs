import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { notes } from '../src/lib/notes.mjs';
import { questions } from '../src/lib/questions.mjs';
import { learningContext } from '../src/lib/learning-paths.mjs';

const manifest = JSON.parse(fs.readFileSync('docs/expansion-500-1500.json', 'utf8'));

test('expansion contains exactly 130 independent notes and 500 additional questions', () => {
  const noteIds = manifest.flatMap(domain => domain.noteIds);
  const questionIds = manifest.flatMap(domain => domain.questionIds);
  assert.equal(notes.length, 500);
  assert.equal(questions.length, 1500);
  assert.equal(new Set(noteIds).size, 130);
  assert.equal(new Set(questionIds).size, 500);
  for (const id of noteIds) {
    const note = notes.find(item => item.id === id);
    assert.ok(note, id);
    assert.deepEqual(note.questionIds, []);
    assert.ok(note.toc.length >= 6, id);
    assert.ok(note.diagramCount >= 1, id);
    assert.ok(learningContext(note).routes.length, id);
    assert.ok(fs.readFileSync(`notes/${note.file}`, 'utf8').includes('https://'), id);
  }
  for (const id of questionIds) {
    const question = questions.find(item => item.id === id);
    assert.ok(question, id);
    assert.equal(question.promotedFrom, undefined);
    assert.equal(question.answerMinutes, undefined);
    const markdown = fs.readFileSync(`questions/${id}.md`, 'utf8');
    assert.doesNotMatch(markdown, /(?:합니다|입니다|됩니다|않습니다)\.(?:을|를|이|가|라는)|을\(를\)/, id);
    const answer = markdown.split('## 구두 답변')[1].split('## 득점 포인트')[0];
    const paragraphs = answer.split(/\n\s*\n/).map(x => x.trim()).filter(x => x.length > 90);
    assert.equal(new Set(paragraphs).size, paragraphs.length, id);
  }
});

function zFunction(text) {
  const z = Array(text.length).fill(0);
  let left = 0, right = 0;
  for (let i = 1; i < text.length; i++) {
    if (i < right) z[i] = Math.min(right - i, z[i - left]);
    while (i + z[i] < text.length && text[z[i]] === text[i + z[i]]) z[i]++;
    if (i + z[i] > right) { left = i; right = i + z[i]; }
  }
  return z;
}

test('string traces preserve append boundaries, separator collisions and suffix ranks', () => {
  assert.deepEqual(zFunction('aaa'), [0, 2, 1]);
  assert.deepEqual(zFunction('aaaa'), [0, 3, 2, 1]);
  assert.equal(zFunction('abcabca')[3], 4);
  assert.equal(7 % 3, 1);
  assert.equal(zFunction('a#a#a')[2], 3);
  assert.equal(zFunction('a#a#a')[4], 1);
  const text = 'banana';
  const sa = Array.from({ length: text.length }, (_, i) => i).sort((a, b) => text.slice(a).localeCompare(text.slice(b)));
  assert.deepEqual(sa, [5, 3, 1, 0, 4, 2]);
  const lcp = sa.slice(1).map((offset, i) => {
    let length = 0;
    while (text[offset + length] && text[offset + length] === text[sa[i] + length]) length++;
    return length;
  });
  assert.deepEqual(lcp, [1, 3, 0, 0, 2]);
  assert.equal(6 * 7 / 2 - lcp.reduce((a, b) => a + b, 0), 15);
  assert.equal((18 - 9) * 3 + 1, 28);
});

test('ML examples calculate actual ranking reversals, centering and probability bins', () => {
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const cosine = (a, b) => dot(a, b) / (Math.hypot(...a) * Math.hypot(...b));
  const q = [1, 0], a = [2, 2], b = [1, 0];
  assert.ok(dot(q, a) > dot(q, b));
  assert.ok(cosine(q, a) < cosine(q, b));
  const points = [[100, 100], [101, 100], [100, 101]];
  const mean = [0, 1].map(i => points.reduce((sum, p) => sum + p[i], 0) / 3);
  assert.deepEqual(mean, [301 / 3, 301 / 3]);
  const probabilities = [.76, .82, .81, .91, .70];
  const labels = [1, 0, 1, 1, 0];
  assert.ok(Math.abs(probabilities.reduce((sum, p) => sum + p, 0) / 5 - .8) < 1e-12);
  const brier = probabilities.reduce((sum, p, i) => sum + (p - labels[i]) ** 2, 0) / 5;
  assert.ok(Math.abs(brier - .25284) < 1e-12);
  const distance = (x, y) => x.reduce((sum, value, i) => sum + (value - y[i]) ** 2, 0);
  assert.ok(distance([0, 0], [2, 0]) > distance([0, 0], [0, 1]));
  assert.ok(distance([0, 0], [2, 0]) < distance([0, 0], [0, 10]));
});

test('systems and game traces preserve cache mapping, float rounding and Morton intervals', () => {
  assert.deepEqual([0, 256, 512, 768, 1024].map(address => Math.floor(address / 64) % 4), [0, 0, 0, 0, 0]);
  const f = Math.fround;
  assert.equal(f(f(f(1e8) + f(-1e8)) + f(1)), 1);
  assert.equal(f(f(1e8) + f(f(-1e8) + f(1))), 0);
  const morton = (x, y) => (x & 1) | ((y & 1) << 1) | ((x & 2) << 1) | ((y & 2) << 2);
  assert.deepEqual([morton(1, 1), morton(2, 1), morton(1, 2), morton(2, 2)].sort((a, b) => a - b), [3, 6, 9, 12]);
  assert.equal(99 - 49, 50);
  assert.equal(49 + 60, 109);
  assert.equal(.75 * 50 + .25 * Math.abs(100 - 140), 47.5);
  assert.equal(.875 * 100 + .125 * 140, 105);
});
