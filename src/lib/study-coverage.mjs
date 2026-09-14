import fs from 'node:fs';
import { questions } from './questions.mjs';
import { notes, notesForQuestion } from './notes.mjs';

export function validateCoverageReviews(reviews, catalog, studyNotes) {
  const seen = new Set();
  for (const review of reviews) {
    const question = catalog.find(({ id }) => id === review.questionId);
    const note = studyNotes.find(({ id }) => id === review.noteId);
    if (!question || !note || seen.has(review.questionId)) throw new Error('학습 범위 검토: 대상 누락 또는 중복');
    seen.add(review.questionId);
    if (!note.questionIds.includes(question.id)) throw new Error('학습 범위 검토: 직접 연결된 문항만 판정할 수 있습니다.');
    if (!['covered', 'partial'].includes(review.status) || typeof review.scope !== 'string' || !review.scope.trim()) throw new Error('학습 범위 검토: 상태 또는 설명 오류');
    if (!Array.isArray(review.sections) || !review.sections.length || review.sections.some((id) => !note.toc.some((section) => section.id === id))) throw new Error('학습 범위 검토: 근거 본문 앵커 오류');
    if (review.status === 'partial' && (typeof review.remaining !== 'string' || !review.remaining.trim())) throw new Error('학습 범위 검토: 남은 설명을 명시하세요.');
  }
  return reviews;
}

const reviews = validateCoverageReviews(JSON.parse(fs.readFileSync(`${process.cwd()}/docs/study-coverage-reviews.json`, 'utf8')), questions, notes);
const byQuestion = new Map(reviews.map((review) => [review.questionId, review]));
export const coverageLabels = { covered: '본문 검토 완료', partial: '추가 설명 필요', unreviewed: '연결만 있음 · 검토 대기', missing: '노트 연결 없음' };
export const studyCoverage = questions.map((question) => {
  const linked = notesForQuestion(question);
  const review = byQuestion.get(question.id);
  return { question, linked, review, status: review?.status || (linked.length ? 'unreviewed' : 'missing') };
});
export const coverageCounts = Object.fromEntries(Object.keys(coverageLabels).map((status) => [status, studyCoverage.filter((entry) => entry.status === status).length]));
// Source families are navigation aids, not a claim that every family needs its own note.
export const studyFamilies = questions.filter((question) => !question.promotedFrom).map((question) => ({
  question,
  entries: studyCoverage.filter((entry) => entry.question.id === question.id || entry.question.promotedFrom?.id === question.id)
    .sort((a, b) => Number(b.question.id === question.id) - Number(a.question.id === question.id)),
}));
