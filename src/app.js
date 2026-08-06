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
import { createConstellationView } from './views/constellation.js';
import { createLexiconView } from './views/lexicon.js';

/**
 * View registry. `tab` entries appear in the tab row, in this order; views
 * without one (the leaf page) are reachable by route only.
 */
const VIEWS = {
  wheel: { tab: 'WHEEL', footnote: true, create: createWheelView },
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

  /* -------------------------------------------------------------- views --- */

  const instances = new Map();
  let active = null;

  function viewFor(key) {
    if (instances.has(key)) return instances.get(key);
    const config = VIEWS[key];
    if (!config) return null;
    const instance = config.create({ taxonomy, navigate: go });
    instances.set(key, instance);
    return instance;
  }

  start(taxonomy, (route) => {
    const key = VIEWS[route.view] ? route.view : 'wheel';
    const instance = viewFor(key);
    if (!instance) return;

    if (active !== instance) {
      viewSlot.replaceChildren(instance.el);
      active = instance;
      instance.mounted?.();
    }
    instance.update(route);

    footnote.hidden = !VIEWS[key].footnote;

    const current = tabOf(route);
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
