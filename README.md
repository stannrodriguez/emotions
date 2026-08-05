# Emotion Atlas

A mobile-first, on-device emotion wheel. Six families bloom into 63 finer words;
each word opens a page. Two secondary views: **Constellation** (recent landings
drawn on the wheel's geometry) and **Lexicon** (kept words, including adopted
foreign ones).

Precise naming is itself the first intervention — affect labeling measurably
lowers emotional intensity — so the app treats finding the word as therapy, not
just navigation.

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
rotation, seam hit-zone widths, and that exactly one word (`resentful`) carries
authored content.

`verify:ui` drives the app: the radius-dependent seam rule, keyboard navigation,
the five deep links, the bloom animation and its reduced-motion behaviour, the
12px label floor across eight widths, and both queued states.

It also **pixel-diffs the leaf page against the design file's own 3b markup**,
which it extracts from `design/Wheel Directions.dc.html` at runtime and serves
alongside the build. Comparing against `screenshots/leaf-page.png` would be
misleading — that capture was made on a platform whose text shaping is ~1.4%
narrower at 14.5px, which reflows a line. Diffing against the markup removes
the platform from the comparison. It currently reports 0 differing pixels of
471,366.

Both run in CI and gate the Pages deploy.

## Layout

```
src/core/       geometry, colour, taxonomy, storage, routing — no DOM
src/views/      the four views
src/data/       emotions.json — the canonical data file, loaded as-is
design/         the design handoff: spec, exploration document, screenshots
scripts/        verification
```

The split between `src/core` and `src/views` is deliberate: the constellation
reuses the wheel's angular layout and colour maths, so both live in `core` and
neither view owns them.

## Content status

62 of the 63 words have no authored leaf content yet, and 57 of the 63 boundary
distinctions are unwritten. The app renders an honest queued state for these —
see "Missing content: the queued state" in `design/HANDOFF.md`. **Content is
never generated to fill the gaps.** `resentful` is the written template; the
rest arrive from the product owner.

## Storage

| Key              | Shape                                                          |
| ---------------- | -------------------------------------------------------------- |
| `atlas.lexicon`  | `[{word, familyId \| "adopted", origin?, definition?, keptAt}]` |
| `atlas.landings` | `[{word, at}]`                                                  |

The `atlas.` prefix is a frozen internal identifier, independent of the product
name (still a working name). Renaming it would lose every kept word to a
migration.

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
