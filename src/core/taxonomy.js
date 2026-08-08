/**
 * The taxonomy: loads the canonical `emotions.json` and decorates it with the
 * angular layout both the wheel and the constellation draw from.
 *
 * emotions.json is the source of truth for data. Nothing here invents content.
 */

let cache = null;

/**
 * Angular layout, per spec:
 *   family span = wordCount/63 * 360
 *   start angle = -(firstFamily.wordCount/63 * 360) / 2
 * so the first family (surprised) is centred at 12 o'clock.
 */
function layout(families) {
  const total = families.reduce((sum, f) => sum + f.words.length, 0);
  let angle = -((families[0].words.length / total) * 360) / 2;
  return families.map((f) => {
    const span = (f.words.length / total) * 360;
    const decorated = {
      ...f,
      span,
      a0: angle,
      a1: angle + span,
      mid: angle + span / 2,
      words: f.words.map((w) => ({ ...w, familyId: f.id })),
    };
    angle += span;
    return decorated;
  });
}

/** Load and decorate the taxonomy. Cached — the data files never change at runtime. */
export async function loadTaxonomy(
  url = new URL('../data/emotions.json', import.meta.url),
  depthsUrl = new URL('../data/depths.json', import.meta.url)
) {
  if (cache) return cache;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load emotions.json (${res.status})`);
  const raw = await res.json();

  // The depths collection is an enrichment, not a dependency: if it cannot be
  // loaded the wheel still works, just without the deep-vocabulary layer.
  let depths = null;
  try {
    const depthsRes = await fetch(depthsUrl);
    if (depthsRes.ok) depths = await depthsRes.json();
  } catch {
    /* offline or missing — degrade to an empty collection */
  }

  cache = build(raw, depths);
  return cache;
}

/** Build the decorated taxonomy from parsed JSON. Split out so Node can test it. */
export function build(raw, depths = null) {
  const families = layout(raw.families);

  const byFamily = new Map(families.map((f) => [f.id, f]));
  const byWord = new Map();
  families.forEach((f) => f.words.forEach((w, i) => byWord.set(w.id, { word: w, family: f, index: i })));

  /* Depth words: each is anchored to its nearest wheel word (`near`), which
   * resolves its family. Entries whose anchor does not resolve are dropped
   * rather than rendered unmoored. */
  const depthWords = (depths?.words ?? [])
    .filter((d) => byWord.has(d.near))
    .map((d) => ({ ...d, familyId: byWord.get(d.near).family.id }));
  const depthsByAnchor = new Map();
  for (const d of depthWords) {
    if (!depthsByAnchor.has(d.near)) depthsByAnchor.set(d.near, []);
    depthsByAnchor.get(d.near).push(d);
  }

  return {
    families,
    distinctions: raw.distinctions,
    adoptedSeeds: raw.adoptedSeeds,
    wordCount: byWord.size,

    /** The deep-vocabulary collection, in file order. */
    depths: depthWords,
    depthsNote: depths?.note ?? '',
    /** Depth words anchored to a wheel word. */
    depthsNear: (wordId) => depthsByAnchor.get(wordId) ?? [],

    family: (id) => byFamily.get(id) ?? null,
    word: (id) => byWord.get(id)?.word ?? null,
    familyOf: (wordId) => byWord.get(wordId)?.family ?? null,

    /**
     * Angular position of a word.
     *
     * `rootAngle` is where the word sits on the *root* wheel — inside its
     * family's wedge. This is the constellation's layout ("same angular layout
     * as the root wheel").
     *
     * `bloomAngle` is where it sits when its family is bloomed across the full
     * 360deg in equal spans.
     */
    position: (wordId) => {
      const hit = byWord.get(wordId);
      if (!hit) return null;
      const { word, family, index } = hit;
      const n = family.words.length;
      const bloomSpan = 360 / n;
      return {
        word,
        family,
        index,
        arousal: word.arousal,
        rootAngle: family.a0 + ((index + 0.5) * family.span) / n,
        bloomAngle: index * bloomSpan + bloomSpan / 2,
        bloomA0: index * bloomSpan,
        bloomA1: (index + 1) * bloomSpan,
        bloomSpan,
      };
    },

    /** Pair-specific distinction when one is authored; otherwise null. */
    distinction: (a, b) => raw.distinctions[`${a}|${b}`] ?? raw.distinctions[`${b}|${a}`] ?? null,

    /** True when a word has authored leaf content. */
    isWritten: (wordId) => Boolean(byWord.get(wordId)?.word?.definition),
  };
}

/**
 * The two words a bloomed leaf sits between, following the fixed adjacency
 * order and wrapping at the ends of the family.
 */
export function bloomNeighbours(family, index) {
  const n = family.words.length;
  return {
    prev: family.words[(index - 1 + n) % n],
    next: family.words[(index + 1) % n],
  };
}
