# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Crypto Emoji Translator** is a pure client-side educational web tool that converts classical ciphers and encoded text into colorful emoji sequences. The tool demonstrates that changing visual representation doesn't improve cryptographic strength - frequency distributions and reversibility remain unchanged.

Demo: https://ipusiron.github.io/crypto-emoji-translator/

## Running the Application

This is a static web application with no build process:

```bash
# Open directly in browser
start index.html

# Or serve with a local server (for testing fetch requests)
python -m http.server 8000
# Then open http://localhost:8000

# Alternative: Node-based server
npx http-server .
```

No installation, build, or package management required.

## Testing

No automated tests. Manually verify after changes:
- Each cipher mode (Caesar, Vigenère, Morse, Binary, Hex, Custom)
- Custom map save/load cycle and JSON import/export
- Practice mode counters and timing
- Theme toggles (default/dark/light)
- Language switching (Japanese/English)

Check browser devtools for console warnings and failed network requests.

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
Edit `data/emoji_sets.json`:
- Each set must have exactly 26 unique emoji in `items` array
- Set requires `id` (unique), `name` (display), and `items`
- Preview displays first 12 emoji

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

- Emoji mappings include `aria-label` with original letter
- High contrast support for visualizer grid
- All operations keyboard-accessible
- Color-blind users may have difficulty distinguishing similar emoji (documented limitation)