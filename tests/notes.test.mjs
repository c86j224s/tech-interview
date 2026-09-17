import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { notes, loadNotes, notesForQuestion, questionsForNote } from '../src/lib/notes.mjs';
import { questions } from '../src/lib/questions.mjs';

test('notes contain study sections, unique anchors and valid reverse links', () => {
  assert.ok(notes.length >= 12);
  for (const id of ['quicksort', 'binary-search', 'graph-search', 'heap', 'hash-table', 'transactions', 'indexes', 'idempotency', 'cancellation', 'tcp', 'authentication', 'agent-runtime']) {
    assert.ok(notes.some((note) => note.id === id), `기존 노트 주소 보존: ${id}`);
  }
  for (const note of notes) {
    assert.ok(note.toc.length >= 3);
    assert.equal(new Set(note.toc.map(({ id }) => id)).size, note.toc.length);
    for (const heading of note.toc) assert.ok(note.html.includes(`id="${heading.id}"`));
    if (note.questionIds.length) assert.ok(questionsForNote(note).length > 0);
    assert.ok(note.diagramCount >= 1, `${note.id}: 원리를 설명하는 그림`);
    assert.equal((note.html.match(/<figure class="note-diagram">/g) || []).length, note.diagramCount);
    assert.ok(!note.html.includes('class="language-diagram"'));
    for (const question of questionsForNote(note)) assert.ok(notesForQuestion(question).includes(note));
  }
  const quicksort = notes.find(({ id }) => id === 'quicksort');
  assert.ok(quicksort.html.includes('<pre><code'));
  assert.ok(quicksort.html.includes('partition(a, lo, hi)'));
  assert.ok(notesForQuestion(questions.find(({ id }) => id === 'introsort-depth-fallback')).includes(quicksort));
  assert.deepEqual(notesForQuestion({ id: 'not-in-catalog' }), []);
});

test('note validation rejects missing targets and duplicate note IDs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'study-notes-'));
  const write = (name, id, target) => fs.writeFileSync(path.join(directory, name), `---\nid: ${id}\ntitle: Note\ntopic: Test\nsummary: Summary\nquestionIds: [${target}]\n---\n# Note\n\n## Principle\nText\n\n## Example\nText\n\n## Test\nText\n`);
  try {
    write('a.md', 'note', 'missing');
    assert.throws(() => loadNotes(directory, [{ id: 'q' }]), /잘못된 연결 문항/);
    write('a.md', 'note', 'q');
    fs.appendFileSync(path.join(directory, 'a.md'), '\n```diagram\n{"title":"broken"}\n```\n');
    assert.throws(() => loadNotes(directory, [{ id: 'q' }]), /a.md: 학습 노트 그림/);
    write('a.md', 'note', 'q');
    write('b.md', 'note', 'q');
    assert.throws(() => loadNotes(directory, [{ id: 'q' }]), /중복/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
