# Repository Guidelines

## Project Structure & Module Organization
- `index.html` hosts the single-page UI and wires CSS/JS resources.
- `css/style.css` defines light/dark themes via CSS variables; extend tokens instead of hard-coded colors.
- `js/main.js` manages application state, mode switching, and emoji loading from `data/emoji_sets.json`.
- `js/modes/*.js` contain encoder logic (`Caesar`, `Vigenere`, `Morse`, `BinaryHex`); mirror file naming when adding modes.
- `js/custommap.js` handles custom mappings and `localStorage` persistence; update alongside UI changes.
- `data/emoji_sets.json` stores emoji inventories (cap entries at 26 items to avoid null fallbacks).
- `assets/` holds screenshots and marketing art; keep additions optimized (<500 KB in PNG/WebP).

## Build, Test & Development Commands
- `python -m http.server 8000` — serve the root locally for manual QA without extra tooling.
- `npx http-server .` — quick Node-based static server; helpful on Windows and Codespaces.
- Directly open `index.html` for rapid layout checks, but prefer a server when testing `fetch` requests.

## Coding Style & Naming Conventions
- Use 2-space indentation, `const`/`let`, and semicolons across JavaScript files.
- Keep functions and variables in camelCase; reserve PascalCase for mode objects and shared helpers.
- Favor template literals for UI text and the `EL(id)` helper for DOM lookups.
- Maintain UTF-8 bilingual copy (Japanese + English) and emoji literals; never replace with ASCII substitutes.
- Extend `css/style.css` selectors rather than scattering inline styles.

## Testing Guidelines
- Automated tests are not yet present; manually verify each mode (Caesar, Vigenère, Morse, Binary, Hex, Custom) after changes.
- Re-check the custom map save/load cycle, practice counters, and theme toggles on every run.
- Inspect browser devtools for console warnings, accessibility violations, and failed network requests when editing `data/emoji_sets.json`.

## Commit & Pull Request Guidelines
- Git history currently includes only `Initial commit`; adopt Conventional Commit prefixes (e.g., `feat:`, `fix:`) to seed consistency.
- Reference linked issues in PR descriptions, summarize user-visible impact, and note manual test coverage.
- Attach before/after screenshots or GIFs whenever UI, emoji sets, or styling changes.

## Localization & Accessibility
- Preserve aria-labels and keyboard navigation when introducing new controls; follow existing tab order.
- Update both Japanese and English strings when text changes, and provide English fallbacks for new labels.
