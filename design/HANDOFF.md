# Handoff: Emotion Atlas

## Overview
Emotion Atlas (working name) is a mobile-first app that helps someone find the precise word for what they're feeling. Its core is an interactive emotion wheel: six families (angry, sad, afraid, happy, disgusted, surprised) that bloom into 63 finer words. Precise naming is itself the first intervention — affect labeling measurably lowers emotional intensity — so the app treats finding the word as therapy, not just navigation. Three views: **Wheel** (find the word), **Constellation** (recent landings drawn on the wheel's geometry), **Lexicon** (kept words, including adopted foreign words).

The chosen visual direction is **"Atlas"** — the wheel as surveyed terrain: paper ground, hairline strokes, monospace cartographic labels, serif body text. Calm without being pastel.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy. Your task is to **recreate these designs in the target codebase's environment** using its established patterns — or, if no codebase exists yet, pick an appropriate stack (a small SPA framework or vanilla JS + SVG is plenty; there is no backend — all state is on-device).

`Wheel Directions.dc.html` is a design-exploration document containing several iterations. **Build only from turn 3 (section id `t3`, options 3a/3b/3c) plus the lexicon (2b) and app shell (2c) from turn 2.** Earlier turns (1a–1d) are rejected directions — ignore them. The wheel logic in the file (a JS class) contains the exact color math, geometry, and taxonomy data; lift values from it freely.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final unless noted. Recreate pixel-perfectly. The leaf page (3b) is signed off — do not redesign it. Exceptions flagged as lofi: the app shell (2c) is a first pass at chrome/navigation; empty states and onboarding are unspecified (see Open items).

## The Taxonomy (data)
6 families → 63 words, in a fixed adjacency order (each word sits next to its nearest semantic neighbor; family edges meet at real boundaries: serene|nostalgic, ashamed|alienated, disdainful|contemptuous, furious|panicked, wary|startled, awed|excited). Each family has a hue, an arousal value (0–1), and a valence value (0–1); each word has an arousal value (0–1).

Families (hue, arousal, valence):
- surprised (hue 60, a .85, val .5): startled .95, shocked .9, stunned .8, disoriented .7, confused .55, bewildered .6, curious .5, intrigued .55, amazed .75, awed .65
- happy (hue 90, a .55, val .9): excited .9, joyful .8, amused .6, proud .6, hopeful .55, grateful .4, affectionate .45, moved .5, content .25, relieved .35, serene .12
- sad (hue 245, a .3, val .15): nostalgic .3, grieving .5, melancholy .25, homesick .35, lonely .35, hurt .55, disappointed .45, discouraged .35, hopeless .2, regretful .4, guilty .5, ashamed .45
- disgusted (hue 120, a .45, val .15): alienated .35, averse .4, squeamish .5, revolted .7, appalled .75, scornful .6, disdainful .5
- angry (hue 25, a .75, val .1): contemptuous .55, envious .5, jealous .6, betrayed .65, bitter .45, resentful .5, indignant .7, exasperated .75, frustrated .7, impatient .65, irritated .6, furious .97
- afraid (hue 305, a .8, val .12): panicked .97, overwhelmed .85, dreading .6, anxious .75, worried .55, suspicious .5, insecure .45, self-conscious .5, vulnerable .4, helpless .3, wary .45

**The `coordinates` string is authored content.** The valence word derives from the family (pleasant/unpleasant), but the arousal word (“simmering”, etc.) is hand-picked per word for evocativeness. Never derive it mechanically from the arousal number, and never abbreviate.

Store as `emotions.json` (**already provided in this bundle** — extracted from the design file and verified against it; load it as-is rather than re-parsing the HTML):
```json
{
  "families": [{
    "id": "angry", "hue": 25, "arousal": 0.75, "valence": 0.1,
    "words": [{
      "id": "resentful", "arousal": 0.5,
      "coordinates": "unpleasant · simmering",
      "definition": "…",
      "labelingNote": "…",
      "nearby": [{"word": "bitter", "contrast": "…"}, {"word": "indignant", "contrast": "…"}],
      "techniques": [{"name": "Name the cost", "body": "…", "whereItBreaks": "…"}]
    }]
  }],
  "distinctions": {"guilty|ashamed": "…", "envious|jealous": "…"}
}
```
Six distinctions are written (see the `DIST` object in the design file): guilty|ashamed, envious|jealous, anxious|worried, disappointed|discouraged, nostalgic|grieving, bitter|resentful. The rest are queued for writing — the UI must handle a missing distinction gracefully (see Wheel behavior). Full leaf-page content exists only for **resentful** (3b) — it is the content template for the other 62; content for those will follow separately. **See “Missing content: the queued state” below for exactly what unwritten pages render in the meantime — never invent content.**

## Wheel geometry & color math (exact)
SVG, viewBox `0 0 720 720`, center (360,360). Angle 0° = 12 o'clock, clockwise. The wheel is rotated so the first family (surprised) is centered at the top: start angle = −(firstFamily.wordCount/63 · 360)/2.

- **Segment width = share of vocabulary**: family span in degrees = wordCount/63 · 360. This is the ONLY thing width encodes; the UI copy says so ("width is share of vocabulary").
- Segments: annulus from r=118 to r=338 (root) / 336 (bloomed). Stroke `#3f3a2c`, width 0.7 (1.8 when selected).
- **Fill** (both root families and bloomed leaves): `oklch(L C H)` with `L = 0.83 + 0.12·valence − 0.06·arousal`, `C = 0.015 + 0.1·arousal`, `H = family hue`. For a leaf, use the leaf's own arousal with the family's valence and hue. This makes lightness read as valence in grayscale (happy lightest → angry/afraid darkest) and saturation read as arousal, including *within* a bloom (furious deep, bitter pale).
- **Rim band**: an arc at r=348 (stroke-width 7 root / 6 leaf, 9 selected; root arcs have round linecaps and are inset 2° per side, leaves 1.5°): `L = 0.42 + 0.32·valence`, `C = 0.07 + 0.09·arousal`, same hue.
- **Cartographic ground** (behind everything): concentric circles r = 150,195,240,285,330, stroke `#cfc7ae` 0.7 at 55% opacity; tick marks every 15° from r=348 to 358, stroke `#7b7461` width 1 at 60% opacity.
- **Center circle**: r=104 (102 bloomed), fill `#f4f0e2`, stroke `#3f3a2c` width 1.

### Labels
- **Family labels curve along their arc** (SVG textPath at r=240; for families whose mid-angle is between 100° and 260°, reverse the path and use r=222 so text never reads upside-down). IBM Plex Mono 500, uppercase, letter-spacing 2. Font-size auto-fits: `min(23, (arcLength − 10 − chars·2) / (chars · 0.62))` where arcLength = r · span · π/180.
- **Leaf labels are radial**: anchored at r=138 pointing outward; for mid-angles > 180°, flip — anchor at r=328, rotate 180° more — so left-half labels read inward and nothing is upside down. IBM Plex Mono, uppercase, letter-spacing 1.5, font-size `min(20, (180 − chars·1.5) / (chars·0.62))`, fill `#3f3a2c`. Selected leaf: font-weight 600.
- **Minimum label size on device: 12px.** When space runs out, scale the wheel (let it overflow horizontally or shrink the center), never the type below 12px.

### Wheel behavior
- **Root → bloom**: tapping a family replaces the six segments with that family's words spread over the full 360° (equal spans). Animate: the tapped segment expands to fill the ring while its siblings fade — bloom feel, 300ms ease-out minimum (the prototype uses a scale+fade on the group; a true arc-interpolation is better if cheap). Center shows family name + "‹ back"; tapping center returns to root.
- **Leaf tap** → opens that word's leaf page (3b).
- **Seam distinctions**: every boundary between two adjacent bloomed words is an **invisible** hit zone (r 150–336, `cursor: help`). Hit-test by distance to the boundary line: the zone half-width is **±4° or 22px, whichever is greater** at the tap's radius (a pure ±4° wedge is only ~21px wide at the inner radius, which misses the 44px touch-target minimum; the px floor fixes that where fingers actually land). Tap (mobile) or hover (desktop) shows the distinction text in the caption area below the wheel. No visible markers. The caption teaches the affordance once, on first bloom: "The border between any two words holds their distinction — tap a boundary to read it." Boundaries whose distinction isn't written yet respond honestly: "word | word — every boundary answers a tap; this distinction is queued for writing."
- **Caption area** below the wheel: min-height reserved (no layout shift), IBM Plex Serif 13.5px/1.55 `#5a5443`, top border `1px solid #d6cdb2`. Default text: "Tap a family to bloom it into finer words. Precise naming is itself regulation: labeling an emotion precisely measurably lowers its intensity."
- Desktop also previews leaf words in the caption on hover.

## Screens

### 1. Wheel (home) — reference 3a, shell 2c
Purpose: find the word. Layout (mobile, ~320–430px): header (app name INSTRUMENT-spaced mono + italic serif tagline), tab row (WHEEL · CONSTELLATION · LEXICON — mono 10px, letter-spacing 1.5, active tab `#3f3a2c` with 2px bottom border, inactive `#7b7461`), the wheel (full width, square), caption area, then an italic serif footnote: "Naming an emotion precisely measurably dampens it. Finding the word is the first technique, not just the doorway." Desktop: wheel max ~560px centered; the caption doubles as the hover-preview line.

### 2. Leaf page — reference 3b (SIGNED OFF — recreate exactly)
Card: bg `#f9f6ea`, border `1px solid #d6cdb2`, radius 6, padding 24px 22px, gap 18px, body font IBM Plex Serif `#3f3a2c`. Top row: breadcrumb `ANGRY / RESENTFUL` (mono 11px `#7b7461`) left, coordinates *"unpleasant · simmering"* (italic serif 12px `#7b7461`) right — valence spelled out, arousal as an evocative word per-word (never abbreviations). H2 30px/600. Definition 14.5px/1.6. Labeling note: italic 13px between 1px `#d6cdb2` rules: "If this word fits, the naming has already started to work: labeling an emotion precisely measurably lowers its intensity." NEARBY section (mono 10px letter-spacing-2 heading): one paragraph per adjacent word, bold word + contrast sentence — **nearby words must be the words physically adjacent on the wheel**. WHAT HELPS: 3 techniques, each h3 15.5px/600 + body 13.5px + a where-it-breaks line: label `WHERE IT BREAKS` in mono 10px letter-spacing 1.5 `oklch(0.55 0.12 28)` (red, scannable), body in the same quiet serif `#5a5443` as everything else — candor, not alarm. Footer: `+ KEEP THIS WORD` button (mono 11px, 1px border `#3f3a2c`, radius 3, padding 5px 10px) + italic note "saved words live in your lexicon, on this device".

### 3. Constellation — reference 3c
Purpose: a mirror, not a tracker. The last ~3 weeks of kept/landed words drawn on the wheel's geometry: outer circle r=140 stroke `#cfc7ae`, family spokes from r=26 to 140 stroke `#ddd6c0` (at each family's start angle, same angular layout as the root wheel). Each landing is a dot at its word's mid-angle, radius from center = 40 + 92·arousal, dot size 2.5 + 3.5·recency, fill `oklch(0.55 − 0.1·a, 0.06 + 0.05·a, hue, alpha 0.3 + 0.7·recency)` where recency = max(0, 1 − daysAgo/24). **Only the newest landing is labeled** (mono-family serif 11.5px `#7b7461`, offset 9px toward center side); tapping any other dot names it. Caption: "Only the newest landing is named; tapping any dot names it. Brightness is recency. A mirror, not a tracker."

### 4. Lexicon — reference 2b
Kept words list. Header row: `LEXICON` (mono 11px ls-2) + `5 WORDS · THIS DEVICE` (mono 10px `#7b7461`). Rows separated by 1px `#d6cdb2` rules: bold serif word 16px + right-aligned mono 9.5px meta (`ANGRY · KEPT 3D AGO` for wheel words; `ADOPTED · PORTUGUESE` for adopted ones) + one-line serif 13px `#5a5443` definition. Bottom: dashed-border input `+ ADD A WORD THAT FITS` (1px dashed `#a89f85`, radius 4, mono 11px `#7b7461`) + italic note "Words from the wheel arrive with their page; adopted words carry their origin and a plain definition." Seed adopted words: saudade (Portuguese), fernweh (German), amae (Japanese) — definitions in the design file.

## Missing content: the queued state
62 of 63 words have no authored leaf content yet, and most boundary distinctions are unwritten. The app must handle this honestly, in the same voice as the boundary fallback. **A coding agent must never generate definitions, contrasts, coordinates, or techniques — placeholder only. Ask the product owner; do not invent.**

- **Unwritten leaf page**: render the full card chrome with breadcrumb and H2 word name as specced, then a single italic serif line where the definition would sit: “This word's page is queued for writing.” No labeling note, no NEARBY, no WHAT HELPS, no fabricated coordinates (the top-right coordinates slot stays empty). `+ KEEP THIS WORD` stays enabled — keeping works and records a landing; the word's page arrives when written.
- **Lexicon rows for unwritten words**: where the one-line definition would go, the same italic muted line: “page queued for writing.”
- **Constellation first run** (no landings yet): the geometry (circle + spokes) renders as normal, with the caption: “Nothing has landed yet. Words you keep are drawn here, where they live on the wheel.”
- **Lexicon first run**: seeded with the three adopted words, so it is never empty on first run. If a future remove action empties it, show: “No words kept yet. When one fits, keep it from its page.”
- Placeholder copy above is provisional product-owner copy — flag it in a comment so it's easy to revise, but ship it as written unless told otherwise.

## Interactions & Behavior
- Bloom/unbloom: 300ms ease-out, animate the ring group (scale .9→1 + fade at minimum). Respect `prefers-reduced-motion`: swap without animation.
- Seam hit zones and leaf segments: minimum effective touch target 44px — satisfied by the ±4°-or-22px rule above; verify leaf segments too at smallest supported width.
- Keyboard: arrow keys rotate focus around the ring, Enter blooms/opens, Escape unblooms. Focus ring: 1.8px `#3f3a2c` stroke (same as selected).
- Routing/deep links: `#/` root wheel, `#/angry` bloomed, `#/angry/resentful` leaf page, `#/constellation`, `#/lexicon`.
- Keeping a word: writes to lexicon + records a constellation landing (word id + ISO date).

## State & Storage (all on-device, no backend)
- `atlas.lexicon`: array of `{word, familyId|"adopted", origin?, definition?, keptAt}`
- `atlas.landings`: array of `{word, at}` (a landing is recorded on "keep"; optionally also on leaf-page open — product decision, default keep-only)
- localStorage or IndexedDB; no accounts, no sync, and the UI says so ("on this device").
- **The `atlas.` key prefix is a frozen internal identifier, independent of the product name.** The app's display name is still undecided (see Open items); do not rename storage keys when it lands, or kept words are lost to a migration.

## Design Tokens
Paper ground `#f4f0e2` · card bg `#f9f6ea` / `#f7f3e7` · ink `#3f3a2c` · body-muted `#5a5443` · label-muted `#7b7461` · hairline `#d6cdb2` · faint-ground `#cfc7ae` · spokes `#ddd6c0` · dashed input `#a89f85` · where-it-breaks red `oklch(0.55 0.12 28)`.
Fonts (Google Fonts): **IBM Plex Mono** 400/500 — all labels, headings-as-labels, buttons, metadata; **IBM Plex Serif** 400/600 + italic — all body text. No other fonts.
Radii: cards 6, buttons 3, dashed input 4. Borders are 1px or hairline 0.7. No shadows anywhere.
Type scale (mobile): mono labels 9.5–11px with 1.5–2px tracking, uppercase; serif body 12.5–14.5px; leaf H2 30px; technique h3 15.5px.

## Assets
None. Everything is SVG + type. Do not add icons, illustrations, or emoji.

## Files in this bundle
- `Wheel Directions.dc.html` — the design exploration document. Turn 3 (`#t3`: 3a wheel, 3b leaf page, 3c constellation) + turn 2's 2b (lexicon) and 2c (shell) are the build targets. The `class Component` script inside contains the canonical taxonomy data (`cores`), color/geometry math (`CFG['3a']`, `seg`, `arc`, label fitting), distinctions (`DIST`), and constellation math — treat it as the spec's source of truth where this README is ambiguous.
- `emotions.json` — **the canonical data file**: full taxonomy (6 families / 63 words with arousal values), the six written distinctions, resentful's complete leaf content, and the three adopted seed words. Extracted from the design file's JS and verified against it. Null fields are queued content — see “Missing content: the queued state.” Load this; don't re-parse the HTML for data.
- `support.js` — prototype runtime only; ignore.
- `screenshots/` — reference captures from the design doc: `wheel-root-and-bloomed.png` (3a), `leaf-page.png` (3b), `constellation.png` (3c), `lexicon.png` (2b), `app-shell.png` (2c). Note each capture shows the surrounding exploration page; the build target is the card in frame.

## Open items (do not invent — ask the product owner)
1. Content for the other 62 leaf pages and remaining boundary distinctions (resentful is the template; evidence-based, same voice).
2. App name ("Emotion Atlas" is a working name).
3. Whether opening a leaf page (vs. keeping a word) records a landing — build the default (keep-only) unless told otherwise.
(Empty states are now specced under “Missing content: the queued state” with provisional copy.)
