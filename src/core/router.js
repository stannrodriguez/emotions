/**
 * Hash routing. Deep links, per spec:
 *   #/                    root wheel
 *   #/angry               bloomed family
 *   #/angry/resentful     leaf page
 *   #/constellation       constellation
 *   #/lexicon             lexicon
 */

const RESERVED = new Set(['constellation', 'lexicon']);

/**
 * Parse a location hash into a route.
 * `taxonomy` is used to reject unknown family/word ids, which fall back to root.
 */
export function parse(hash, taxonomy) {
  const path = String(hash || '').replace(/^#\/?/, '');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);

  if (parts.length === 0) return { view: 'wheel', family: null, word: null };

  const [first, second] = parts;

  if (RESERVED.has(first)) return { view: first, family: null, word: null };

  const family = taxonomy.family(first);
  if (!family) return { view: 'wheel', family: null, word: null };

  if (!second) return { view: 'wheel', family: family.id, word: null };

  const position = taxonomy.position(second);
  if (!position || position.family.id !== family.id) {
    return { view: 'wheel', family: family.id, word: null };
  }
  return { view: 'leaf', family: family.id, word: position.word.id };
}

export function href(route) {
  if (route.view === 'constellation') return '#/constellation';
  if (route.view === 'lexicon') return '#/lexicon';
  if (route.word) return `#/${route.family}/${route.word}`;
  if (route.family) return `#/${route.family}`;
  return '#/';
}

export function navigate(route) {
  const next = href(route);
  if (window.location.hash !== next) window.location.hash = next;
}

/** Start listening. Calls `onChange(route)` immediately and on every change. */
export function start(taxonomy, onChange) {
  const emit = () => onChange(parse(window.location.hash, taxonomy));
  window.addEventListener('hashchange', emit);
  emit();
  return () => window.removeEventListener('hashchange', emit);
}

/**
 * Which top-level tab a route belongs to. The leaf page lives under Wheel.
 */
export function tabOf(route) {
  return route.view === 'leaf' ? 'wheel' : route.view;
}
