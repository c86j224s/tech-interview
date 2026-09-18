const trace = document.querySelector('#trace');
const accordion = document.querySelector('#demo-accordion');
const trigger = document.querySelector('#accordion-trigger');
const panel = document.querySelector('#accordion-panel');
const status = document.querySelector('#status');
const variantBadge = document.querySelector('#variant-badge');
const diagnostic = document.querySelector('#diagnostic');
const metrics = {
  color: document.querySelector('#metric-color'),
  display: document.querySelector('#metric-display'),
  padding: document.querySelector('#metric-padding'),
  pseudo: document.querySelector('#metric-pseudo'),
  rect: document.querySelector('#metric-rect')
};
let traceNumber = 0;

function record(label, detail) {
  traceNumber += 1;
  const item = document.createElement('li');
  item.textContent = `${traceNumber}. ${label}: ${detail}`;
  trace.append(item);
  while (trace.children.length > 100) trace.firstElementChild.remove();
}

function readRenderState(reason) {
  const computed = getComputedStyle(trigger);
  const pseudo = getComputedStyle(trigger, '::after').content;
  const rect = trigger.getBoundingClientRect();
  metrics.color.textContent = computed.color;
  metrics.display.textContent = computed.display;
  metrics.padding.textContent = `${computed.paddingBlockStart} / ${computed.paddingBlockEnd}`;
  metrics.pseudo.textContent = pseudo;
  metrics.rect.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} at (${Math.round(rect.x)}, ${Math.round(rect.y)})`;
  record(reason, `DOM aria-expanded=${trigger.getAttribute('aria-expanded')}; display=${computed.display}; rect=${Math.round(rect.width)}×${Math.round(rect.height)}; ::after=${pseudo}`);
}

function setExpanded(expanded) {
  trigger.setAttribute('aria-expanded', String(expanded));
  panel.hidden = !expanded;
  trigger.querySelector('.accordion__icon').textContent = expanded ? '−' : '+';
  status.textContent = expanded ? '아코디언이 열려 있습니다.' : '아코디언은 닫혀 있습니다.';
  readRenderState(expanded ? '열기 후 관찰' : '닫기 후 관찰');
}

trigger.addEventListener('click', () => setExpanded(trigger.getAttribute('aria-expanded') !== 'true'));

document.querySelectorAll('[data-variant]').forEach((button) => {
  button.addEventListener('click', () => {
    const variant = button.dataset.variant;
    accordion.className = `accordion accordion--${variant}`;
    variantBadge.textContent = button.textContent;
    document.querySelectorAll('[data-variant]').forEach((candidate) => {
      candidate.className = candidate === button ? 'button button--primary' : 'button button--secondary';
    });
    readRenderState(`variant=${variant}`);
  });
});

document.querySelector('#reset-trace').addEventListener('click', () => {
  trace.replaceChildren();
  traceNumber = 0;
  record('기록 초기화', '다음 DOM/CSSOM 관찰부터 새로 기록합니다.');
});

document.querySelector('#measure-frame').addEventListener('click', () => {
  const started = performance.now();
  accordion.style.setProperty('--measurement-mark', `${Math.round(started)}ms`);
  const rect = accordion.getBoundingClientRect();
  const duration = performance.now() - started;
  const entries = performance.getEntriesByType('measure').length;
  document.querySelector('#frame-duration').textContent = `${duration.toFixed(2)} ms`;
  document.querySelector('#frame-rect').textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  document.querySelector('#frame-entries').textContent = String(entries);
  record('frame measurement', `쓰기 1회 → 기하 읽기 1회; duration=${duration.toFixed(2)}ms`);
});

function inspectContract() {
  const expanded = trigger.getAttribute('aria-expanded');
  const controls = trigger.getAttribute('aria-controls');
  const panelExists = document.getElementById(controls) === panel;
  const expectedHidden = expanded !== 'true';
  const valid = (expanded === 'true' || expanded === 'false') && panelExists && panel.hidden === expectedHidden;
  diagnostic.textContent = valid
    ? 'PASS: aria-expanded, aria-controls, panel.hidden이 서로 일치합니다.'
    : `FAIL: expanded=${expanded}; controls=${controls}; panel.hidden=${panel.hidden}; expectedHidden=${expectedHidden}`;
  record('접근성 계약 진단', valid ? 'PASS' : 'FAIL');
  return valid;
}

document.querySelector('#inject-failure').addEventListener('click', () => {
  trigger.setAttribute('aria-expanded', trigger.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
  inspectContract();
});

document.querySelector('#repair-contract').addEventListener('click', () => {
  setExpanded(!panel.hidden);
  inspectContract();
});

record('초기 DOM/CSSOM 관찰', 'computed style과 getBoundingClientRect()는 실제 브라우저에서 읽습니다.');
readRenderState('초기 상태');
