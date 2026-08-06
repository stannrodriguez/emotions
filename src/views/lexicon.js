/**
 * Lexicon (2b) — kept words, including adopted ones.
 *
 * Rows carry only what was authored or what the reader typed.
 */

import { daysAgo, getLexicon, keepWord, subscribe } from '../core/storage.js';

const MISSING_DEFINITION = 'Definition unavailable.';
const EMPTY_LEXICON = 'No kept words yet. Keep one from any emotion page, or add your own below.';

const ADD_PLACEHOLDER = '+ ADD YOUR OWN WORD';
const FOOTNOTE =
  'Wheel words keep their full page. Your own words stay private on this device.';

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Row metadata: "ANGRY · KEPT 3D AGO" for wheel words, "ADOPTED · PORTUGUESE"
 * for adopted ones. "KEPT TODAY" is a formatting choice for the same-day case,
 * which the reference (3d / 8d) does not cover.
 */
function meta(entry) {
  if (entry.familyId === 'adopted') {
    return entry.origin ? `ADOPTED · ${entry.origin.toUpperCase()}` : 'ADOPTED';
  }
  const days = daysAgo(entry.keptAt);
  return `${entry.familyId.toUpperCase()} · ${days === 0 ? 'KEPT TODAY' : `KEPT ${days}D AGO`}`;
}

export function createLexiconView({ taxonomy, navigate }) {
  const root = document.createElement('div');
  root.className = 'lexicon';
  let unsubscribe = null;

  function render() {
    const entries = getLexicon(taxonomy.adoptedSeeds);

    const card = h('section', 'lexicon__card');

    const head = h('div', 'lexicon__head');
    head.appendChild(h('h2', 'lexicon__title', 'LEXICON'));
    head.appendChild(
      h('span', 'lexicon__count', `${entries.length} ${entries.length === 1 ? 'WORD' : 'WORDS'} · ON THIS DEVICE`)
    );
    card.appendChild(head);

    if (entries.length === 0) {
      card.appendChild(h('p', 'lexicon__empty', EMPTY_LEXICON));
    }

    for (const entry of entries) {
      const row = h('div', 'lexicon__row');

      const top = h('div', 'lexicon__row-top');
      const isWheelWord = entry.familyId !== 'adopted' && taxonomy.word(entry.word);
      if (isWheelWord) {
        // A kept wheel word links back to its full page.
        const link = h('a', 'lexicon__word lexicon__word--link', entry.word);
        link.href = `#/${entry.familyId}/${entry.word}`;
        top.appendChild(link);
      } else {
        top.appendChild(h('strong', 'lexicon__word', entry.word));
      }
      top.appendChild(h('span', 'lexicon__meta', meta(entry)));
      row.appendChild(top);

      if (entry.definition) {
        row.appendChild(h('p', 'lexicon__definition', entry.definition));
      } else if (isWheelWord) {
        row.appendChild(h('p', 'lexicon__queued', MISSING_DEFINITION));
      }

      card.appendChild(row);
    }

    /* Add a word. The dashed box is the specced affordance; typing into it is
     * the only content path — nothing here is generated. */
    const foot = h('div', 'lexicon__foot');
    const input = document.createElement('input');
    input.className = 'lexicon__add';
    input.type = 'text';
    input.placeholder = ADD_PLACEHOLDER;
    input.setAttribute('aria-label', 'Add your own word');
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const word = input.value.trim();
      if (!word) return;
      keepWord({ word, familyId: 'adopted' }, taxonomy.adoptedSeeds);
      input.value = '';
    });
    foot.append(input, h('p', 'lexicon__footnote', FOOTNOTE));
    card.appendChild(foot);

    root.replaceChildren(card);
  }

  return {
    el: root,

    update() {
      render();
    },

    mounted() {
      unsubscribe = subscribe(() => {
        const active = document.activeElement?.classList.contains('lexicon__add');
        render();
        if (active) root.querySelector('.lexicon__add')?.focus();
      });
    },

    destroy() {
      unsubscribe?.();
    },
  };
}
