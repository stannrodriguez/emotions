/**
 * Constellation (3c) — a mirror, not a tracker.
 *
 * The last ~3 weeks of landings drawn on the wheel's geometry. Angular layout
 * and colour come from src/core, the same modules the wheel draws from: a dot
 * sits at its word's angle on the *root* wheel, inside its family's wedge.
 */

import { TOKENS, dotFill, dotRadius } from '../core/color.js';
import { r3 } from '../core/geometry.js';
import { getLandings, recency, subscribe } from '../core/storage.js';

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

const CAPTION =
  'The newest landing is labeled. Tap any dot to name it; brighter dots are newer. A mirror, not a tracker.';

const EMPTY_CAPTION =
  'Keep a word to place it here. Over time, your recent landings form a constellation.';

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

  /** Which dot the reader has tapped, so its name shows alongside the newest. */
  let namedIndex = -1;
  let unsubscribe = null;

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

  function render() {
    const points = landings();

    const svg = el('svg', {
      viewBox: `0 0 ${VIEW} ${VIEW}`,
      class: 'constellation__svg',
      role: 'img',
      'aria-label': points.length
        ? `${points.length} landing${points.length === 1 ? '' : 's'} in the last ${WINDOW_DAYS} days`
        : 'No landings yet',
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
      if (i === 0 || i === namedIndex) {
        const left = x < CX;
        svg.appendChild(
          el(
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
            landing.word
          )
        );
      }

      const hit = el('circle', {
        cx: x,
        cy: y,
        r: HIT_R,
        fill: 'transparent',
        class: 'constellation__hit',
        role: 'button',
        tabindex: '0',
        'aria-label': `${landing.word}, ${position.family.id}`,
      });
      const name = () => {
        namedIndex = i;
        render();
      };
      hit.addEventListener('click', name);
      hit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          name();
        }
      });
      svg.appendChild(hit);
    });

    frame.replaceChildren(svg);
    caption.textContent = points.length ? CAPTION : EMPTY_CAPTION;
    applyLabelFloor(svg);
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
      namedIndex = -1;
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
