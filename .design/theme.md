# MatchReadyTX — App Theme and Material 3 Migration Guide

See **[`docs/THEME.md`](../docs/THEME.md)** for the full guide.

**Code**

- `src/styles/tokens.css` — palette, semantic roles, and compatibility tokens
- `src/theme/m3Theme.ts` — MUI Material 3 theme and component defaults
- `src/styles/theme-high-contrast.css` — custom HC chrome
- `src/styles/shell/` — shared chrome (`index.css` barrel)
- `src/app/theme.ts` — `pf-v6-theme-dark` + `pf-v6-theme-high-contrast`
- `src/features/**/*.css` — feature styles (import from layouts/pages)

**Direction:** MatchReadyTX monochrome, high-contrast identity implemented with
Material Design 3 semantics and MUI. Existing `pf-v6-*` names are transitional
compatibility hooks.

**Last updated:** 2026-10-11
