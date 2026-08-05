/**
 * On-device state. No backend, no accounts, no sync, no analytics.
 *
 * The `atlas.` key prefix is a FROZEN internal identifier, deliberately
 * independent of the product name (which is still undecided). Do not rename
 * these keys when the name lands — kept words would be lost to the migration.
 */

export const KEYS = {
  lexicon: 'atlas.lexicon',
  landings: 'atlas.landings',
};

const listeners = new Set();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { present: false, value: fallback };
    const parsed = JSON.parse(raw);
    return { present: true, value: Array.isArray(parsed) ? parsed : fallback };
  } catch {
    // Corrupt or unavailable storage (private mode, quota, hand-edited value):
    // degrade to in-memory defaults rather than breaking the app.
    return { present: false, value: fallback };
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the session still works, it just will not persist */
  }
  listeners.forEach((fn) => fn());
}

/** Subscribe to lexicon/landings changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Lexicon entries: {word, familyId | "adopted", origin?, definition?, keptAt}
 *
 * First run is seeded with the three adopted words so the view is never empty
 * on install. Seeding writes the key, so a later emptying stays empty rather
 * than re-seeding.
 */
export function getLexicon(adoptedSeeds = []) {
  const { present, value } = read(KEYS.lexicon, []);
  if (present) return value;
  const seeded = adoptedSeeds.map((s) => ({
    word: s.word,
    familyId: 'adopted',
    origin: s.origin,
    definition: s.definition,
    keptAt: new Date().toISOString(),
  }));
  write(KEYS.lexicon, seeded);
  return seeded;
}

export function getLandings() {
  return read(KEYS.landings, []).value;
}

export function hasWord(word, adoptedSeeds = []) {
  return getLexicon(adoptedSeeds).some((e) => e.word === word);
}

/**
 * Keep a word: writes to the lexicon and records a constellation landing.
 *
 * Landing-on-keep is the specced default. Opening a leaf page does NOT record a
 * landing (handoff "Open items" #3 — build the default unless told otherwise).
 */
export function keepWord({ word, familyId, origin, definition }, adoptedSeeds = []) {
  const lexicon = getLexicon(adoptedSeeds);
  if (lexicon.some((e) => e.word === word)) return { added: false, lexicon };

  const at = new Date().toISOString();
  const entry = { word, familyId, keptAt: at };
  if (origin) entry.origin = origin;
  if (definition) entry.definition = definition;

  // Newest first — matches the reference lexicon, where recent keeps sit above
  // the seeded adopted words.
  const next = [entry, ...lexicon];
  write(KEYS.lexicon, next);

  if (familyId !== 'adopted') {
    write(KEYS.landings, [{ word, at }, ...getLandings()]);
  }
  return { added: true, lexicon: next };
}

/** Remove a word from the lexicon. Landings are a historical record and stay. */
export function removeWord(word, adoptedSeeds = []) {
  const next = getLexicon(adoptedSeeds).filter((e) => e.word !== word);
  write(KEYS.lexicon, next);
  return next;
}

/** Whole-number days between an ISO timestamp and now. */
export function daysAgo(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 86400000));
}

/**
 * Recency for constellation brightness: max(0, 1 - daysAgo/24).
 * The constellation shows "the last ~3 weeks" — beyond 24 days a landing has
 * faded to nothing.
 */
export function recency(iso, now = Date.now()) {
  return Math.max(0, 1 - daysAgo(iso, now) / 24);
}
