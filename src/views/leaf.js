/**
 * Leaf page (3b) — SIGNED OFF. Recreated exactly; do not redesign.
 *
 * Every size, colour, and gap below traces to the 3b markup in
 * Wheel Directions.dc.html and the "Leaf page" section of the handoff.
 *
 * All copy on this page is authored content from emotions.json. The fallback
 * below is defensive only; every canonical emotion page is complete.
 */

import { keepWord, hasWord, subscribe } from '../core/storage.js';

const MISSING_DEFINITION = 'Definition unavailable. Reload the page to try again.';

const KEEP_LABEL = '+ KEEP THIS WORD';
/** Post-keep state for the same button. A UI state, not product copy. */
const KEPT_LABEL = 'KEPT';
const KEEP_NOTE = 'kept in your lexicon on this device';

const titleCase = (word) => word.charAt(0).toUpperCase() + word.slice(1);

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createLeafView({ taxonomy, navigate }) {
  const root = document.createElement('div');
  root.className = 'leaf';

  let current = null;
  let unsubscribe = null;

  function render(route) {
    const position = taxonomy.position(route.word);
    if (!position) {
      navigate({ view: 'wheel', family: null, word: null });
      return;
    }
    const { word, family } = position;
    current = { word, family };

    const card = h('article', 'leaf__card');

    /* Top row: breadcrumb left, coordinates right. The coordinates slot stays
     * empty for an unwritten word — never a fabricated pair. */
    const top = h('div', 'leaf__top');
    const crumb = h('div', 'leaf__crumb');
    const familyLink = h('a', 'leaf__crumb-link', family.id.toUpperCase());
    familyLink.href = `#/${family.id}`;
    crumb.append(familyLink, document.createTextNode(` / ${word.id.toUpperCase()}`));
    const coords = h('span', 'leaf__coords', word.coordinates ?? '');
    top.append(crumb, coords);
    card.appendChild(top);

    /* Title + definition. */
    const head = h('div', 'leaf__head');
    head.appendChild(h('h2', 'leaf__title', titleCase(word.id)));
    if (word.definition) {
      head.appendChild(h('p', 'leaf__definition', word.definition));
    } else {
      head.appendChild(h('p', 'leaf__queued', MISSING_DEFINITION));
    }
    card.appendChild(head);

    /* Everything below the definition exists only for a written word. */
    if (word.labelingNote) {
      card.appendChild(h('p', 'leaf__labeling-note', word.labelingNote));
    }

    if (word.nearby?.length) {
      const section = h('section', 'leaf__section leaf__section--nearby');
      section.appendChild(h('h3', 'leaf__section-label', 'NEARBY'));
      for (const entry of word.nearby) {
        const p = h('p', 'leaf__nearby');
        p.appendChild(h('strong', null, entry.word));
        p.appendChild(document.createTextNode(` — ${entry.contrast}`));
        section.appendChild(p);
      }
      card.appendChild(section);
    }

    if (word.techniques?.length) {
      const section = h('section', 'leaf__section leaf__section--helps');
      section.appendChild(h('h3', 'leaf__section-label', 'WHAT HELPS'));
      for (const technique of word.techniques) {
        const block = h('div', 'leaf__technique');
        block.appendChild(h('h4', 'leaf__technique-name', technique.name));
        block.appendChild(h('p', 'leaf__technique-body', technique.body));
        const breaks = h('p', 'leaf__breaks');
        breaks.appendChild(h('strong', 'leaf__breaks-label', 'WHERE IT BREAKS'));
        breaks.appendChild(document.createTextNode(` — ${technique.whereItBreaks}`));
        block.appendChild(breaks);
        section.appendChild(block);
      }
      card.appendChild(section);
    }

    /* Footer. Keeping records the word in the lexicon and constellation. */
    const footer = h('div', 'leaf__footer');
    const keep = h('button', 'leaf__keep');
    keep.type = 'button';
    keep.addEventListener('click', () => {
      keepWord(
        {
          word: word.id,
          familyId: family.id,
          definition: word.definition ?? undefined,
        },
        taxonomy.adoptedSeeds
      );
      paintKeep(keep, word.id);
    });
    paintKeep(keep, word.id);
    footer.append(keep, h('span', 'leaf__keep-note', KEEP_NOTE));
    card.appendChild(footer);

    root.replaceChildren(card);
  }

  function paintKeep(button, wordId) {
    const kept = hasWord(wordId, taxonomy.adoptedSeeds);
    button.textContent = kept ? KEPT_LABEL : KEEP_LABEL;
    button.disabled = kept;
    button.setAttribute('aria-live', 'polite');
  }

  return {
    el: root,

    update(route) {
      render(route);
    },

    mounted() {
      // Keeping the same word from elsewhere (or clearing storage) should be
      // reflected here without a reload.
      unsubscribe = subscribe(() => {
        const button = root.querySelector('.leaf__keep');
        if (button && current) paintKeep(button, current.word.id);
      });
    },

    destroy() {
      unsubscribe?.();
    },
  };
}
