import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { questions } from './questions.mjs';
import { renderNoteDiagram } from './note-diagrams.mjs';

export function loadNotes(directory, catalog) {
  const ids = new Set();
  const knownQuestions = new Set(catalog.map(({ id }) => id));
  const files = (folder) => fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? files(file) : entry.isFile() && entry.name.endsWith('.md') ? [file] : [];
  });
  const loaded = files(directory).sort().map((file) => {
    const { data, content } = matter(fs.readFileSync(file, 'utf8'));
    const fail = (reason) => { throw new Error(`${file}: ${reason}`); };
    if (typeof data.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id) || ids.has(data.id)) fail('학습 노트 ID 오류 또는 중복');
    ids.add(data.id);
    for (const key of ['title', 'topic', 'summary']) if (typeof data[key] !== 'string' || !data[key].trim()) fail(`${key} 누락`);
    data.questionIds ??= [];
    if (!Array.isArray(data.questionIds) || new Set(data.questionIds).size !== data.questionIds.length
      || data.questionIds.some((id) => !knownQuestions.has(id))) fail('잘못된 연결 문항');
    for (const key of ['prerequisites', 'related']) {
      data[key] ??= [];
      if (!Array.isArray(data[key]) || new Set(data[key]).size !== data[key].length
        || data[key].some(id => typeof id !== 'string' || id === data.id)) fail(`잘못된 학습 연결: ${key}`);
    }
    if (data.reviewedAt !== undefined && (typeof data.reviewedAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(data.reviewedAt)
      || Number.isNaN(Date.parse(data.reviewedAt))
      || new Date(data.reviewedAt).toISOString().slice(0, 10) !== data.reviewedAt)) fail('잘못된 자료 확인일');
    if (!content.trimStart().startsWith(`# ${data.title}\n`)) fail('제목 불일치');
    const body = content.trimStart().slice(content.trimStart().indexOf('\n') + 1).trim();
    const toc = [];
    const renderer = new marked.Renderer();
    const code = renderer.code;
    let diagramCount = 0;
    renderer.code = function (token) {
      if (token.lang !== 'diagram') return code.call(this, token);
      try { return renderNoteDiagram(token.text, `${data.id}-diagram-${++diagramCount}`); }
      catch (error) { fail(error.message); }
    };
    renderer.heading = function (token) {
      const text = this.parser.parseInline(token.tokens);
      if (token.depth !== 2) return `<h${token.depth}>${text}</h${token.depth}>\n`;
      const id = `section-${toc.length + 1}`;
      toc.push({ id, title: token.text });
      return `<h2 id="${id}">${text}</h2>\n`;
    };
    const html = marked.parse(body, { renderer });
    if (toc.length < 3) fail('학습 노트에는 원리·예제·검증을 구분한 본문이 필요합니다.');
    const prose = html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, '').replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, '');
    if (prose.includes('**')) fail('해결되지 않은 강조 표기');
    // Notes are trusted, repository-authored Markdown, not visitor submissions.
    return { ...data, html, toc, diagramCount, file: path.relative(directory, file).split(path.sep).join('/') };
  });
  const byId = new Map(loaded.map(note => [note.id, note]));
  for (const note of loaded) {
    for (const id of [...note.prerequisites, ...note.related]) {
      if (!byId.has(id)) throw new Error(`${note.file}: 학습 연결 대상 누락: ${id}`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(note) {
    if (visiting.has(note.id)) throw new Error(`${note.file}: 선행 개념 순환`);
    if (visited.has(note.id)) return;
    visiting.add(note.id);
    note.prerequisites.forEach(id => visit(byId.get(id)));
    visiting.delete(note.id);
    visited.add(note.id);
  }
  loaded.forEach(visit);
  return loaded;
}

export const notes = loadNotes(path.join(process.cwd(), 'notes'), questions);
const byQuestion = new Map();
for (const question of questions) {
  const direct = notes.filter((note) => note.questionIds.includes(question.id));
  const inherited = question.promotedFrom ? notes.filter((note) => note.questionIds.includes(question.promotedFrom.id)) : [];
  byQuestion.set(question.id, [...new Set([...direct, ...inherited])]);
}
export const notesForQuestion = (question) => byQuestion.get(question.id) || [];
export const questionsForNote = (note) => questions.filter((question) => notesForQuestion(question).includes(note));
