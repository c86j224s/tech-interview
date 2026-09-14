import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studyCoverage, studyFamilies, coverageCounts, validateCoverageReviews, coverageStatus } from '../src/lib/study-coverage.mjs';
import { questions } from '../src/lib/questions.mjs';

test('coverage inventory contains every question exactly once across source families', () => {
  const entries = studyFamilies.flatMap(({ entries }) => entries);
  assert.equal(entries.length, questions.length);
  assert.equal(new Set(entries.map(({ question }) => question.id)).size, questions.length);
  assert.equal(Object.values(coverageCounts).reduce((sum, value) => sum + value, 0), questions.length);
});

test('a note link is never implicitly promoted to reviewed coverage', () => {
  assert.equal(coverageStatus(undefined, []), 'missing');
  assert.equal(coverageStatus(undefined, [{ id: 'linked-only' }]), 'unreviewed');
  assert.equal(coverageStatus({ status: 'partial' }, [{ id: 'n' }]), 'partial');
  assert.equal(coverageStatus({ status: 'covered' }, [{ id: 'n' }]), 'covered');
  for (const entry of studyCoverage.filter((entry) => !entry.review)) {
    assert.equal(entry.status, entry.linked.length ? 'unreviewed' : 'missing');
  }
  for (const entry of studyCoverage.filter((entry) => entry.status === 'covered')) {
    assert.equal(entry.review?.status, 'covered');
  }
  assert.equal(studyCoverage.find(({ question }) => question.id === 'condition-variable-predicate').status, 'covered');
  const weighted = studyCoverage.find(({ question }) => question.id === 'weighted-concurrency-permits');
  assert.equal(weighted.status, 'covered');
  assert.ok(weighted.review.sections.includes('section-5'));
});

test('coverage review requires a direct target, real section and explicit remaining scope', () => {
  const catalog = [{ id: 'q' }, { id: 'child' }];
  const notes = [{ id: 'n', questionIds: ['q'], toc: [{ id: 'section-1' }] }];
  const valid = { questionId: 'q', noteId: 'n', status: 'covered', scope: 'Worked example', sections: ['section-1'] };
  assert.equal(validateCoverageReviews([valid], catalog, notes).length, 1);
  assert.throws(() => validateCoverageReviews([valid, valid], catalog, notes), /중복/);
  assert.throws(() => validateCoverageReviews([{ ...valid, questionId: 'child' }], catalog, notes), /직접/);
  assert.throws(() => validateCoverageReviews([{ ...valid, sections: ['section-99'] }], catalog, notes), /앵커/);
  assert.throws(() => validateCoverageReviews([{ ...valid, status: 'partial' }], catalog, notes), /남은 설명/);
});
