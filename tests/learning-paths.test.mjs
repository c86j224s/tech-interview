import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { notes, loadNotes } from '../src/lib/notes.mjs';
import { learningPaths, learningContext } from '../src/lib/learning-paths.mjs';

const scratch = process.env.TMPDIR || os.tmpdir();

test('knowledge chapters exist independently of questions and have learning connections', () => {
  const standalone = notes.filter(note => note.file.startsWith('knowledge/'));
  assert.equal(standalone.length, 36);
  for (const note of standalone) {
    assert.deepEqual(note.questionIds, []);
    assert.ok(note.prerequisites.length);
    assert.ok(note.related.length);
    assert.equal(note.reviewedAt, '2026-09-17');
    assert.ok(note.toc.length >= 6);
    assert.ok(learningContext(note).routes.length, note.id);
  }
  for (const route of learningPaths) {
    assert.equal(new Set(route.notes.map(note => note.id)).size, route.notes.length);
  }
  const intro = notes.find(note => note.id === 'reference-counting-foundations');
  assert.ok(learningContext(intro).followups.some(note => note.id === 'concurrent-ownership'));
});

test('note links target canonical published URLs, never local source paths', () => {
  const byId = new Map(notes.map(note => [note.id, note]));
  for (const note of notes) {
    for (const [, href] of note.html.matchAll(/href="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      assert.ok(!href.includes('/Users/') && !href.endsWith('.md'), `${note.id}: ${href}`);
      if (!href.startsWith('/tech-interview/notes/')) continue;
      const match = href.match(/^\/tech-interview\/notes\/([^/]+)\/(?:#(section-\d+))?$/);
      assert.ok(match, `${note.id}: ${href}`);
      const target = byId.get(match[1]);
      assert.ok(target, `${note.id}: ${href}`);
      if (match[2]) assert.ok(target.toc.some(section => section.id === match[2]));
    }
  }
});

test('optional questions and learning metadata reject broken graphs and dates', () => {
  fs.mkdirSync(scratch, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratch, 'knowledge-metadata-'));
  const write = (id, extra = '') => fs.writeFileSync(path.join(directory, `${id}.md`), `---\nid: ${id}\ntitle: ${id}\ntopic: Test\nsummary: Summary\n${extra}\n---\n# ${id}\n\n## 원리\nText\n\n## 예제\nText\n\n## 검증\nText\n`);
  try {
    write('a');
    assert.deepEqual(loadNotes(directory, [])[0].questionIds, []);
    write('a', 'prerequisites: [missing]');
    assert.throws(() => loadNotes(directory, []), /대상 누락/);
    write('a', 'prerequisites: [a]');
    assert.throws(() => loadNotes(directory, []), /학습 연결/);
    write('a', 'prerequisites: [b]'); write('b', 'prerequisites: [a]');
    assert.throws(() => loadNotes(directory, []), /순환/);
    write('b'); write('a', "reviewedAt: '2026-02-30'");
    assert.throws(() => loadNotes(directory, []), /확인일/);
    write('a', 'questionIds: [missing]');
    assert.throws(() => loadNotes(directory, []), /연결 문항/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
