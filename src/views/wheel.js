/**
 * The wheel (3a) — root and bloomed.
 *
 * Geometry and colour come from src/core; this module is only rendering and
 * input. Every number below that is not a token traces to
 * "Wheel geometry & color math (exact)" in the handoff.
 */

import {
  R,
  LABEL,
  CX,
  CY,
  annulusPath,
  angleDelta,
  arcPath,
  familyFontSize,
  familyLabelPath,
  leafFontSize,
  leafLabelTransform,
  minViewBoxFontSize,
  pt,
  r3,
  requiredWheelWidth,
  seamHalfWidthDeg,
  segPath,
  toPolar,
} from '../core/geometry.js';
import {
  TOKENS,
  SEG_STROKE,
  SEG_STROKE_WIDTH,
  SEG_STROKE_WIDTH_SELECTED,
  bandStroke,
  segmentFill,
} from '../core/color.js';
import { bloomNeighbours } from '../core/taxonomy.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Wheel is centred and capped at ~560px on desktop; below that it fills the column. */
const DESKTOP_MAX = 560;

/* ------------------------------------------------------------------ copy */

const DEFAULT_CAPTION =
  'Choose the closest family, then narrow it down. Precise naming can make an emotion easier to work with.';

/**
 * The affordance hint, taught once on first bloom.
 *
 * "Once" is scoped to the session deliberately: State & Storage freezes the
 * `atlas.` keyspace at exactly two keys (lexicon, landings), and a hint flag is
 * not worth minting a third.
 */
const SEAM_HINT =
  'Tap the border between two words to compare them.';
let seamHintShown = false;

const bloomCaption = (familyId, count) =>
  `${familyId} → ${count} nearby shades. Choose the closest word.` +
  (seamHintShown ? '' : ` ${SEAM_HINT}`);

/** Guidance for a boundary without a pair-specific authored distinction. */
const seamGuidance = (a, b) =>
  `${a} | ${b} — read both pages and notice which definition fits more closely.`;

/**
 * Leaf hover/focus preview. When the word anchors depth words, the caption
 * names them — the deep vocabulary surfaces where it lives on the wheel, and
 * its full definitions are one tap away on the leaf page's GO DEEPER module.
 */
const leafPreview = (word, deeper = []) =>
  `${word} — open its definition, close neighbors, and practical next steps.` +
  (deeper.length
    ? ` Deeper still: ${deeper.map((d) => `${d.word} (${d.origin})`).join(', ')}.`
    : '');

/* ----------------------------------------------------------------- helpers */

function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    node.setAttribute(k, String(v));
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Cartographic ground: concentric circles and 15deg tick marks, behind everything. */
function groundLayer() {
  const g = el('g', { class: 'wheel__ground', 'aria-hidden': 'true' });
  for (const rad of R.groundCircles) {
    g.appendChild(
      el('circle', {
        cx: CX,
        cy: CY,
        r: rad,
        fill: 'none',
        stroke: TOKENS.faintGround,
        'stroke-width': 0.7,
        opacity: 0.55,
      })
    );
  }
  for (let d = 0; d < 360; d += 15) {
    const [x1, y1] = pt(R.tickInner, d);
    const [x2, y2] = pt(R.tickOuter, d);
    g.appendChild(
      el('line', { x1, y1, x2, y2, stroke: TOKENS.labelMuted, 'stroke-width': 1, opacity: 0.6 })
    );
  }
  return g;
}

/* ------------------------------------------------------------------ view --- */

export function createWheelView({ taxonomy, navigate }) {
  const root = document.createElement('div');
  root.className = 'wheel';

  const scroll = document.createElement('div');
  scroll.className = 'wheel__scroll';
  const stage = document.createElement('div');
  stage.className = 'wheel__stage';
  scroll.appendChild(stage);

  const caption = document.createElement('p');
  caption.className = 'wheel__caption';
  caption.setAttribute('aria-live', 'polite');

  root.append(scroll, caption);

  /** Current state: which family is bloomed (null = root), and keyboard focus. */
  let familyId = null;
  let focusIndex = -1;
  /** Per-index element handles so focus styling can update without a re-render. */
  let parts = [];
  let svg = null;
  let wheelPx = 0;

  const setCaption = (text) => {
    caption.textContent = text;
  };

  /* -------------------------------------------------------------- sizing --- */

  /**
   * Smallest label size (in viewBox units) the current state will draw, which
   * sets how wide the wheel must render to hold the 12px device floor.
   */
  function smallestLabelSize() {
    if (!familyId) {
      return Math.min(...taxonomy.families.map((f) => familyFontSize(f.id, f.span, f.mid)));
    }
    const family = taxonomy.family(familyId);
    return Math.min(...family.words.map((w) => leafFontSize(w.id)));
  }

  function measure() {
    // clientWidth includes the scroll container's own padding, which the stage
    // cannot use — subtract it or the wheel is sized a bleed-width too wide.
    const style = getComputedStyle(scroll);
    const available =
      scroll.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    if (available <= 0) return;
    const required = requiredWheelWidth(smallestLabelSize());
    // Grow past the column rather than shrinking type below 12px; the scroll
    // container absorbs the overflow.
    const next = Math.round(Math.max(Math.min(available, DESKTOP_MAX), required));
    if (next === wheelPx) return;
    wheelPx = next;
    stage.style.width = `${wheelPx}px`;
    stage.style.height = `${wheelPx}px`;
    if (svg) applyCenterTextFloor();
    centreScroll();
  }

  function centreScroll() {
    scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
  }

  /**
   * Centre text is not part of the specced wheel geometry, so rather than
   * widening the whole wheel for it we raise its viewBox size on narrow screens
   * — the spec's "shrink the centre" escape hatch, applied to the type.
   */
  function applyCenterTextFloor() {
    if (!svg) return;
    const floor = minViewBoxFontSize(wheelPx);
    svg.querySelectorAll('[data-base-fs]').forEach((node) => {
      const base = Number(node.dataset.baseFs);
      node.setAttribute('font-size', r3(Math.max(base, floor)));
    });
  }

  /* --------------------------------------------------------------- render --- */

  function render() {
    stage.replaceChildren();
    parts = [];

    svg = el('svg', {
      viewBox: '0 0 720 720',
      class: 'wheel__svg',
      role: 'group',
      'aria-label': familyId
        ? `${familyId} bloomed into ${taxonomy.family(familyId).words.length} finer words`
        : 'Emotion wheel: six families',
    });

    svg.appendChild(groundLayer());

    // The ring group carries the 300ms ease-out bloom. Re-creating it on every
    // state change restarts the animation; prefers-reduced-motion disables it.
    const ring = el('g', { class: 'wheel__ring' });
    svg.appendChild(ring);

    if (familyId) renderBloom(ring, taxonomy.family(familyId));
    else renderRoot(ring);

    stage.appendChild(svg);
    applyCenterTextFloor();
    centreScroll();
  }

  /* ----------------------------------------------------------------- root --- */

  function renderRoot(ring) {
    taxonomy.families.forEach((family, i) => {
      const seg = el('path', {
        d: segPath(R.segInner, R.segOuterRoot, family.a0, family.a1),
        fill: segmentFill(family.hue, family.arousal, family.valence),
        stroke: SEG_STROKE,
        'stroke-width': SEG_STROKE_WIDTH,
        class: 'wheel__seg',
        role: 'button',
        tabindex: i === Math.max(focusIndex, 0) ? '0' : '-1',
        'aria-label': `${family.id}, ${family.words.length} words`,
      });
      seg.addEventListener('click', () => bloom(family.id));
      seg.addEventListener('mouseenter', () => setCaption(bloomPreview(family)));
      seg.addEventListener('mouseleave', () => setCaption(DEFAULT_CAPTION));
      seg.addEventListener('focus', () => {
        focusIndex = i;
        setCaption(bloomPreview(family));
        paintFocus();
      });
      seg.addEventListener('blur', () => {
        setCaption(DEFAULT_CAPTION);
        paintFocus();
      });
      ring.appendChild(seg);

      // Rim band: root arcs are inset 2deg per side and have round linecaps.
      const band = el('path', {
        d: arcPath(R.band, family.a0 + 2, family.a1 - 2),
        fill: 'none',
        stroke: bandStroke(family.hue, family.arousal, family.valence),
        'stroke-width': 7,
        'stroke-linecap': 'round',
        class: 'wheel__band',
      });
      ring.appendChild(band);

      // Family label curves along its arc, reversed below the horizon so it
      // never reads upside-down.
      const pathId = `atlas-arc-${family.id}`;
      ring.appendChild(
        el('path', { id: pathId, d: familyLabelPath(family.mid, family.a0, family.a1), fill: 'none' })
      );
      const textPath = el('textPath', {
        href: `#${pathId}`,
        startOffset: '50%',
        'text-anchor': 'middle',
      });
      textPath.textContent = family.id;
      const label = el(
        'text',
        {
          'font-family': "'IBM Plex Mono', ui-monospace, monospace",
          'font-weight': 500,
          'font-size': familyFontSize(family.id, family.span, family.mid),
          'letter-spacing': LABEL.familyLetterSpacing,
          fill: TOKENS.ink,
          class: 'wheel__label',
          style: 'text-transform: uppercase',
        },
        [textPath]
      );
      ring.appendChild(label);

      parts.push({ seg, band, label });
    });

    ring.appendChild(
      el('circle', {
        cx: CX,
        cy: CY,
        r: R.centerRoot,
        fill: TOKENS.paper,
        stroke: TOKENS.ink,
        'stroke-width': 1,
        'aria-hidden': 'true',
      })
    );
    ring.appendChild(centreText('tap the closest', 352, 20, TOKENS.labelMuted));
    ring.appendChild(centreText('family', 378, 20, TOKENS.labelMuted));
  }

  const bloomPreview = (family) =>
    `${family.id} — ${family.words.length} finer words. Tap to explore.`;

  /* ---------------------------------------------------------------- bloom --- */

  function renderBloom(ring, family) {
    const n = family.words.length;
    const span = 360 / n;

    family.words.forEach((word, i) => {
      const a0 = i * span;
      const a1 = a0 + span;
      const mid = a0 + span / 2;

      const seg = el('path', {
        d: segPath(R.segInner, R.segOuterLeaf, a0, a1),
        fill: segmentFill(family.hue, word.arousal, family.valence),
        stroke: SEG_STROKE,
        'stroke-width': SEG_STROKE_WIDTH,
        class: 'wheel__seg',
        role: 'button',
        tabindex: i === Math.max(focusIndex, 0) ? '0' : '-1',
        'aria-label': word.id,
      });
      // Pointer input for the ring is handled by a single surface below, which
      // can apply the seam rule exactly. Segments stay keyboard-focusable.
      seg.style.pointerEvents = 'none';
      seg.addEventListener('focus', () => {
        focusIndex = i;
        setCaption(leafPreview(word.id, taxonomy.depthsNear(word.id)));
        paintFocus();
      });
      seg.addEventListener('blur', () => paintFocus());
      ring.appendChild(seg);

      // Leaf rim arcs are inset 1.5deg per side, 6 wide (9 when selected).
      const band = el('path', {
        d: arcPath(R.band, a0 + 1.5, a1 - 1.5),
        fill: 'none',
        stroke: bandStroke(family.hue, word.arousal, family.valence),
        'stroke-width': 6,
        class: 'wheel__band',
      });
      ring.appendChild(band);

      const { transform } = leafLabelTransform(mid);
      const label = el(
        'text',
        {
          transform,
          'text-anchor': 'start',
          'dominant-baseline': 'middle',
          'font-family': "'IBM Plex Mono', ui-monospace, monospace",
          'font-size': leafFontSize(word.id),
          'letter-spacing': LABEL.leafLetterSpacing,
          fill: TOKENS.ink,
          class: 'wheel__label',
          style: 'text-transform: uppercase',
        },
        [word.id]
      );
      ring.appendChild(label);

      parts.push({ seg, band, label });
    });

    ring.appendChild(inputSurface(family));

    const centre = el('g', {
      class: 'wheel__center-hit',
      role: 'button',
      tabindex: '0',
      'aria-label': `${family.id} — back to all families`,
    });
    centre.appendChild(
      el('circle', {
        cx: CX,
        cy: CY,
        r: R.centerBloom,
        fill: TOKENS.paper,
        stroke: TOKENS.ink,
        'stroke-width': 1,
        class: 'wheel__center-circle',
      })
    );
    centre.appendChild(centreText(family.id, 352, 26, TOKENS.ink, true));
    centre.appendChild(centreText('‹ back', 382, 17, TOKENS.labelMuted));
    centre.addEventListener('click', unbloom);
    centre.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        unbloom();
      }
    });
    ring.appendChild(centre);
  }

  /**
   * One transparent surface over the ring resolves a pointer position to either
   * a seam or a leaf.
   *
   * The seam zone's half-width is "+/-4deg or 22px, whichever is greater at the
   * tap's radius", which is not a constant-angle wedge — it widens as it nears
   * the centre. Hit-testing in polar coordinates applies the rule exactly
   * instead of approximating it with a fixed shape.
   */
  function inputSurface(family) {
    const n = family.words.length;
    const span = 360 / n;

    const surface = el('path', {
      d: annulusPath(R.segInner, R.segOuterLeaf),
      'fill-rule': 'evenodd',
      class: 'wheel__input-surface',
    });

    /** Resolve a pointer event to {kind: 'seam'|'leaf', ...}. */
    const resolve = (event) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return null;
      const x = ((event.clientX - rect.left) / rect.width) * 720;
      const y = ((event.clientY - rect.top) / rect.height) * 720;
      const { radius, deg } = toPolar(x, y);
      if (radius < R.segInner || radius > R.segOuterLeaf) return null;

      // Seams only live between r=150 and r=336.
      if (radius >= R.seamInner) {
        const half = seamHalfWidthDeg(radius);
        for (let i = 0; i < n; i++) {
          const boundary = (i + 1) * span;
          if (Math.abs(angleDelta(deg, boundary)) <= half) {
            const word = family.words[i];
            const { next } = bloomNeighbours(family, i);
            return { kind: 'seam', a: word.id, b: next.id };
          }
        }
      }

      const index = Math.min(n - 1, Math.floor(deg / span));
      return { kind: 'leaf', index, word: family.words[index] };
    };

    const describeSeam = (a, b) => taxonomy.distinction(a, b) ?? seamGuidance(a, b);

    let lastKey = '';
    surface.addEventListener('pointermove', (event) => {
      const hit = resolve(event);
      if (!hit) return;
      surface.style.cursor = hit.kind === 'seam' ? 'help' : 'pointer';
      const key = hit.kind === 'seam' ? `s:${hit.a}|${hit.b}` : `l:${hit.word.id}`;
      if (key === lastKey) return;
      lastKey = key;
      setCaption(
        hit.kind === 'seam'
          ? describeSeam(hit.a, hit.b)
          : leafPreview(hit.word.id, taxonomy.depthsNear(hit.word.id))
      );
    });

    surface.addEventListener('pointerleave', () => {
      lastKey = '';
      setCaption(bloomCaption(family.id, n));
    });

    surface.addEventListener('click', (event) => {
      const hit = resolve(event);
      if (!hit) return;
      if (hit.kind === 'seam') {
        // A seam answers in the caption; it never navigates.
        setCaption(describeSeam(hit.a, hit.b));
        return;
      }
      navigate({ view: 'leaf', family: family.id, word: hit.word.id });
    });

    return surface;
  }

  function centreText(text, y, fontSize, fill, uppercase = false) {
    const node = el(
      'text',
      {
        x: CX,
        y,
        'text-anchor': 'middle',
        'font-family': "'IBM Plex Mono', ui-monospace, monospace",
        'font-size': fontSize,
        fill,
        style: uppercase ? 'text-transform: uppercase' : null,
        'pointer-events': 'none',
      },
      [text]
    );
    node.dataset.baseFs = String(fontSize);
    return node;
  }

  /* ----------------------------------------------------------- focus paint --- */

  /** Selected/focused styling: 1.8px segment stroke, 9px band, 600 label. */
  function paintFocus() {
    parts.forEach((part, i) => {
      const on = i === focusIndex && document.activeElement === part.seg;
      part.seg.setAttribute('stroke-width', on ? SEG_STROKE_WIDTH_SELECTED : SEG_STROKE_WIDTH);
      if (familyId) {
        part.band.setAttribute('stroke-width', on ? 9 : 6);
        part.label.setAttribute('font-weight', on ? 600 : 400);
      }
      part.seg.setAttribute('tabindex', i === focusIndex ? '0' : '-1');
    });
  }

  /* ------------------------------------------------------------- keyboard --- */

  function moveFocus(delta) {
    if (!parts.length) return;
    const next = (focusIndex + delta + parts.length) % parts.length;
    focusIndex = next < 0 ? parts.length - 1 : next;
    parts[focusIndex].seg.focus();
    paintFocus();
  }

  /** Set when a bloom came from the keyboard, so focus can follow into the new ring. */
  let restoreFocus = false;

  root.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(focusIndex < 0 ? 0 : 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(focusIndex < 0 ? 0 : -1);
        break;
      case 'Enter':
      case ' ':
        if (focusIndex >= 0 && document.activeElement === parts[focusIndex]?.seg) {
          event.preventDefault();
          restoreFocus = true;
          activateFocused();
        }
        break;
      default:
        break;
    }
  });

  /*
   * Escape listens on the document, not on the view root. Blooming re-renders
   * the ring, which destroys whatever was focused — so by the time the reader
   * presses Escape, focus has usually fallen back to <body> and a root-level
   * listener would never see the key.
   */
  const onDocumentKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (!root.isConnected || !familyId) return;
    event.preventDefault();
    restoreFocus = document.activeElement !== document.body;
    unbloom();
  };

  function activateFocused() {
    if (!familyId) {
      bloom(taxonomy.families[focusIndex].id);
      return;
    }
    const family = taxonomy.family(familyId);
    navigate({ view: 'leaf', family: familyId, word: family.words[focusIndex].id });
  }

  /* ------------------------------------------------------------ navigation --- */

  function bloom(id) {
    navigate({ view: 'wheel', family: id, word: null });
  }

  function unbloom() {
    navigate({ view: 'wheel', family: null, word: null });
  }

  /* --------------------------------------------------------------- public --- */

  const observer = new ResizeObserver(() => measure());

  return {
    el: root,

    /** Called by the shell on mount and on every route change. */
    update(route) {
      const nextFamily = route.family ?? null;
      const changed = nextFamily !== familyId;
      familyId = nextFamily;
      if (changed) focusIndex = -1;

      measure();
      render();

      if (familyId) {
        const family = taxonomy.family(familyId);
        setCaption(bloomCaption(family.id, family.words.length));
        seamHintShown = true;
      } else {
        setCaption(DEFAULT_CAPTION);
      }

      // Keyboard users land in the new ring so the arrows keep working.
      if (restoreFocus && parts.length) {
        restoreFocus = false;
        focusIndex = 0;
        parts[0].seg.focus();
        paintFocus();
      }
    },

    mounted() {
      observer.observe(scroll);
      document.addEventListener('keydown', onDocumentKeydown);
      measure();
    },

    destroy() {
      observer.disconnect();
      document.removeEventListener('keydown', onDocumentKeydown);
    },
  };
}
