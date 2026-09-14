import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNoteDiagram } from '../src/lib/note-diagrams.mjs';

const diagram = {
  title: '요청 처리 경계', caption: '화살표는 요청 순서입니다.',
  rows: [[{ id: 'request', label: '요청', detail: ['키 <A> 확인'] }], [{ id: 'commit', label: '커밋' }]],
  edges: [{ from: 'request', to: 'commit', label: '성공하면' }],
};
const render = (value) => renderNoteDiagram(JSON.stringify(value), 'test-diagram-1');

test('diagrams render static accessible SVG and a readable equivalent', () => {
  const html = render(diagram);
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('role="img" aria-labelledby="test-diagram-1-title test-diagram-1-desc"'));
  assert.ok(html.includes('<title id="test-diagram-1-title">요청 처리 경계</title>'));
  assert.ok(html.includes('marker-end="url(#test-diagram-1-arrow)"'));
  assert.ok(html.includes('그림을 글로 읽기'));
  assert.ok(html.includes('요청 → 커밋: 성공하면'));
  assert.ok(html.includes('키 &lt;A&gt; 확인'));
  assert.ok(!html.includes('<script'));
});

test('backward and skip-level relationships use outer lanes', () => {
  const html = render({ ...diagram, rows: [...diagram.rows, [{ id: 'result', label: '결과' }]], edges: [{ from: 'result', to: 'request', label: '다시 확인' }] });
  assert.ok(html.includes('rotate(-90)'));
  assert.ok(html.includes('결과 → 요청: 다시 확인'));
});

test('class diagrams separate names from responsibility lines', () => {
  assert.ok(render({ ...diagram, kind: 'class' }).includes('diagram-divider'));
});

test('diagrams reject malformed content rather than publishing broken figures', () => {
  assert.throws(() => renderNoteDiagram('{', 'id'), /JSON/);
  assert.throws(() => renderNoteDiagram(JSON.stringify(diagram), '"bad'), /그림 ID/);
  assert.throws(() => render({ ...diagram, caption: '' }), /제목과 설명/);
  assert.throws(() => render({ ...diagram, rows: [] }), /행은/);
  assert.throws(() => render({ ...diagram, rows: [[{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }]] }), /중복/);
  assert.throws(() => render({ ...diagram, edges: [{ from: 'request', to: 'missing', label: 'x' }] }), /연결 대상/);
  assert.throws(() => render({ ...diagram, edges: [{ from: 'request', to: 'request', label: 'x' }] }), /자기 연결/);
  assert.throws(() => render({ ...diagram, kind: 'unknown' }), /종류/);
});

test('diagram strings are escaped in attributes, labels and text alternatives', () => {
  const html = render({ ...diagram, title: '\"><img src=x onerror=alert(1)>', caption: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
