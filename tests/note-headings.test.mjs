import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { notes } from '../src/lib/notes.mjs';

// Catch known sentence endings; noun-phrase meaning still needs editorial review.
const sentenceEnding = /(?:[?？]|(?:습니다|합니다|됩니다|입니다|아닙니다|봅니다|셉니다|나눕니다|줍니다|둡니다|씁니다|냅니다|갑니다|하나요|되나요|할까요|될까요|보겠습니다)[.!]?)$/;

test('all internal note headings avoid sentence endings and remain unique', () => {
  for (const note of notes) {
    const { content } = matter(fs.readFileSync(path.join('notes', note.file), 'utf8'));
    const headings = [];
    marked.walkTokens(marked.lexer(content), token => {
      if (token.type === 'heading' && token.depth >= 2) headings.push(token.text);
    });
    for (const title of headings) {
      assert.ok(!sentenceEnding.test(title), `${note.id}: 문장형 섹션 제목 — ${title}`);
    }
    assert.equal(new Set(headings).size, headings.length, `${note.id}: 중복 섹션 제목`);
  }
});

test('section URLs use ordinal anchors independently of heading wording', () => {
  for (const note of notes) {
    assert.deepEqual(note.toc.map(section => section.id), note.toc.map((_, index) => `section-${index + 1}`));
  }
});
