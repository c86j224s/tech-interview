export const randomStateKey = 'cs-question-deck-v1';

export function randomIndex(length) {
  if (!Number.isSafeInteger(length) || length < 1 || length > 0x100000000) throw new RangeError('Invalid random range');
  try {
    const values = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / length) * length;
    do { globalThis.crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % length;
  } catch {
    return Math.floor(Math.random() * length);
  }
}

export function createQuestionDeck(ids, storage, choose = randomIndex) {
  const catalog = [...new Set(ids)];
  const known = new Set(catalog);
  let state = { catalog: [...catalog], remaining: [...catalog] };
  let loaded = false;

  const shuffle = (values) => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = choose(i + 1);
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  };
  try {
    const saved = JSON.parse(storage?.getItem(randomStateKey) || 'null');
    if (saved && Array.isArray(saved.catalog) && Array.isArray(saved.remaining)
      && saved.catalog.every((id) => typeof id === 'string')
      && saved.remaining.every((id) => typeof id === 'string')
      && new Set(saved.catalog).size === saved.catalog.length
      && new Set(saved.remaining).size === saved.remaining.length
      && saved.remaining.every((id) => saved.catalog.includes(id))) {
      const previous = new Set(saved.catalog);
      const added = catalog.filter((id) => !previous.has(id));
      state.remaining = saved.remaining.filter((id) => known.has(id));
      if (added.length) state.remaining = shuffle([...state.remaining, ...added]);
      loaded = true;
    }
  } catch {}
  if (!loaded) state.remaining = shuffle([...catalog]);

  const save = () => {
    try { storage?.setItem(randomStateKey, JSON.stringify(state)); } catch {}
  };
  const visit = (id) => {
    state.remaining = state.remaining.filter((candidate) => candidate !== id);
    save();
  };
  return {
    visit,
    next(currentId) {
      visit(currentId);
      if (!state.remaining.length) state.remaining = shuffle(catalog.filter((id) => id !== currentId));
      const id = state.remaining.pop();
      save();
      return id;
    },
  };
}
