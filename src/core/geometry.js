/**
 * Wheel geometry: the exact numbers from the handoff spec ("Wheel geometry &
 * color math (exact)") and the `class Component` script in Wheel Directions.dc.html.
 *
 * Coordinate system: SVG viewBox "0 0 720 720", centre (360,360).
 * Angle 0deg = 12 o'clock, increasing clockwise.
 *
 * Everything here is pure maths on viewBox units. Nothing in this module
 * touches the DOM, so both the wheel and the constellation can share it.
 */

/** viewBox edge length. All radii below are in these units. */
export const VIEWBOX = 720;
export const CX = 360;
export const CY = 360;

/** Radii, per spec. Root and bloomed differ slightly. */
export const R = {
  segInner: 118,
  segOuterRoot: 338,
  segOuterLeaf: 336,
  band: 348,
  centerRoot: 104,
  centerBloom: 102,
  familyLabel: 240, // textPath radius, normal direction
  familyLabelRev: 222, // textPath radius, reversed direction
  leafLabelInner: 138, // radial label anchor, right half (reads outward)
  leafLabelOuter: 328, // radial label anchor, left half (reads inward)
  seamInner: 150,
  seamOuter: 336,
  groundCircles: [150, 195, 240, 285, 330],
  tickInner: 348,
  tickOuter: 358,
};

/** Label typography constants, per spec. */
export const LABEL = {
  familyMaxFs: 23,
  familyLetterSpacing: 2,
  leafMaxFs: 20,
  leafLetterSpacing: 1.5,
  /** Minimum rendered size on device, in CSS px. The wheel scales rather than
   *  letting type fall below this. */
  minDevicePx: 12,
};

/** Round to 3dp, matching the prototype's `r()` so emitted paths are identical. */
export function r3(v) {
  return Math.round(v * 1000) / 1000;
}

/**
 * Point on the wheel at radius `rad`, angle `deg` (0 = up, clockwise).
 * Mirrors the prototype's `pt()`.
 */
export function pt(rad, deg) {
  const t = (deg * Math.PI) / 180;
  return [r3(CX + rad * Math.sin(t)), r3(CY - rad * Math.cos(t))];
}

/** Annular segment path from r0..r1 spanning a0..a1 degrees. Prototype `seg()`. */
export function segPath(r0, r1, a0, a1) {
  const [x0, y0] = pt(r1, a0);
  const [x1, y1] = pt(r1, a1);
  const [x2, y2] = pt(r0, a1);
  const [x3, y3] = pt(r0, a0);
  const la = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${la} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${la} 0 ${x3} ${y3} Z`;
}

/** Arc path, clockwise from a0 to a1. Prototype `arc()`. */
export function arcPath(rad, a0, a1) {
  const [x0, y0] = pt(rad, a0);
  const [x1, y1] = pt(rad, a1);
  return `M${x0} ${y0} A${rad} ${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Arc path, counter-clockwise from a1 to a0 — used to flip textPath. Prototype `arcRev()`. */
export function arcPathRev(rad, a0, a1) {
  const [x0, y0] = pt(rad, a1);
  const [x1, y1] = pt(rad, a0);
  return `M${x0} ${y0} A${rad} ${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1} ${y1}`;
}

/**
 * Family labels curve along their arc. For mid-angles in (100, 260) the path is
 * reversed and drawn at a smaller radius, so the text never reads upside-down.
 */
export function familyLabelIsReversed(midAngle) {
  return midAngle > 100 && midAngle < 260;
}

export function familyLabelRadius(midAngle) {
  return familyLabelIsReversed(midAngle) ? R.familyLabelRev : R.familyLabel;
}

export function familyLabelPath(midAngle, a0, a1) {
  const rad = familyLabelRadius(midAngle);
  return familyLabelIsReversed(midAngle) ? arcPathRev(rad, a0, a1) : arcPath(rad, a0, a1);
}

/**
 * Auto-fit for a curved family label:
 *   min(23, (arcLength - 10 - chars*letterSpacing) / (chars * 0.62))
 * where arcLength = radius * span * pi/180.
 */
export function familyFontSize(label, span, midAngle) {
  const rad = familyLabelRadius(midAngle);
  const arcLength = (rad * span * Math.PI) / 180;
  const chars = label.length;
  const fitted = (arcLength - 10 - chars * LABEL.familyLetterSpacing) / (chars * 0.62);
  return Math.min(LABEL.familyMaxFs, r3(fitted));
}

/**
 * Leaf labels are radial. Auto-fit:
 *   min(20, (180 - chars*1.5) / (chars * 0.62))
 */
export function leafFontSize(label) {
  const chars = label.length;
  const fitted = (180 - chars * 1.5) / (chars * 0.62);
  return Math.min(LABEL.leafMaxFs, r3(fitted));
}

/**
 * Radial leaf label placement. Right half (mid <= 180) anchors at r=138 and
 * reads outward; left half flips to r=328 and rotates 180deg more, so it reads
 * inward and is never upside-down.
 */
export function leafLabelTransform(midAngle) {
  const flip = midAngle > 180;
  const [x, y] = pt(flip ? R.leafLabelOuter : R.leafLabelInner, midAngle);
  const rotation = r3(flip ? midAngle + 90 : midAngle - 90);
  return { x, y, rotation, flip, transform: `translate(${x} ${y}) rotate(${rotation})` };
}

/**
 * Seam hit zone half-width in degrees at a given radius.
 *
 * Spec: "the zone half-width is +/-4deg or 22px, whichever is greater at the
 * tap's radius". A pure +/-4deg wedge is only ~21px wide at the inner radius,
 * which misses the 44px touch-target minimum; the px floor fixes that.
 *
 * 22px is measured in viewBox units at radius `rad`: half-angle = atan2 style
 * arc conversion, degrees = 22 / rad * 180/pi.
 */
export const SEAM_MIN_DEG = 4;
export const SEAM_MIN_PX = 22;

export function seamHalfWidthDeg(rad) {
  const fromPx = (SEAM_MIN_PX / rad) * (180 / Math.PI);
  return Math.max(SEAM_MIN_DEG, fromPx);
}

/**
 * Shortest signed angular distance from `angle` to `target`, in degrees,
 * normalised to (-180, 180]. Used for seam hit-testing.
 */
export function angleDelta(angle, target) {
  let d = ((angle - target + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
}

/** Polar coordinates of a point relative to wheel centre, in viewBox units. */
export function toPolar(x, y) {
  const dx = x - CX;
  const dy = y - CY;
  const radius = Math.hypot(dx, dy);
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return { radius, deg };
}

/**
 * Required rendered wheel width (CSS px) so that no label falls below the 12px
 * device minimum.
 *
 * A label of `fs` viewBox units renders at `fs * width / 720` CSS px, so
 * width >= 720 * 12 / fs.
 */
export function requiredWheelWidth(minLabelFontSize) {
  if (!minLabelFontSize || minLabelFontSize <= 0) return 0;
  return (VIEWBOX * LABEL.minDevicePx) / minLabelFontSize;
}

/**
 * Smallest viewBox font-size that still renders at >= 12 CSS px for a wheel
 * drawn `wheelPx` wide. Used to keep centre text legible on narrow phones
 * without widening the wheel (the spec's "shrink the centre" escape hatch).
 */
export function minViewBoxFontSize(wheelPx) {
  if (!wheelPx) return 0;
  return (LABEL.minDevicePx * VIEWBOX) / wheelPx;
}
