/**
 * Lexicon (2b) — kept words, including adopted ones.
 *
 * Rows carry only what was authored or what the reader typed. A wheel word with
 * no written page shows the queued line rather than a generated summary.
 */

import { daysAgo, getLexicon, keepWord, subscribe } from '../core/storage.js';

/* PROVISIONAL COPY — product-owner placeholders, shipped as written.
 * See "Missing content: the queued state" in design/HANDOFF.md. */
const QUEUED_DEFINITION = 'page queued for writing.';
const EMPTY_LEXICON = 'No words kept yet. When one fits, keep it from its page.';
/* ------------------------------------------------------------------------ */

const ADD_PLACEHOLDER = '+ ADD A WORD THAT FITS';
const FOOTNOTE =
  'Words from the wheel arrive with their page; adopted words carry their origin and a plain definition.';

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
      h('span', 'lexicon__count', `${entries.length} ${entries.length === 1 ? 'WORD' : 'WORDS'} · THIS DEVICE`)
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
        // A kept wheel word links back to its page, written or queued.
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
        row.appendChild(h('p', 'lexicon__queued', QUEUED_DEFINITION));
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
    input.setAttribute('aria-label', 'Add a word that fits');
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
