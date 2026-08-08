/**
 * Depths — the deep-vocabulary collection.
 *
 * The wheel's 63 words are a floor, not a ceiling. This view offers curated
 * finer words — precise English ones and adopted foreign ones — each anchored
 * to its nearest wheel word, grouped by family. Adopting a word writes it to
 * the lexicon as an adopted entry, the same shape as the three seeds.
 *
 * The framing follows research on emotional granularity (telling similar
 * feelings apart finely): granularity grows the way any vocabulary grows,
 * one precise word at a time. All copy is authored content from depths.json.
 */

import { hasWord, keepWord, subscribe } from '../core/storage.js';

const ADOPT_LABEL = '+ ADOPT';
/** Post-adopt state for the same button. A UI state, not product copy. */
const ADOPTED_LABEL = 'ADOPTED';

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * One depth-word row: word, origin (and wheel anchor), definition, adopt.
 * Shared with the leaf page's GO DEEPER module, which hides the anchor —
 * there the reader is already standing on it.
 */
export function depthRow(entry, taxonomy, { showNear = true } = {}) {
  const row = h('div', 'depths__row');

  const top = h('div', 'depths__row-top');
  top.appendChild(h('strong', 'depths__word', entry.word));
  const meta = h('span', 'depths__meta');
  meta.appendChild(document.createTextNode(entry.origin.toUpperCase()));
  if (showNear) {
    meta.appendChild(document.createTextNode(' · NEAR '));
    const near = h('a', 'depths__near', entry.near.toUpperCase());
    near.href = `#/${entry.familyId}/${entry.near}`;
    meta.appendChild(near);
  }
  top.appendChild(meta);
  row.appendChild(top);

  row.appendChild(h('p', 'depths__definition', entry.definition));

  const adopt = h('button', 'depths__adopt');
  adopt.type = 'button';
  adopt.setAttribute('aria-live', 'polite');
  const paint = () => {
    const kept = hasWord(entry.word, taxonomy.adoptedSeeds);
    adopt.textContent = kept ? ADOPTED_LABEL : ADOPT_LABEL;
    adopt.disabled = kept;
  };
  adopt.addEventListener('click', () => {
    keepWord(
      { word: entry.word, familyId: 'adopted', origin: entry.origin, definition: entry.definition },
      taxonomy.adoptedSeeds
    );
    paint();
  });
  paint();
  row.appendChild(adopt);

  return row;
}

export function createDepthsView({ taxonomy }) {
  const root = document.createElement('div');
  root.className = 'depths';
  let unsubscribe = null;

  function render() {
    const card = h('section', 'depths__card');

    const head = h('div', 'depths__head');
    head.appendChild(h('h2', 'depths__title', 'DEPTHS'));
    head.appendChild(
      h('span', 'depths__count', `${taxonomy.depths.length} WORDS · BEYOND THE WHEEL`)
    );
    card.appendChild(head);

    if (taxonomy.depthsNote) {
      card.appendChild(h('p', 'depths__note', taxonomy.depthsNote));
    }

    // Grouped by family, in wheel order, so the collection reads as a walk
    // around the wheel rather than a flat glossary.
    for (const family of taxonomy.families) {
      const words = taxonomy.depths.filter((d) => d.familyId === family.id);
      if (!words.length) continue;
      const group = h('section', 'depths__group');
      group.appendChild(h('h3', 'depths__family', family.id.toUpperCase()));
      for (const entry of words) group.appendChild(depthRow(entry, taxonomy));
      card.appendChild(group);
    }

    card.appendChild(
      h('p', 'depths__footnote', 'Adopted words live in your lexicon, on this device.')
    );

    root.replaceChildren(card);
  }

  return {
    el: root,

    update() {
      render();
    },

    mounted() {
      // Adopting the same word elsewhere (or clearing storage) should be
      // reflected here without a reload.
      unsubscribe = subscribe(render);
    },

    destroy() {
      unsubscribe?.();
    },
  };
}
