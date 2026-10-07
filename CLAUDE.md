# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Crypto Emoji Translator** is a pure client-side educational web tool that converts classical ciphers and encoded text into colorful emoji sequences. The tool demonstrates that changing visual representation doesn't improve cryptographic strength - frequency distributions and reversibility remain unchanged.

Demo: https://ipusiron.github.io/crypto-emoji-translator/

## Running the Application

This is a static web application with no build process:

```bash
# Open directly in browser — this works: nothing is fetched at runtime
start index.html

# Or serve over HTTP
python -m http.server 8000
```

No installation, build, or package management required for the app itself.
The emoji sets used to be fetched from `data/emoji_sets.json`, which made
`file://` fail outright (`Fetch API cannot load file:// … URL scheme "file" is not supported`),
so they are now a plain script: `js/emoji-sets.js`.

## Testing

```bash
npm test
```

`node --test`, no dependencies, Node.js 22+. GitHub Actions runs it on push and pull request.

- `test/core.test.js` — grapheme splitting, round trips for every mode × every emoji set,
  the Morse table against ITU-R M.1677-1, edge cases
- `test/html.test.js` — static checks on index.html and the screen-side scripts
- `test/i18n.test.js` — the two dictionaries against the wording on screen
- `test/contrast.test.js` — contrast ratios for all three themes, target sizes, ARIA, meta CSP
- `test/readme.test.js` — the README against the implementation

Still worth checking by hand in a browser: the custom map save/load cycle,
practice counters and timing, and the three themes.

## Architecture

### Core Components

1. **Main Controller** (`js/main.js`)
   - Global state management in `State` object
   - Loads emoji sets from `data/emoji_sets.json`
   - Manages tab navigation and UI updates
   - Handles encoding/decoding dispatch to cipher modules
   - URL parameter sharing for pre-configured transformations

2. **Cipher Modules** (`js/modes/`)
   - `caesar.js` - Caesar cipher with configurable shift (0-25)
   - `vigenere.js` - Vigenère cipher with alphabetic key
   - `morse.js` - Morse code encoding using ⚫⚪ for dots/dashes
   - `binaryhex.js` - Binary and hexadecimal encoding with chunking options

3. **Custom Map System** (`js/custommap.js`)
   - Drag-and-drop editor for creating custom A-Z → emoji mappings
   - Validation ensures all 26 letters mapped uniquely
   - Persists to localStorage
   - JSON import/export for sharing between devices

4. **Data** (`data/emoji_sets.json`)
   - Predefined emoji sets: Foods, Shapes, Weather, Animals
   - Each set must contain exactly 26 emoji for A-Z mapping

### Key Architecture Patterns

- **Pure client-side processing**: No server communication. All cipher operations execute in browser.
- **Two-stage substitution**: Classical cipher → intermediate alphabet → emoji representation
- **26-character mapping**: All ciphers normalize to A-Z before emoji substitution
- **URL-based sharing**: Parameters encode mode, settings, keys, and short inputs for sharing
- **localStorage persistence**: Custom maps saved locally per-device

### Data Flow

```
Input Text
  → Normalize (uppercase, remove spaces/punct per settings)
  → Apply cipher (Caesar/Vigenère/etc.)
  → Map result through emoji substitution table
  → Output emoji sequence
```

Decoding reverses this process using the same mapping.

## Key Technical Details

### State Management
- Global `State` object tracks current emoji set, mode, mapping, and practice stats
- `State.mapping26` is the active A-Z → emoji object used for all transformations
- Cipher modules are stateless; they receive mapping as parameter

### Emoji Mapping
- Each emoji set in `data/emoji_sets.json` has structure: `{id, name, items[]}`
- `State.mapping26` is rebuilt whenever user changes emoji set
- Custom mode uses localStorage map instead of preset sets

### URL Parameters
- `mode`: caesar|vigenere|morse|binary|hex|custom
- `set`: emoji set id
- `shift`: Caesar shift value
- `key`: Vigenère key string
- `bchunk`/`hchunk`: Binary/hex chunking (8|4|2|none)
- `keepS`/`keepP`/`up`: Boolean flags (1|0)
- `in`: URLencoded input text (limit 512 chars to avoid URL bloat)

### Practice Mode
- Generates random challenges from predefined phrase pool
- Tracks correct answers, total attempts, and timing
- Stats persist only for current session (not saved)

## File Modification Guidelines

### Adding New Emoji Sets
Edit `js/emoji-sets.js`:
- Each set must have exactly 26 unique emoji in `items` (the tests enforce both)
- Set requires `id` (unique), `name` (display), and `items`
- Preview displays first 12 emoji
- **Every item must be a single grapheme cluster.** `test/core.test.js` checks this,
  so an emoji that needs U+FE0F is fine (the splitting handles it), but a ZWJ sequence is not
  (see "Emoji and graphemes" below)

### Adding New Cipher Modes
1. Create new module in `js/modes/` following pattern:
   ```javascript
   const NewCipher = {
     encodeToEmoji(text, params, emojiMapping) { /* return emoji string */ },
     decodeFromEmoji(emojiText, params, emojiMapping) { /* return plain text */ }
   };
   ```
2. Add `<script>` tag in `index.html`
3. Add option in `#mode` select in `index.html`
4. Add case in `mountModeOptions()`, `encodeCurrent()`, `decodeCurrent()` in `main.js`
5. Update URL parameter handling in `updateShareURL()` and `applyParams()`

### Modifying UI
- Bilingual support (Japanese/English) via `js/i18n.js` - update both language entries
- Use `data-i18n` attribute for translatable elements
- Accessibility: Use `aria-label`, `aria-live`, `role` attributes
- Dark mode toggles document background color only

## Emoji and graphemes (js/graphemes.js)

`Array.from(s)` and `[...s]` split by **code point**, which breaks any emoji carrying a
variation selector: `Array.from('◻️')` gives `['◻', '\uFE0F']`. That is why decoding used to
fail for 17 letters across the sets (weather alone has 14) and why binary decoding always
returned an empty string.

- Split with `Graphemes.split()`, never `Array.from`. It uses `Intl.Segmenter`
  (Chrome 87 / Safari 14.1 / **Firefox 125, 2024-04-16**) and falls back to a small
  hand-rolled splitter where that is missing
- Build reverse lookups with `Graphemes.buildInverse()` / `Graphemes.lookup()`; they accept
  the emoji with or without its variation selector
- **Prefer emoji whose `Emoji_Presentation` property is Yes** (they need no U+FE0F).
  `⬜`/`⬛` (U+2B1C/U+2B1B) qualify; `◻️`/`◼️` (U+25FB/U+25FC) do not — the same square
  family splits both ways, which is exactly how the original bug got in
- **Do not put ZWJ sequences in a substitution table.** `👨‍👩‍👧` and `👨👩👧` would map to the
  same symbol string, so the reverse direction is not unique

## Coding Style

- 2-space indentation, `const`/`let`, semicolons
- camelCase for functions/variables, PascalCase for module objects (Caesar, Vigenere, Morse, BinaryHex, CustomMap)
- Use `EL(id)` helper for DOM lookups
- Template literals for dynamic UI text
- Keep UTF-8 emoji literals; never replace with ASCII
- Extend `css/style.css` selectors rather than inline styles

## Privacy & Security Notes

- **No server communication**: All processing is client-side
- **No external dependencies**: Pure vanilla JS, no frameworks
- **localStorage only**: Custom maps saved locally, not transmitted
- **Shared URLs**: If `in` parameter is used, input text is visible in URL
- **Educational purpose**: These are classical ciphers with known weaknesses; not for actual security

## Accessibility Considerations

- Emoji mappings include `aria-label` with the original letter
- **Every text colour must reach 4.5:1 against its background in all three themes.**
  `test/contrast.test.js` computes this from the CSS variables, so add new colours as
  variables and note the measured ratio in a comment. White text on `--accent` only gives
  2.00:1, which is why `--on-accent` / `--on-danger` exist
- Inputs are 16px (below that, iOS Safari zooms in), buttons 44px,
  checkboxes 20px, the help icon 24px (WCAG 2.2 Target Size (Minimum))
- Tabs move with the arrow keys, Home and End; only the selected tab has `tabindex="0"`
- The help icon is a `button`, so its tooltip is reachable by keyboard
- **Known gap**: assigning a custom map is drag-and-drop only. JSON import is the
  keyboard alternative; say so rather than claiming full keyboard support

## Writing

- Japanese: polite form in prose, plain form in bullet lists and tables;
  long vowel marks (ブラウザー, リポジトリー, ディレクトリー)
- **モールス符号**, not モールス信号 — that is the term in 電波法 / 無線局運用規則
  and matches ITU's *International Morse code*
- README.md and README.en.md mirror each other section for section
- Color-blind users may have difficulty distinguishing similar emoji (documented limitation)