type Point = { x: number; y: number };
type Route = { id: string; url: string };

// Cut the sheet along x - y = crease. The top-right side folds down-left.
function cut(points: Point[], crease: number, front: boolean): Point[] {
  const inside = (point: Point) => front ? point.x - point.y <= crease : point.x - point.y >= crease;
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) {
      const t = (crease - (a.x - a.y)) / ((b.x - b.y) - (a.x - a.y));
      result.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return result;
}

function animateSheet(surface: HTMLElement, swap: () => void): Promise<void> {
  const rect = surface.getBoundingClientRect();
  const { width, height } = rect;
  const overlay = document.createElement('div');
  overlay.className = 'paper-turn-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  const sheet = surface.cloneNode(true) as HTMLElement;
  sheet.removeAttribute('id');
  sheet.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  sheet.classList.add('paper-turn-front');
  Object.assign(sheet.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${width}px`, height: `${height}px` });
  const dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'paper-turn-fold');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  Object.assign(svg.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${width}px`, height: `${height}px` });
  // The gradient is perpendicular to the crease: a dark bend, a highlight, then paper.
  svg.innerHTML = `<defs><linearGradient id="paper-back" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${dark ? '#24212d' : '#c9c1d2'}"/><stop offset=".12" stop-color="${dark ? '#50495f' : '#eee8f2'}"/><stop offset=".32" stop-color="${dark ? '#383240' : '#fffdf8'}"/><stop offset="1" stop-color="${dark ? '#302b39' : '#eee9e0'}"/></linearGradient></defs><polygon fill="url(#paper-back)" stroke="${dark ? '#61556e' : '#ddd5df'}" stroke-width=".6"/>`;
  const polygon = svg.querySelector('polygon')!;
  const gradient = svg.querySelector('linearGradient')!;
  overlay.append(sheet, svg);
  document.body.append(overlay);
  swap();
  document.documentElement.dataset.turning = 'true';
  const corners = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];

  return new Promise((resolve) => {
    const start = performance.now();
    const duration = 1050;
    function frame(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const crease = width - (width + height + 24) * eased;
      const front = cut(corners, crease, true);
      const back = cut(corners, crease, false).map(({ x, y }) => ({ x: y + crease, y: x - crease }));
      sheet.style.clipPath = front.length ? `polygon(${front.map(({ x, y }) => `${x}px ${y}px`).join(',')})` : 'inset(100%)';
      polygon.setAttribute('points', back.map(({ x, y }) => `${x},${y}`).join(' '));
      const bend = Math.min(90, 12 + eased * 110);
      gradient.setAttribute('x1', String(crease));
      gradient.setAttribute('y1', '0');
      gradient.setAttribute('x2', String(crease - bend));
      gradient.setAttribute('y2', String(bend));
      svg.style.opacity = String(Math.min(1, (1 - progress) / .18));
      if (progress < 1) requestAnimationFrame(frame);
      else { overlay.remove(); delete document.documentElement.dataset.turning; resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

const routes: Route[] = JSON.parse(document.getElementById('question-routes')?.textContent || '[]');
let busy = false;
let swapped = false;

// Delegate so the replacement page's random button works without running its scripts again.
document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-random]') : null;
  if (!button || busy) return;
  const candidates = routes.filter((route) => route.id !== document.body.dataset.currentId);
  if (!candidates.length) return;
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  const surface = document.querySelector<HTMLElement>('.practice-layout');
  if (!surface || matchMedia('(prefers-reduced-motion: reduce)').matches) { location.assign(next.url); return; }
  busy = true;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  const main = document.querySelector<HTMLElement>('main')!;
  try {
    const response = await fetch(next.url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('Question fetch failed');
    const documentNext = new DOMParser().parseFromString(await response.text(), 'text/html');
    const nextMain = documentNext.querySelector('main');
    if (!nextMain?.querySelector('.practice-layout')) throw new Error('Question page missing');
    // Fold the entire practice sheet, including related questions below it on mobile.
    const answer = surface.querySelector<HTMLDetailsElement>('details');
    if (answer) answer.open = false;
    window.scrollTo({ top: Math.max(0, surface.getBoundingClientRect().top + scrollY - 28), behavior: 'instant' });
    main.inert = true;
    await animateSheet(surface, () => {
      main.replaceChildren(...Array.from(nextMain.childNodes));
      document.title = documentNext.title;
      document.body.dataset.currentId = next.id;
      history.pushState(null, '', next.url);
      swapped = true;
    });
    main.inert = false;
    const heading = main.querySelector<HTMLElement>('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  } catch {
    // A normal document navigation remains the fallback for failed preloads.
    location.assign(next.url);
  } finally {
    main.inert = false;
    busy = false;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});

window.addEventListener('popstate', () => { if (swapped) location.reload(); });
