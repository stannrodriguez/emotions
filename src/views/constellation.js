/**
 * Constellation (3c) — a mirror, not a tracker.
 *
 * The last ~3 weeks of landings drawn on the wheel's geometry. Angular layout
 * and colour come from src/core, the same modules the wheel draws from: a dot
 * sits at its word's angle on the *root* wheel, inside its family's wedge.
 *
 * Adopted depth words are part of the mirror too: each is drawn as a hollow
 * ring at its wheel anchor's position, so adopting a word visibly changes
 * your map.
 */

import { TOKENS, dotFill, dotRadius } from '../core/color.js';
import { r3 } from '../core/geometry.js';
import { getLandings, getLexicon, recency, subscribe } from '../core/storage.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Constellation geometry, from the prototype's `constellation()`. */
const VIEW = 320;
const CX = 160;
const CY = 160;
const R_OUTER = 140;
const R_SPOKE_INNER = 26;
const R_DOT_BASE = 40;
const R_DOT_AROUSAL = 92;
const LABEL_FS = 11.5;
const LABEL_OFFSET = 9;
/** Invisible tap target around each dot — the drawn dots are 5-12px across. */
const HIT_R = 12;

/** Landings older than this have faded to nothing; recency = 1 - days/24. */
const WINDOW_DAYS = 24;

/*
 * Adopted depth words are drawn as hollow rings at their anchor's position.
 * They are lexicon entries, not landings, so they do not fade with the
 * 3-week window — they stay on the map as long as they stay adopted.
 */
const RING_R = 7;
const RING_STROKE_WIDTH = 1.2;
/** Fixed brightness for rings: recency is a landing concept, adoption is not. */
const RING_REC = 0.5;
/** Rings sharing an anchor fan out a few degrees so they never coincide. */
const RING_SPREAD_DEG = 7;

const CAPTION =
  'The newest landing is labeled. Tap any dot to name it; brighter dots are newer. A mirror, not a tracker.';

const EMPTY_CAPTION =
  'Keep a word to place it here. Over time, your recent landings form a constellation.';

const RINGS_NOTE = 'Hollow rings are adopted words, drawn near their wheel anchors.';

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    node.setAttribute(k, String(v));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Point at radius/angle around the constellation centre. */
function pt(rad, deg) {
  const t = (deg * Math.PI) / 180;
  return [r3(CX + rad * Math.sin(t)), r3(CY - rad * Math.cos(t))];
}

export function createConstellationView({ taxonomy }) {
  const root = document.createElement('div');
  root.className = 'constellation';

  const heading = document.createElement('h2');
  heading.className = 'constellation__heading';
  heading.textContent = 'RECENT LANDINGS';

  const frame = document.createElement('div');
  frame.className = 'constellation__frame';

  const caption = document.createElement('p');
  caption.className = 'constellation__caption';
  caption.setAttribute('aria-live', 'polite');

  root.append(heading, frame, caption);

  /**
   * Which mark the reader has tapped, so its name shows alongside the newest
   * landing's. Keys: `l:<i>` for landings, `a:<i>` for adopted rings.
   */
  let namedKey = null;
  let unsubscribe = null;

  const depthByWord = new Map(taxonomy.depths.map((d) => [d.word, d]));

  function landings() {
    const now = Date.now();
    return getLandings()
      .map((entry) => {
        const position = taxonomy.position(entry.word);
        if (!position) return null;
        const rec = recency(entry.at, now);
        return rec > 0 ? { ...entry, position, recency: rec } : null;
      })
      .filter(Boolean)
      // Newest first, so index 0 is the one that carries a permanent label.
      .sort((a, b) => new Date(b.at) - new Date(a.at));
  }

  /**
   * Adopted lexicon words that came from the depths collection, placed at
   * their anchor's angle and arousal radius. Adopted words without an anchor
   * (the seeds, the reader's own words) have no place on the wheel's geometry
   * and are not drawn.
   */
  function adopted() {
    const marks = getLexicon(taxonomy.adoptedSeeds)
      .filter((entry) => entry.familyId === 'adopted')
      .map((entry) => {
        const depth = depthByWord.get(entry.word);
        const anchor = depth ? taxonomy.position(depth.near) : null;
        return anchor ? { word: entry.word, origin: depth.origin, anchor } : null;
      })
      .filter(Boolean);

    const byAnchor = new Map();
    for (const mark of marks) {
      if (!byAnchor.has(mark.anchor.word.id)) byAnchor.set(mark.anchor.word.id, []);
      byAnchor.get(mark.anchor.word.id).push(mark);
    }
    for (const group of byAnchor.values()) {
      group.forEach((mark, i) => {
        mark.angle = mark.anchor.rootAngle + (i - (group.length - 1) / 2) * RING_SPREAD_DEG;
      });
    }
    return marks;
  }

  function render() {
    const points = landings();
    const marks = adopted();

    const landingsLabel = points.length
      ? `${points.length} landing${points.length === 1 ? '' : 's'} in the last ${WINDOW_DAYS} days`
      : 'No landings yet';
    const svg = el('svg', {
      viewBox: `0 0 ${VIEW} ${VIEW}`,
      class: 'constellation__svg',
      role: 'img',
      'aria-label': marks.length
        ? `${landingsLabel}, ${marks.length} adopted word${marks.length === 1 ? '' : 's'}`
        : landingsLabel,
    });

    // Geometry renders as normal even with nothing on it.
    svg.appendChild(
      el('circle', { cx: CX, cy: CY, r: R_OUTER, fill: 'none', stroke: TOKENS.faintGround, 'stroke-width': 1 })
    );
    for (const family of taxonomy.families) {
      const [x1, y1] = pt(R_SPOKE_INNER, family.a0);
      const [x2, y2] = pt(R_OUTER, family.a0);
      svg.appendChild(el('line', { x1, y1, x2, y2, stroke: TOKENS.spoke, 'stroke-width': 1 }));
    }

    points.forEach((landing, i) => {
      const { position, recency: rec } = landing;
      const radius = R_DOT_BASE + R_DOT_AROUSAL * position.arousal;
      const [x, y] = pt(radius, position.rootAngle);

      svg.appendChild(
        el('circle', {
          cx: x,
          cy: y,
          r: dotRadius(rec),
          fill: dotFill(position.family.hue, position.arousal, rec),
          class: 'constellation__dot',
        })
      );

      // Only the newest landing is named; any other names itself on tap.
      if (i === 0 || namedKey === `l:${i}`) {
        svg.appendChild(nameLabel(x, y, landing.word));
      }
      svg.appendChild(hitAt(x, y, `${landing.word}, ${position.family.id}`, `l:${i}`));
    });

    // Adopted depth words: hollow rings at their anchor's position, in the
    // anchor's colour. Named on tap, like any other mark.
    marks.forEach((mark, i) => {
      const radius = R_DOT_BASE + R_DOT_AROUSAL * mark.anchor.arousal;
      const [x, y] = pt(radius, mark.angle);

      svg.appendChild(
        el('circle', {
          cx: x,
          cy: y,
          r: RING_R,
          fill: 'none',
          stroke: dotFill(mark.anchor.family.hue, mark.anchor.arousal, RING_REC),
          'stroke-width': RING_STROKE_WIDTH,
          class: 'constellation__adopted',
        })
      );

      if (namedKey === `a:${i}`) {
        svg.appendChild(nameLabel(x, y, mark.word));
      }
      svg.appendChild(hitAt(x, y, `${mark.word}, adopted near ${mark.anchor.word.id}`, `a:${i}`));
    });

    frame.replaceChildren(svg);
    caption.textContent =
      (points.length ? CAPTION : EMPTY_CAPTION) + (marks.length ? ` ${RINGS_NOTE}` : '');
    applyLabelFloor(svg);
  }

  function nameLabel(x, y, text) {
    const left = x < CX;
    return el(
      'text',
      {
        x: left ? x + LABEL_OFFSET : x - LABEL_OFFSET,
        y: y + 3.5,
        'text-anchor': left ? 'start' : 'end',
        'font-family': "'IBM Plex Mono', ui-monospace, monospace",
        'font-size': LABEL_FS,
        fill: TOKENS.labelMuted,
        class: 'constellation__label',
        'data-base-fs': LABEL_FS,
      },
      text
    );
  }

  function hitAt(x, y, ariaLabel, key) {
    const hit = el('circle', {
      cx: x,
      cy: y,
      r: HIT_R,
      fill: 'transparent',
      class: 'constellation__hit',
      role: 'button',
      tabindex: '0',
      'aria-label': ariaLabel,
    });
    const name = () => {
      namedKey = key;
      render();
    };
    hit.addEventListener('click', name);
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        name();
      }
    });
    return hit;
  }

  /** Keep dot labels at >= 12px on device, as the wheel's labels are. */
  function applyLabelFloor(svg) {
    const width = svg.getBoundingClientRect().width;
    if (!width) return;
    const floor = (12 * VIEW) / width;
    svg.querySelectorAll('[data-base-fs]').forEach((node) => {
      node.setAttribute('font-size', r3(Math.max(Number(node.dataset.baseFs), floor)));
    });
  }

  const observer = new ResizeObserver(() => {
    const svg = frame.querySelector('svg');
    if (svg) applyLabelFloor(svg);
  });

  return {
    el: root,

    update() {
      namedKey = null;
      render();
    },

    mounted() {
      observer.observe(frame);
      unsubscribe = subscribe(() => render());
    },

    destroy() {
      observer.disconnect();
      unsubscribe?.();
    },
  };
}
