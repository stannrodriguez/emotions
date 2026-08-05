/**
 * Colour maths for the Atlas palette, lifted from CFG['3a'] in the design file's
 * `class Component` and cross-checked against the handoff spec.
 *
 * The palette derives from valence first: lightness reads as valence (so in
 * greyscale the families grade happy -> surprised -> sad -> disgusted -> angry
 * -> afraid), and chroma reads as arousal, including *within* a bloom
 * (furious burns deeper than bitter).
 */

import { r3 } from './geometry.js';

/** Design tokens, from the handoff "Design Tokens" section. */
export const TOKENS = {
  paper: '#f4f0e2',
  cardBg: '#f9f6ea',
  cardBgAlt: '#f7f3e7',
  ink: '#3f3a2c',
  bodyMuted: '#5a5443',
  labelMuted: '#7b7461',
  hairline: '#d6cdb2',
  faintGround: '#cfc7ae',
  spoke: '#ddd6c0',
  dashedInput: '#a89f85',
  whereItBreaks: 'oklch(0.55 0.12 28)',
};

/** Stroke weights for segments. */
export const SEG_STROKE = TOKENS.ink;
export const SEG_STROKE_WIDTH = 0.7;
export const SEG_STROKE_WIDTH_SELECTED = 1.8;

/**
 * Segment fill, used for both root families and bloomed leaves:
 *   L = 0.83 + 0.12*valence - 0.06*arousal
 *   C = 0.015 + 0.1*arousal
 *   H = family hue
 *
 * For a leaf, pass the leaf's own arousal with the family's valence and hue.
 */
export function segmentFill(hue, arousal, valence) {
  const v = valence ?? 0.5;
  const L = r3(0.83 + 0.12 * v - 0.06 * arousal);
  const C = r3(0.015 + 0.1 * arousal);
  return `oklch(${L} ${C} ${hue})`;
}

/**
 * Rim band stroke colour:
 *   L = 0.42 + 0.32*valence
 *   C = 0.07 + 0.09*arousal
 */
export function bandStroke(hue, arousal, valence) {
  const v = valence ?? 0.5;
  const L = r3(0.42 + 0.32 * v);
  const C = r3(0.07 + 0.09 * arousal);
  return `oklch(${L} ${C} ${hue})`;
}

/**
 * Constellation dot fill:
 *   oklch(0.55 - 0.1*a, 0.06 + 0.05*a, hue / 0.3 + 0.7*recency)
 */
export function dotFill(hue, arousal, recency) {
  const L = r3(0.55 - 0.1 * arousal);
  const C = r3(0.06 + 0.05 * arousal);
  const alpha = r3(0.3 + 0.7 * recency);
  return `oklch(${L} ${C} ${hue} / ${alpha})`;
}

/** Constellation dot radius: 2.5 + 3.5*recency. */
export function dotRadius(recency) {
  return r3(2.5 + 3.5 * recency);
}

/**
 * Greyscale lightness of a segment fill — the L term alone. Exposed so the
 * palette ordering can be asserted in tests rather than eyeballed.
 */
export function segmentLightness(arousal, valence) {
  return r3(0.83 + 0.12 * (valence ?? 0.5) - 0.06 * arousal);
}

/** Chroma of a segment fill — the C term alone. */
export function segmentChroma(arousal) {
  return r3(0.015 + 0.1 * arousal);
}
