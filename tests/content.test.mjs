import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const loader = new URL('../src/lib/questions.mjs', import.meta.url).href;

test('all rendered prose resolves emphasis without changing code literals', async () => {
  const { questions } = await import(loader);
  for (const question of questions) {
    for (const html of question.sections) {
      const prose = html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, '').replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, '');
      assert.ok(!prose.includes('**'), `${question.id}: unresolved bold delimiter`);
    }
  }
  const asyncAnswer = questions.find(({ id }) => id === 'async-api-and-blocking').sections[0];
  assert.ok(asyncAnswer.includes('<strong>비동기</strong>(asynchronous)라고'));
  const nilAnswer = questions.find(({ id }) => id === 'go-interface-typed-nil').sections[0];
  assert.ok(nilAnswer.includes('<code>*MyError</code>'));
  assert.ok(!nilAnswer.includes('<em>MyError'));
});
test('enriched answers keep followup context and readable Markdown structure', async () => {
  const { questions } = await import(loader);
  assert.equal(questions.length, 350);
  assert.equal(questions.filter(({ category }) => category === 'AI 에이전트').length, 50);
  assert.ok(questions.every(({ answerMinutes }) => answerMinutes === 5));
  assert.equal(questions.reduce((count, { followups }) => count + followups.length, 0), questions.length * 3);
  for (const question of questions.filter(({ answerMinutes }) => answerMinutes === 5)) {
    assert.equal(question.followups.length, 3, `${question.id}: three contextual followups`);
    const markdown = fs.readFileSync(path.join('questions', `${question.id}.md`), 'utf8');
    const answer = markdown.split('## 구두 답변')[1].split('## 득점 포인트')[0];
    const paragraphs = answer.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length > 80);
    assert.equal(new Set(paragraphs).size, paragraphs.length, `${question.id}: repeated paragraph`);
    for (const line of answer.split('\n')) {
      assert.ok(!line.includes('```') || line.startsWith('```'), `${question.id}: fence must start on its own line`);
    }
    assert.ok(!/<h3[^>]*>[^<]*<\/h3>\s*(?:<h3|$)/.test(question.sections[0]), `${question.id}: empty subsection`);
  }
});

function fixture(metadata) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-content-'));
  fs.mkdirSync(path.join(directory, 'questions'));
  const entries = ['a', 'b', 'c', 'd'].map((id) => ({ id, question: `Question ${id}?` }));
  fs.writeFileSync(path.join(directory, 'question-index.json'), JSON.stringify(entries));
  for (const { id, question } of entries) {
    fs.writeFileSync(path.join(directory, 'questions', `${id}.md`), `---\nid: ${id}\ntitle: ${JSON.stringify(question)}\ndifficulty: 하\ncategory: Test\ntags: [test]\nrelated: ${id === 'a' ? '[b, c]' : '[]'}\n${id === 'a' ? metadata : ''}\n---\n# ${question}\n\n## 구두 답변\nAnswer.\n\n## 득점 포인트\n- Point\n\n## 감점 포인트\n- Point\n\n## 더 파고들 거리\n- Point\n`);
  }
  try {
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `const {questions,relatedQuestions}=await import(${JSON.stringify(loader)}); console.log(JSON.stringify({question:questions[0],related:relatedQuestions(questions[0])}));`], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('existing content needs no new metadata', () => {
  const result = fixture('');
  assert.deepEqual(result.question.followups, []);
  assert.equal(result.question.answerMinutes, undefined);
  assert.deepEqual(result.related.map(({ id }) => id), ['b', 'c', 'd']);
});

test('curated followups precede related concepts without duplicate cards', () => {
  const result = fixture('answerMinutes: 5\nfollowups: [{id: c, prompt: "조건이 달라지면?"}]');
  assert.equal(result.question.answerMinutes, 5);
  assert.deepEqual(result.related.map(({ id }) => id), ['c', 'b', 'd']);
  assert.equal(result.related[0].followupPrompt, '조건이 달라지면?');
  assert.equal(result.related[1].followupPrompt, undefined);
});

for (const [name, metadata, message] of [
  ['missing target', 'followups: [{id: missing, prompt: "왜?"}]', '잘못되거나 중복된 꼬리 질문 ID'],
  ['self link', 'followups: [{id: a, prompt: "왜?"}]', '잘못되거나 중복된 꼬리 질문 ID'],
  ['duplicate link', 'followups: [{id: b, prompt: "왜?"}, {id: b, prompt: "다음은?"}]', '잘못되거나 중복된 꼬리 질문 ID'],
  ['empty prompt', 'followups: [{id: b, prompt: " "}]', '꼬리 질문의 연결 맥락이 필요합니다'],
  ['extra field', 'followups: [{id: b, prompt: "왜?", extra: 1}]', '꼬리 질문에는 id와 prompt가 필요합니다'],
  ['too many', 'followups: [{id: b, prompt: "왜?"}, {id: c, prompt: "왜?"}, {id: d, prompt: "왜?"}, {id: a, prompt: "왜?"}]', '꼬리 질문은 최대 3개'],
  ['invalid duration', 'answerMinutes: "5"', '보강 답변의 목표 시간은 5분'],
]) {
  test(`reject ${name}`, () => {
    assert.throws(() => fixture(metadata), (error) => error.stderr.includes(message));
  });
}
