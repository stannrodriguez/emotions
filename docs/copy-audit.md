# Copy Audit: Emotion Atlas

## Changes made

- `index.html` title, description, OG, and Twitter meta: Expanded bare title, removed em dash from description, and added missing Open Graph and Twitter tags.
- `src/app.js` dynamic `document.title`: Replaced em dashes with pipes and added tab titles for Depths, Constellation, and Lexicon routes.
- `src/app.js` loading and error states: Named Emotion Atlas in the loading message and clarified that data failed to load in the error state.
- `src/app.js` nav, sheet, and close `aria-label` attributes: Clarified screen reader labels ("Primary navigation", "Emotion details", and "Close emotion details" instead of reading the multiplication symbol).
- `src/views/wheel.js` default and bloom captions: Removed repetition with the shell footnote and aligned "nearby shades" to "words" for consistent terminology.
- `src/views/wheel.js` seam guidance, leaf preview, family preview, and back `aria-label`: Removed em dashes, matched leaf preview terms to page headings ("nearby words, and what helps"), and used device-neutral "Select" for focus/pointer previews.
- `src/views/leaf.js` GO DEEPER note and card separators: Replaced em dashes with colons in NEARBY and WHERE IT BREAKS rows, and corrected "from other lexicons" to "from English and other languages" so English depth words are included.
- `src/views/depths.js` adopt buttons and footnote: Added per-word `aria-label` on each `+ ADOPT` button for screen readers and replaced figurative "live in" with "are saved in".
- `src/data/depths.json` intro note: Replaced figurative framing and em dash with plain explanation of emotional granularity and adopting words.
- `src/views/constellation.js` captions: Clarified "name it" to "see its word", added the 24-day window to the empty state, and replaced internal term "wheel anchors" with "closest wheel word".
- `src/views/lexicon.js` input `aria-label` and footnote: Told users to press Enter to add a word (there is no submit button) and clarified that wheel words link back to their full page.
- `README.md` and `package.json`: Removed em dashes, fixed missing Oxford comma, and updated "two Google fonts" to "two self-hosted IBM Plex fonts" to match `assets/fonts.css`.
- `scripts/verify-ui.mjs`: Updated string assertions and the 3b reference replacement to match the edited UI strings.

## Left alone on purpose

- `src/data/emotions.json` (all 63 emotion definitions, coordinates, labeling notes, nearby contrasts, techniques, 6 pair-specific distinctions, and 3 adopted seeds): Authored definitions and entries, preserved verbatim (including em dashes in `moved`, `resentful`, and `guilty|ashamed`).
- `src/data/depths.json` (all 30 depth word definitions): Authored definitions, preserved verbatim (including em dashes in `hygge`, `seething`, and `iktsuarpok`).
- `src/views/leaf.js` signed-off 3b card labels (`+ KEEP THIS WORD`, `KEPT`, `kept in your lexicon on this device`, `NEARBY`, `WHAT HELPS`, `WHERE IT BREAKS`): Pixel-diffed against `design/Wheel Directions.dc.html` and already clear.
- `src/app.js` masthead, footnote, and tab labels (`WHEEL`, `DEPTHS`, `CONSTELLATION`, `LEXICON`): Concise, clear, and sized to fit the mobile chrome.
- `src/views/wheel.js` SVG center labels (`tap the closest / family`, `‹ back`): Sized tightly to the inner SVG circle geometry.
- `src/views/constellation.js` phrase "A mirror, not a tracker.": Intentional design-spec voice from `design/HANDOFF.md`.
- `design/`: Reference handoff documents and screenshots, not live site copy.
