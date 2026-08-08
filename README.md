# Emotion Atlas

A mobile-first, on-device emotion wheel. Six families bloom into 63 finer words;
each word opens a page. Three secondary views: **Depths** (a curated collection
of finer words beyond the wheel, each anchored to its nearest wheel word),
**Constellation** (recent landings drawn on the wheel's geometry) and
**Lexicon** (kept words, including adopted foreign ones).

Research on affect labeling suggests that putting feelings into words can
reduce emotional reactivity. The app treats precise naming as a useful first
step for reflection, not as therapy or diagnosis.

The Depths view extends this with the related idea of *emotional granularity*
(Lisa Feldman Barrett and colleagues): the skill of telling similar feelings
apart finely, which grows the way any vocabulary grows — one precise word at a
time. Its collection lives in `src/data/depths.json`: 30 words (uncommon
English words and adopted foreign ones), each anchored to a wheel word so it
also surfaces on that word's page as a GO DEEPER module. Adopting a depth word
writes it to the lexicon in the same shape as the adopted seeds.

No backend, no accounts, no analytics. All state is on-device.

## Running it

There is no build step. It is a static site of ES modules, SVG, and two Google
fonts.

```sh
npm start          # serves the repo root at http://localhost:4173
```

Any static file server works. Opening `index.html` from `file://` will not,
because ES modules and `fetch` need an HTTP origin.

## Verification

```sh
npm run verify        # data, palette, geometry — no browser
npm run verify:ui     # the rendered app, in Chromium
npm run verify:all    # both
```

`verify` checks family word counts (10 / 11 / 12 / 7 / 12 / 11 = 63), the six
written distinction keys, the family seam edges, the greyscale lightness
ordering, the within-bloom arousal ordering, label auto-fit and upside-down
rotation, seam hit-zone widths, the completeness and wheel adjacency of all
63 authored emotion pages, and the depths collection (complete entries, valid
wheel anchors, no collisions with wheel words or seeds, at least three per
family).

`verify:ui` drives the app: the radius-dependent seam rule, keyboard navigation,
the six deep links, the bloom animation and its reduced-motion behaviour, the
12px label floor across eight widths, authored leaf content, first-run empty
states, and the depths adopt flow (including the leaf page's GO DEEPER module,
which sits outside the pixel-diffed card).

It also **pixel-diffs the leaf page against the design file's own 3b markup**,
which it extracts from `design/Wheel Directions.dc.html` at runtime and serves
alongside the build. Comparing against `screenshots/leaf-page.png` would be
misleading — that capture was made on a platform whose text shaping is ~1.4%
narrower at 14.5px, which reflows a line. Diffing against the markup removes
the platform from the comparison. It reports zero differing pixels.

Both run in CI and gate the Pages deploy.

## Layout

```
src/core/       geometry, colour, taxonomy, storage, routing — no DOM
src/views/      the five views
src/data/       emotions.json + depths.json — the canonical data files, loaded as-is
design/         the design handoff: spec, exploration document, screenshots
scripts/        verification
```

The split between `src/core` and `src/views` is deliberate: the constellation
reuses the wheel's angular layout and colour maths, so both live in `core` and
neither view owns them.

## Content status

All 63 emotion pages are authored. Each carries evocative coordinates, a concise
definition, the two words physically adjacent on the wheel, and three practical
techniques with explicit limits. `resentful` remains the voice and structure
model. Six boundaries have pair-specific distinctions; every other boundary
guides the reader to compare the two complete pages.

## Storage

| Key              | Shape                                                          |
| ---------------- | -------------------------------------------------------------- |
| `atlas.lexicon`  | `[{word, familyId \| "adopted", origin?, definition?, keptAt}]` |
| `atlas.landings` | `[{word, at}]`                                                  |

The `atlas.` prefix is a frozen internal identifier, independent of the product
name. Renaming it would lose every kept word without a migration.

## Deployment

Static; deploys to GitHub Pages from the repo root. There is no build step — the
site is the repository, and every path is relative, so it also works from a
project subpath.

`.github/workflows/pages.yml` deploys on every push to `main`, after both
verifiers pass.

**One-time setup:** Pages has to be turned on for the repository before the
first deploy can succeed. Go to **Settings → Pages → Build and deployment** and
set **Source** to **GitHub Actions**, then re-run the workflow. The workflow
passes `enablement: true`, which turns Pages on by itself where the token allows
it, but creating a Pages site needs repository-admin rights that the default
`GITHUB_TOKEN` does not carry — it fails with *"Create Pages site failed:
Resource not accessible by integration"* until the setting is flipped by hand.
