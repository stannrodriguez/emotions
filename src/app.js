/**
 * App shell (2c) and view dispatch.
 *
 * The shell is flagged lofi in the handoff — a first pass at chrome and
 * navigation — so it stays deliberately thin: masthead, tab row, the active
 * view, and the footnote.
 */

import { loadTaxonomy } from './core/taxonomy.js';
import { start, tabOf, navigate as go, href } from './core/router.js';
import { createWheelView } from './views/wheel.js';
import { createLeafView } from './views/leaf.js';
import { createDepthsView } from './views/depths.js';
import { createConstellationView } from './views/constellation.js';
import { createLexiconView } from './views/lexicon.js';

/**
 * View registry. `tab` entries appear in the tab row, in this order; views
 * without one (the leaf page) are reachable by route only. The leaf view is
 * special-cased below: it renders in a side sheet over the reader's current
 * view rather than replacing it.
 */
const VIEWS = {
  wheel: { tab: 'WHEEL', footnote: true, create: createWheelView },
  depths: { tab: 'DEPTHS', create: createDepthsView },
  constellation: { tab: 'CONSTELLATION', create: createConstellationView },
  lexicon: { tab: 'LEXICON', create: createLexiconView },
  leaf: { create: createLeafView },
};

const FOOTNOTE =
  'Naming what you feel can soften its intensity. Finding the word is a useful first step.';
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

async function main() {
  const mount = document.getElementById('app');

  let taxonomy;
  try {
    mount.innerHTML = '<p class="shell__loading">Loading the atlas…</p>';
    taxonomy = await loadTaxonomy();
  } catch (error) {
    mount.removeAttribute('aria-busy');
    mount.innerHTML =
      '<p class="shell__error">Emotion Atlas couldn’t start. Reload the page to try again.</p>';
    console.error(error);
    return;
  }

  /* ------------------------------------------------------------- chrome --- */

  const card = document.createElement('div');
  card.className = 'shell__card';

  const masthead = document.createElement('header');
  masthead.className = 'shell__masthead';
  masthead.innerHTML = `
    <h1 class="shell__name">EMOTION ATLAS</h1>
    <span class="shell__tagline">find the clearest word for what you feel</span>
  `;

  const tabs = document.createElement('nav');
  tabs.className = 'shell__tabs';
  tabs.setAttribute('aria-label', 'Primary views');

  const viewSlot = document.createElement('main');

  const footnote = document.createElement('p');
  footnote.className = 'shell__footnote';
  footnote.textContent = FOOTNOTE;

  card.append(masthead, tabs, viewSlot, footnote);
  mount.replaceChildren(card);
  mount.removeAttribute('aria-busy');

  const tabLinks = new Map();
  for (const [key, config] of Object.entries(VIEWS)) {
    if (!config.tab) continue;
    const link = document.createElement('a');
    link.className = 'shell__tab';
    link.textContent = config.tab;
    link.href = href({ view: key, family: null, word: null });
    tabs.appendChild(link);
    tabLinks.set(key, link);
  }

  /* --------------------------------------------------------- word sheet --- */

  /* Word pages open in a side sheet over the active view, so closing one and
   * choosing a different word never loses the reader's place on the wheel. */
  const sheet = document.createElement('aside');
  sheet.className = 'sheet';
  sheet.hidden = true;
  sheet.setAttribute('aria-label', 'Word page');

  const sheetBar = document.createElement('div');
  sheetBar.className = 'sheet__bar';
  const sheetClose = document.createElement('button');
  sheetClose.type = 'button';
  sheetClose.className = 'sheet__close';
  sheetClose.textContent = '× CLOSE';
  sheetBar.appendChild(sheetClose);

  const sheetBody = document.createElement('div');
  sheetBody.className = 'sheet__body';

  sheet.append(sheetBar, sheetBody);
  document.body.appendChild(sheet);

  /** Most recent non-leaf route: mounted under the sheet, and where close goes. */
  let lastNonLeaf = null;
  let sheetOpen = false;

  const closeSheet = () => go(lastNonLeaf ?? { view: 'wheel', family: null, word: null });

  sheetClose.addEventListener('click', closeSheet);

  // Capture phase, so a first Escape closes the sheet without also reaching
  // the wheel's document-level Escape (which would unbloom underneath it).
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || sheet.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      closeSheet();
    },
    true
  );

  /* -------------------------------------------------------------- views --- */

  const instances = new Map();
  let active = null;
  let activeRoute = null;

  function viewFor(key) {
    if (instances.has(key)) return instances.get(key);
    const config = VIEWS[key];
    if (!config) return null;
    const instance = config.create({ taxonomy, navigate: go });
    instances.set(key, instance);
    return instance;
  }

  const sameRoute = (a, b) =>
    a && b && a.view === b.view && a.family === b.family && a.word === b.word;

  start(taxonomy, (route) => {
    const isLeaf = route.view === 'leaf';

    /* The view that owns the page. For a word, whatever the reader was looking
     * at stays mounted underneath — defaulting to the word's bloomed family on
     * a cold deep link, or re-blooming when the word belongs elsewhere. */
    if (isLeaf) {
      if (!lastNonLeaf || (lastNonLeaf.view === 'wheel' && lastNonLeaf.family !== route.family)) {
        lastNonLeaf = { view: 'wheel', family: route.family, word: null };
      }
    } else {
      lastNonLeaf = route;
    }
    const base = isLeaf ? lastNonLeaf : route;
    const key = VIEWS[base.view] ? base.view : 'wheel';
    const instance = viewFor(key);
    if (!instance) return;

    if (active !== instance) {
      viewSlot.replaceChildren(instance.el);
      active = instance;
      activeRoute = null;
      instance.mounted?.();
    }
    // Skip the no-op update when only the sheet changed (word → word), so the
    // wheel underneath doesn't re-bloom on every switch.
    if (!sameRoute(base, activeRoute)) {
      instance.update(base);
      activeRoute = base;
    }

    if (isLeaf) {
      const leaf = viewFor('leaf');
      if (!sheetOpen) {
        sheetOpen = true;
        sheet.hidden = false;
        document.body.classList.add('sheet-open');
        sheetBody.replaceChildren(leaf.el);
        leaf.mounted?.();
        // Re-trigger the slide-in even when the class is already present.
        sheet.classList.remove('sheet--in');
        void sheet.offsetWidth;
        sheet.classList.add('sheet--in');
        sheetClose.focus({ preventScroll: true });
      }
      leaf.update(route);
      sheetBody.scrollTop = 0;
    } else if (sheetOpen) {
      sheetOpen = false;
      sheet.hidden = true;
      document.body.classList.remove('sheet-open');
      viewFor('leaf').destroy?.();
    }

    footnote.hidden = !VIEWS[key].footnote;

    const current = tabOf(base);
    for (const [tabKey, link] of tabLinks) {
      if (tabKey === current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    document.title =
      route.word ? `${titleCase(route.word)} — Emotion Atlas`
      : route.family ? `${titleCase(route.family)} — Emotion Atlas`
      : 'Emotion Atlas';
  });
}

main();
