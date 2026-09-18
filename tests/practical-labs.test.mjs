import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { notes } from '../src/lib/notes.mjs';
import { learningContext } from '../src/lib/learning-paths.mjs';

const labs = {
  'linux-io-bounded-loop': 'linux-io-lab',
  'windows-io-lab': 'windows-io-lab',
  'ownership-sync-lab': 'ownership-sync-lab',
  'java-access-and-collections-lab': 'java-access-and-collections-lab',
  'pathfinding-lab': 'pathfinding-lab',
  'recast-voxel-reference-lab': 'recast-voxel-lab',
  'auth-protocol-lab': 'auth-protocol-lab',
  'msa-local-saga-lab': 'msa-lab',
  'kafka-lab': 'kafka-lab',
  'pulsar-producer-consumer-lab': 'pulsar-producer-consumer-lab',
  'os-foundations-lab': 'os-foundations-lab',
  'dns-balancing-lab': 'dns-balancing-lab',
  'sorting-lab': 'sorting-lab',
  'web-platform-rendering-lab': 'web-platform-lab',
  'python-runtime-lab': 'python-runtime-lab',
  'ios-initialization-arc-storage': 'ios-lab',
};

test('all sixteen practical chapters have source packages and independent learning routes', () => {
  for (const [id, directory] of Object.entries(labs)) {
    const note = notes.find(item => item.id === id);
    assert.ok(note, id);
    assert.deepEqual(note.questionIds, []);
    assert.ok(learningContext(note).routes.length, id);
    assert.ok(fs.existsSync(`examples/knowledge/${directory}/README.md`), directory);
    const source = fs.readFileSync(`notes/${note.file}`, 'utf8');
    assert.doesNotMatch(source, /<proposal-root>|scratch\/full-knowledge|현재 산출물은.*제안/, id);
    assert.ok(note.reviewedAt >= '2026-09-18', id);
  }
});
