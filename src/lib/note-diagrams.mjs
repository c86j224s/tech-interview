const escape = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const text = (value) => typeof value === 'string' && value.trim().length > 0;

export function renderNoteDiagram(source, id) {
  const fail = (message) => { throw new Error(`학습 노트 그림: ${message}`); };
  let diagram;
  try { diagram = JSON.parse(source); } catch { fail('JSON 형식 오류'); }
  if (!diagram || !text(diagram.title) || !text(diagram.caption)) fail('제목과 설명이 필요합니다.');
  if (diagram.kind !== undefined && diagram.kind !== 'class') fail('지원하지 않는 그림 종류');
  if (!Array.isArray(diagram.rows) || !diagram.rows.length || diagram.rows.length > 12) fail('행은 1~12개여야 합니다.');
  const nodes = new Map();
  for (const row of diagram.rows) {
    if (!Array.isArray(row) || !row.length || row.length > 3) fail('한 행에는 노드 1~3개가 필요합니다.');
    for (const node of row) {
      if (!node || !text(node.id) || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(node.id) || nodes.has(node.id)) fail('노드 ID 오류 또는 중복');
      if (!text(node.label) || (node.detail !== undefined && (!Array.isArray(node.detail) || node.detail.length > 3 || node.detail.some((line) => !text(line))))) fail('노드 이름 또는 설명 오류');
      nodes.set(node.id, node);
    }
  }
  if (!Array.isArray(diagram.edges)) fail('연결 배열이 필요합니다.');
  for (const edge of diagram.edges) {
    if (!edge || !nodes.has(edge.from) || !nodes.has(edge.to) || !text(edge.label)) fail('연결 대상 또는 이름 오류');
    if (edge.from === edge.to) fail('자기 연결은 별도 단계 노드로 표현하세요.');
  }

  // A small repository-owned diagram format: no browser runtime or remote fonts.
  const wrap = (value, limit = 27) => {
    const lines = [];
    let line = '', width = 0;
    for (const char of value) {
      const size = char.codePointAt(0) > 255 ? 2 : 1;
      if (width + size > limit) { lines.push(line); line = ''; width = 0; }
      line += char;
      width += size;
    }
    if (line) lines.push(line);
    return lines;
  };
  if (!text(id) || !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(id)) fail('그림 ID 오류');
  const columns = Math.max(...diagram.rows.map((row) => row.length));
  const nodeWidth = 254, columnGap = 112, margin = 76, rowGap = 112;
  const width = columns * nodeWidth + (columns - 1) * columnGap + margin * 2;
  let y = 30;
  const positions = new Map();
  for (const [rowIndex, row] of diagram.rows.entries()) {
    const formatted = row.map((node) => ({ node, title: wrap(node.label), detail: (node.detail || []).flatMap((line) => wrap(line, 30)) }));
    const height = Math.max(...formatted.map(({ title, detail }) => 32 + title.length * 24 + (detail.length ? 18 + detail.length * 21 : 0)));
    const start = (width - (row.length * nodeWidth + (row.length - 1) * columnGap)) / 2;
    formatted.forEach((entry, column) => positions.set(entry.node.id, { ...entry, x: start + column * (nodeWidth + columnGap), y, height, row: rowIndex }));
    y += height + rowGap;
  }
  const height = y - rowGap + 42;
  const svgText = (lines, x, startY, lineHeight, className) => `<text class="${className}" x="${x}" y="${startY}" text-anchor="middle">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escape(line)}</tspan>`).join('')}</text>`;
  const edges = diagram.edges.map((edge, index) => {
    const from = positions.get(edge.from), to = positions.get(edge.to);
    let path, labelX, labelY, rotate = false;
    if (from.row === to.row) {
      const right = to.x > from.x;
      const x1 = from.x + (right ? nodeWidth : 0), x2 = to.x + (right ? 0 : nodeWidth);
      const y1 = from.y + from.height / 2;
      path = `M ${x1} ${y1} H ${x2}`;
      labelX = (x1 + x2) / 2; labelY = y1 - 24;
    } else if (to.row === from.row + 1) {
      const x1 = from.x + nodeWidth / 2, x2 = to.x + nodeWidth / 2;
      const y1 = from.y + from.height, y2 = to.y;
      const middle = (y1 + y2) / 2;
      path = `M ${x1} ${y1} L ${x2} ${y2}`;
      labelX = (x1 + x2) / 2; labelY = middle - 12;
    } else {
      // Backward and skip-level edges travel outside the nodes.
      const lane = 20 + (index % 3) * 16;
      const y1 = from.y + from.height / 2, y2 = to.y + to.height / 2;
      path = `M ${from.x} ${y1} H ${lane} V ${y2} H ${to.x}`;
      labelX = lane; labelY = (y1 + y2) / 2; rotate = true;
    }
    const label = rotate
      ? `<g transform="translate(${labelX - 8} ${labelY}) rotate(-90)">${svgText(wrap(edge.label, 22), 0, 0, 17, 'diagram-edge-label')}</g>`
      : svgText(wrap(edge.label, 18), labelX, labelY, 17, 'diagram-edge-label');
    return `<path class="diagram-edge" d="${path}" marker-end="url(#${id}-arrow)"/>${label}`;
  }).join('');
  const boxes = [...positions.values()].map(({ node, title, detail, x, y, height }) => {
    const titleBottom = y + 26 + (title.length - 1) * 24;
    return `<g><rect class="diagram-node" x="${x}" y="${y}" width="${nodeWidth}" height="${height}" rx="${diagram.kind === 'class' ? 2 : 10}"/>${svgText(title, x + nodeWidth / 2, y + 29, 24, 'diagram-node-title')}${diagram.kind === 'class' && detail.length ? `<path class="diagram-divider" d="M ${x} ${titleBottom + 15} H ${x + nodeWidth}"/>` : ''}${svgText(detail, x + nodeWidth / 2, titleBottom + 39, 21, 'diagram-node-detail')}</g>`;
  }).join('');
  const description = [...nodes.values()].map((node) => `${node.label}${node.detail?.length ? `: ${node.detail.join(', ')}` : ''}`).join('. ');
  return `<figure class="note-diagram"><div class="diagram-scroll" tabindex="0" role="region" aria-label="${escape(diagram.title)} — 좌우로 스크롤"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-title ${id}-desc" viewBox="0 0 ${width} ${height}" style="width:${width}px"><title id="${id}-title">${escape(diagram.title)}</title><desc id="${id}-desc">${escape(description)}</desc><defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="diagram-arrow" d="M 0 0 L 10 5 L 0 10 Z"/></marker></defs>${edges}${boxes}</svg></div><figcaption><strong>${escape(diagram.title)}</strong> ${escape(diagram.caption)}</figcaption><details class="diagram-text"><summary>그림을 글로 읽기</summary><ul>${[...nodes.values()].map((node) => `<li>${escape(node.label)}${node.detail?.length ? `: ${escape(node.detail.join(' · '))}` : ''}</li>`).join('')}</ul><ol>${diagram.edges.map((edge) => `<li>${escape(nodes.get(edge.from).label)} → ${escape(nodes.get(edge.to).label)}: ${escape(edge.label)}</li>`).join('')}</ol></details></figure>\n`;
}
