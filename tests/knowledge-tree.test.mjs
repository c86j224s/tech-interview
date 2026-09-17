import test from 'node:test';
import assert from 'node:assert/strict';
import { notes } from '../src/lib/notes.mjs';
import { knowledgeTree, knowledgePaths, buildKnowledgeTree } from '../src/lib/knowledge-tree.mjs';

test('every article has exactly one canonical knowledge path', () => {
  const entries = [];
  function walk(node) {
    entries.push(...node.entries.map(note => note.id));
    node.children.forEach(walk);
    assert.equal(node.count, node.entries.length + node.children.reduce((sum, child) => sum + child.count, 0));
  }
  walk(knowledgeTree);
  assert.equal(entries.length, notes.length);
  assert.equal(new Set(entries).size, notes.length);
  assert.equal(knowledgePaths.size, notes.length);
  assert.deepEqual(knowledgePaths.get('iocp-completion').map(node => node.title), ['기술 지식', '컴퓨터 과학', '운영체제', '입출력', 'IOCP']);
  assert.deepEqual(knowledgePaths.get('java-shared-state').map(node => node.title), ['기술 지식', '프로그래밍 언어', 'Java', 'JVM·동시성']);
});

test('each top-level domain starts with its foundation article', () => {
  const foundations = {
    'computer-science': 'computer-science-foundations',
    languages: 'programming-language-foundations',
    'data-systems': 'data-system-foundations',
    'software-design': 'software-design-foundations',
    operations: 'operations-foundations',
    security: 'security-foundations',
    clients: 'client-foundations',
    game: 'game-server-foundations',
    ai: 'learning-agent-foundations',
  };
  assert.deepEqual(knowledgeTree.children.map(node => node.id).sort(), Object.keys(foundations).sort());
  for (const domain of knowledgeTree.children) {
    const id = foundations[domain.id];
    assert.equal(domain.entries[0]?.id, id);
    assert.deepEqual(knowledgePaths.get(id).map(node => node.id), ['knowledge', domain.id]);
  }
});

test('classification fails on omitted, duplicate, or unknown articles', () => {
  const node = { id: 'root', title: '분류', noteIds: ['a'], children: [] };
  assert.throws(() => buildKnowledgeTree(node, [{ id: 'a' }, { id: 'b' }]), /미분류/);
  assert.throws(() => buildKnowledgeTree({ ...node, noteIds: ['a', 'a'] }, [{ id: 'a' }]), /중복/);
  assert.throws(() => buildKnowledgeTree(node, []), /누락/);
  assert.throws(() => buildKnowledgeTree({ ...node, children: [{ ...node, noteIds: [] }] }, [{ id: 'a' }]), /중복 지식 분류/);
});
