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

## Verifying the data and the maths

```sh
npm run verify
```

Checks family word counts (10 / 11 / 12 / 7 / 12 / 11 = 63), the six written
distinction keys, the family seam edges, the greyscale lightness ordering, the
within-bloom arousal ordering, label auto-fit and the 12px floor, seam hit-zone
widths, and that exactly one word (`resentful`) carries authored content.

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

Static; deploys to GitHub Pages from the repo root.
