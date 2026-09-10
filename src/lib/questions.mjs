import fs from 'node:fs';
import matter from 'gray-matter';
import { marked } from 'marked';
import { pathToFileURL } from 'node:url';

const root = pathToFileURL(`${process.cwd()}/`);
const directory = new URL('questions/', root);
export const difficulties = ['하', '중하'];
const sectionNames = ['구두 답변', '득점 포인트', '감점 포인트', '더 파고들 거리'];
const normalize = (value) => value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '');

export function loadQuestions() {
  const entries = JSON.parse(fs.readFileSync(new URL('question-index.json', root), 'utf8'));
  if (!Array.isArray(entries) || !entries.length) throw new Error('질문 인덱스가 비어 있습니다.');
  const ids = new Set();
  const titles = new Set();
  for (const entry of entries) {
    if (Object.keys(entry).sort().join(',') !== 'id,question' || typeof entry.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || typeof entry.question !== 'string' || !entry.question.trim()) {
      throw new Error('인덱스에는 유효한 id와 question만 필요합니다.');
    }
    if (ids.has(entry.id) || titles.has(normalize(entry.question))) throw new Error(`중복 문항: ${entry.id}`);
    ids.add(entry.id);
    titles.add(normalize(entry.question));
  }
  if (entries.map((entry) => entry.id).join() !== [...ids].sort().join()) throw new Error('인덱스를 ID 오름차순으로 정렬하세요.');
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.md')).sort();
  if (files.join() !== [...ids].sort().map((id) => `${id}.md`).join()) throw new Error('인덱스와 문항 파일이 일치하지 않습니다.');

  return entries.map(({ id, question }, index) => {
    const { data, content } = matter(fs.readFileSync(new URL(`${id}.md`, directory), 'utf8'));
    const fail = (message) => { throw new Error(`${id}: ${message}`); };
    if (data.id !== id || data.title !== question || !content.trimStart().startsWith(`# ${question}\n`)) fail('ID 또는 제목 불일치');
    if (typeof data.category !== 'string' || !data.category.trim()) fail('카테고리 누락');
    if (!difficulties.includes(data.difficulty)) fail('난이도는 하 또는 중하로 지정하세요.');
    for (const key of ['tags', 'related']) {
      if (!Array.isArray(data[key]) || data[key].some((value) => typeof value !== 'string' || !value.trim()) || new Set(data[key]).size !== data[key].length) fail(`${key} 형식 오류`);
    }
    if (!data.tags.length) fail('태그 누락');
    if (data.related.some((related) => !ids.has(related) || related === id)) fail('잘못된 연관 문항');
    if (data.answerMinutes !== undefined && data.answerMinutes !== 5) fail('보강 답변의 목표 시간은 5분으로 지정하세요.');
    const followups = data.followups ?? [];
    if (!Array.isArray(followups) || followups.length > 3) fail('꼬리 질문은 최대 3개까지 연결하세요.');
    const followupIds = new Set();
    for (const followup of followups) {
      if (!followup || typeof followup !== 'object' || Object.keys(followup).sort().join(',') !== 'id,prompt') fail('꼬리 질문에는 id와 prompt가 필요합니다.');
      if (!ids.has(followup.id) || followup.id === id || followupIds.has(followup.id)) fail('잘못되거나 중복된 꼬리 질문 ID');
      if (typeof followup.prompt !== 'string' || !followup.prompt.trim()) fail('꼬리 질문의 연결 맥락이 필요합니다.');
      followupIds.add(followup.id);
    }
    const headings = [...content.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    if (headings.join() !== sectionNames.join()) fail('본문 섹션 불일치');
    const sections = content.split(/^## .+\n/gm).slice(1).map((part) => part.trim());
    if (sections.some((part) => !part)) fail('빈 본문 섹션');
    for (const section of sections.slice(1)) {
      if (section.split('\n').filter((line) => line.trim()).some((line) => !line.startsWith('- '))) fail('점검·심화 항목은 불릿으로 작성하세요.');
    }
    // Markdown is trusted, repository-authored content; visitors cannot submit it.
    return { ...data, followups, number: index + 1, sections: sections.map((text) => marked.parse(text)) };
  });
}

export const questions = loadQuestions();
export const categories = [...new Set(questions.map((question) => question.category))];
export const tags = [...new Set(questions.flatMap((question) => question.tags))].sort((a, b) => a.localeCompare(b, 'ko'));

export function relatedQuestions(question) {
  const followups = question.followups.map(({ id, prompt }) => ({ ...questions.find((item) => item.id === id), followupPrompt: prompt }));
  const selected = new Set([...question.related, ...question.followups.map(({ id }) => id)]);
  const explicit = question.related.filter((id) => !question.followups.some((item) => item.id === id)).map((id) => questions.find((item) => item.id === id));
  const inferred = questions
    .filter((item) => item.id !== question.id && !selected.has(item.id))
    .map((item) => ({ item, score: (item.category === question.category ? 2 : 0) + item.tags.filter((tag) => question.tags.includes(tag)).length + (item.related.includes(question.id) ? 3 : 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
  return [...followups, ...explicit, ...inferred].slice(0, 3);
}
