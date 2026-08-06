/**
 * Data + geometry + palette verification.
 *
 * Runs the checks from the handoff that can be settled numerically rather than
 * by eye, so a regression in the data file or the colour maths fails loudly.
 *
 *   node scripts/verify-data.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build, bloomNeighbours } from '../src/core/taxonomy.js';
import { segmentLightness, segmentChroma } from '../src/core/color.js';
import {
  familyFontSize,
  familyLabelIsReversed,
  leafFontSize,
  leafLabelTransform,
  requiredWheelWidth,
  seamHalfWidthDeg,
  R,
} from '../src/core/geometry.js';

const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/emotions.json', import.meta.url)), 'utf8')
);
const atlas = build(raw);

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};
const heading = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

/* 1. Family word counts ---------------------------------------------------- */
heading('1. Family word counts');
const EXPECTED = { surprised: 10, happy: 11, sad: 12, disgusted: 7, angry: 12, afraid: 11 };
let total = 0;
for (const f of atlas.families) {
  total += f.words.length;
  console.log(
    `  ${f.id.padEnd(10)} hue ${String(f.hue).padStart(3)}  arousal ${f.arousal}  valence ${f.valence}  ` +
      `span ${f.span.toFixed(3)}deg  a0 ${f.a0.toFixed(3)}  mid ${f.mid.toFixed(3)}  words ${f.words.length}`
  );
  check(`${f.id} word count`, f.words.length === EXPECTED[f.id], `expected ${EXPECTED[f.id]}`);
}
check('total is 63', total === 63, `got ${total}`);
check('surprised is centred at 12 o\'clock', Math.abs(atlas.families[0].mid) < 1e-9);

/* 2. Distinction keys ------------------------------------------------------ */
heading('2. Distinction keys');
const EXPECTED_KEYS = [
  'guilty|ashamed',
  'envious|jealous',
  'anxious|worried',
  'disappointed|discouraged',
  'nostalgic|grieving',
  'bitter|resentful',
];
const keys = Object.keys(atlas.distinctions);
check('exactly six distinctions', keys.length === 6, `got ${keys.length}`);
for (const k of EXPECTED_KEYS) {
  const v = atlas.distinctions[k];
  console.log(`  ${k.padEnd(26)} ${v ? `${v.length} chars` : 'MISSING'}`);
  check(`${k} is written`, Boolean(v && v.trim()));
}

/* 3. Family seam edges ----------------------------------------------------- */
heading('3. Family boundaries meet at real semantic edges');
const EXPECTED_EDGES = [
  'awed|excited',
  'serene|nostalgic',
  'ashamed|alienated',
  'disdainful|contemptuous',
  'furious|panicked',
  'wary|startled',
];
const edges = atlas.families.map((f, i) => {
  const next = atlas.families[(i + 1) % atlas.families.length];
  return `${f.words.at(-1).id}|${next.words[0].id}`;
});
edges.forEach((e) => console.log(`  ${e}`));
check('all six edges match the spec', EXPECTED_EDGES.every((e) => edges.includes(e)));

/* 4. Greyscale: lightness reads as valence --------------------------------- */
heading('4. Greyscale check — family lightness order');
const order = atlas.families
  .map((f) => ({ id: f.id, L: segmentLightness(f.arousal, f.valence) }))
  .sort((a, b) => b.L - a.L);
order.forEach((o) => console.log(`  ${o.id.padEnd(10)} L ${o.L}`));
check(
  'happy, surprised, sad, disgusted, angry, afraid (lightest first)',
  order.map((o) => o.id).join(' ') === 'happy surprised sad disgusted angry afraid'
);

/* 5. Within the angry bloom, furious vs bitter ----------------------------- */
heading('5. Arousal reads inside a bloom — angry');
const angry = atlas.family('angry');
const furious = angry.words.find((w) => w.id === 'furious');
const bitter = angry.words.find((w) => w.id === 'bitter');
const fL = segmentLightness(furious.arousal, angry.valence);
const bL = segmentLightness(bitter.arousal, angry.valence);
const fC = segmentChroma(furious.arousal);
const bC = segmentChroma(bitter.arousal);
console.log(`  furious  L ${fL}  C ${fC}`);
console.log(`  bitter   L ${bL}  C ${bC}`);
check('furious is darker than bitter', fL < bL);
check('furious is more saturated than bitter', fC > bC);

/* 6. Label fitting and the 12px floor -------------------------------------- */
heading('6. Label auto-fit and the 12px device floor');
let minFamilyFs = Infinity;
for (const f of atlas.families) {
  const fs = familyFontSize(f.id, f.span, f.mid);
  minFamilyFs = Math.min(minFamilyFs, fs);
  console.log(
    `  ${f.id.padEnd(10)} mid ${f.mid.toFixed(1).padStart(6)}deg  ` +
      `${familyLabelIsReversed(f.mid) ? `reversed r=${R.familyLabelRev}` : `normal   r=${R.familyLabel}`}  fs ${fs}`
  );
}
check('no family label is upside-down', atlas.families.every((f) => {
  // A label reads upside-down when its mid-angle is in the lower half and the
  // path was not reversed; reversal must cover exactly (100, 260).
  const rev = familyLabelIsReversed(f.mid);
  return rev === (f.mid > 100 && f.mid < 260);
}));

/*
 * A radial label reads upside-down when its rotation falls outside +/-90deg of
 * horizontal. Right half: rot = mid - 90 for mid in [0,180] -> [-90, 90].
 * Left half flips: rot = mid + 90 for mid in (180,360) -> (270,450), i.e.
 * (-90, 90) mod 360. Assert it holds for every word in every bloom.
 */
let upsideDown = 0;
let readsInward = 0;
let leftHalf = 0;
for (const f of atlas.families) {
  f.words.forEach((w, i) => {
    const span = 360 / f.words.length;
    const mid = i * span + span / 2;
    const { rotation, flip } = leafLabelTransform(mid);
    const normalised = ((rotation % 360) + 540) % 360 - 180; // -180..180
    if (Math.abs(normalised) > 90) upsideDown++;
    if (mid > 180) {
      leftHalf++;
      // Flipped labels anchor at the outer radius and run back toward centre.
      if (flip) readsInward++;
    }
  });
}
check('no leaf label reads upside-down, in any bloom', upsideDown === 0, `${upsideDown} of 63`);
check('every left-half leaf label reads inward', readsInward === leftHalf, `${readsInward}/${leftHalf}`);

let minLeafFs = Infinity;
let longest = '';
for (const f of atlas.families) {
  for (const w of f.words) {
    const fs = leafFontSize(w.id);
    if (fs < minLeafFs) {
      minLeafFs = fs;
      longest = w.id;
    }
  }
}
console.log(`  smallest family label  ${minFamilyFs} viewBox units`);
console.log(`  smallest leaf label    ${minLeafFs} viewBox units  (${longest})`);
console.log(`  root wheel needs >= ${requiredWheelWidth(minFamilyFs).toFixed(1)}px rendered for 12px labels`);
console.log(`  bloom needs        >= ${requiredWheelWidth(minLeafFs).toFixed(1)}px rendered for 12px labels`);
check('label fitting never returns a non-positive size', minFamilyFs > 0 && minLeafFs > 0);

/* 7. Seam coverage --------------------------------------------------------- */
heading('7. Seam coverage — every boundary answers');
let written = 0;
let queued = 0;
for (const f of atlas.families) {
  f.words.forEach((w, i) => {
    const { next } = bloomNeighbours(f, i);
    if (atlas.distinction(w.id, next.id)) written++;
    else queued++;
  });
}
console.log(`  boundaries: ${written + queued}  pair-specific: ${written}  guided: ${queued}`);
check('every bloomed boundary resolves to text', written + queued === 63);
check('the six written distinctions are all reachable from a bloom', written === 6);

const inner = seamHalfWidthDeg(R.seamInner);
const outer = seamHalfWidthDeg(R.seamOuter);
console.log(`  seam half-width at r=${R.seamInner}: ${inner.toFixed(3)}deg (${(inner * Math.PI / 180 * R.seamInner).toFixed(1)}px)`);
console.log(`  seam half-width at r=${R.seamOuter}: ${outer.toFixed(3)}deg (${(outer * Math.PI / 180 * R.seamOuter).toFixed(1)}px)`);
check('inner radius uses the 22px floor, not the 4deg wedge', inner > 4);
check('outer radius uses the 4deg wedge', Math.abs(outer - 4) < 1e-9);
check('seam zone is at least 44px wide everywhere', inner * 2 * (Math.PI / 180) * R.seamInner >= 44);

/* 8. Authored content ------------------------------------------------------ */
heading('8. Authored content');
const withContent = atlas.families.flatMap((f) => f.words.filter((w) => w.definition).map((w) => w.id));
console.log(`  words with authored leaf content: ${withContent.join(', ') || '(none)'}`);
check('all 63 emotion pages are authored', withContent.length === 63);
check('resentful remains the authored model', withContent.includes('resentful'));
for (const family of atlas.families) {
  family.words.forEach((word, index) => {
    if (!word.definition) return;
    const { prev, next } = bloomNeighbours(family, index);
    const adjacent = new Set([prev.id, next.id]);
    check(`${word.id} has authored coordinates`, Boolean(word.coordinates?.trim()));
    check(`${word.id} has a labeling note`, Boolean(word.labelingNote?.trim()));
    check(`${word.id} has two nearby contrasts`, word.nearby?.length === 2);
    check(
      `${word.id} nearby words are physically adjacent`,
      word.nearby?.every((entry) => adjacent.has(entry.word) && entry.contrast?.trim())
    );
    check(
      `${word.id} has three complete techniques`,
      word.techniques?.length === 3 && word.techniques.every((technique) =>
        technique.name?.trim() && technique.body?.trim() && technique.whereItBreaks?.trim()
      )
    );
  });
}
check('adopted seeds present', atlas.adoptedSeeds.length === 3);
console.log(`  adopted seeds: ${atlas.adoptedSeeds.map((s) => `${s.word} (${s.origin})`).join(', ')}`);

/* ---------------------------------------------------------------------- */
console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}\n`);
process.exit(failures === 0 ? 0 : 1);
