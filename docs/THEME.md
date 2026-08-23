# MatchReadyTX — Visual Theme

**Purpose:** Single reference for color, surfaces, and layout so the PWA stays visually consistent with the **T03 (to3-app)** monochrome system, implemented through **PatternFly v6 theming** (color scheme + high contrast).

**Source of truth (code):**

| File | Role |
|------|------|
| [`src/styles/tokens.css`](../src/styles/tokens.css) | Palette hex literals, `--rs-color-*` semantics, `--pf-t--global-*` overrides |
| [`src/styles/theme-high-contrast.css`](../src/styles/theme-high-contrast.css) | Custom `rs-*` chrome aligned with PF high contrast |
| [`src/app/theme.ts`](../src/app/theme.ts) | Applies `pf-v6-theme-dark` + `pf-v6-theme-high-contrast` on `<html>` |
| [`src/app/shell.css`](../src/app/shell.css) | Layout and components — **no raw hex** |
| Mirror: [`.design/theme.md`](../.design/theme.md) |

**Last updated:** 2026-08-22  
**Inspiration:** T03 / to3-app monochrome — adapted for Vite + PatternFly.

**PatternFly references:**

- [Theming overview](https://www.patternfly.org/foundations-and-styles/theming/#dark-mode)
- [Dark theme handbook](https://www.patternfly.org/foundations-and-styles/theming/dark-theme-handbook/)
- [High contrast handbook](https://www.patternfly.org/foundations-and-styles/theming/high-contrast-handbook/)

---

## Theming model

MatchReadyTX uses PatternFly’s layered model:

| Layer | Class / mechanism | MatchReadyTX |
|-------|-------------------|--------------|
| **Color scheme** | `pf-v6-theme-dark` on `<html>` | Light (default) or dark — sun/moon toggle, `localStorage` key `rs-theme` |
| **High contrast** | `pf-v6-theme-high-contrast` on `<html>` | **Always on** — monochrome product targets WCAG AAA-style clarity (7:1 text, 4.5:1 UI) |
| **Brand** | `--pf-t--global--*` overrides in `tokens.css` | Black/white brand, not PatternFly blue |

`initTheme()` and `persistTheme()` live in [`src/app/theme.ts`](../src/app/theme.ts). `watchSystemContrastPreferences()` re-applies when OS `forced-colors` or `prefers-contrast: more` changes.

---

## Token layers (no hex in components)

1. **`--rs-palette-*`** — literal colors **only in `tokens.css`**
2. **`--rs-color-*`** — semantic tokens used in `shell.css` and features
3. **`--pf-t--global--*`** — PatternFly globals remapped for monochrome; PF components consume these automatically

**Rule:** Do not use `#…` or color names in `shell.css` or feature CSS. Add a palette + semantic pair in `tokens.css` instead.

---

## Palette (light scheme reference)

High contrast, low distraction. Greys carry hierarchy; red is reserved for urgency.

| Role | Semantic token | Palette (light) |
|------|----------------|-----------------|
| Primary (brand) | `--rs-color-primary` | `--rs-palette-black` |
| On primary | `--rs-color-on-primary` | `--rs-palette-white` |
| Canvas | `--rs-color-bg` | `--rs-palette-gray-50` |
| Surface | `--rs-color-surface` | `--rs-palette-white` |
| Border | `--rs-color-border` | `--rs-palette-gray-200` |
| Ink (body text) | `--rs-color-ink` | `--rs-palette-black` |
| Muted meta | `--rs-color-muted` | `--rs-palette-gray-600` |
| Urgent | `--rs-color-urgent` | `--rs-palette-red-urgent` |
| On urgent (solid red) | `--rs-color-on-urgent` | `--rs-palette-white` |
| Urgent label ink | `--rs-color-urgent-ink` | red in light, white in dark |

Dark scheme inverts via `.pf-v6-theme-dark.rs-theme` in `tokens.css` (black canvas, white ink).

---

## High contrast (custom chrome)

PatternFly components pick up high contrast when `pf-v6-theme-high-contrast` is on `<html>`. Custom `rs-*` surfaces get explicit borders in `theme-high-contrast.css` (cards, list rows, FAB, filter chips, urgent left accents) using:

- `--pf-t--global--border--color--default`
- `--pf-t--global--border--width--regular` / `--strong` / `--extra-strong`
- Plain-action hover border widths where applicable

Shadows are disabled (`--rs-shadow: none`); borders replace elevation.

---

## Status semantics

| Token | Usage |
|-------|--------|
| `--rs-color-urgent` | Needs action, due counts, destructive accent |
| `--rs-color-on-urgent` | Text on solid red (badges, dark pills) |
| `--rs-color-urgent-ink` | Urgency labels on tinted/dark surfaces (not red-on-black) |
| `--rs-color-ok` / `--rs-color-warn` | Success / assigned (tinted with `--rs-color-surface`) |

Status tints use `color-mix(..., var(--rs-color-surface))` so light and dark schemes stay correct.

---

## Layout (mobile-first, T03-aligned)

| Pattern | Spec |
|---------|------|
| Page pad | `--rs-page-pad` = `0.75rem` |
| Section stack | `--rs-space-md` via `.rs-stack` |
| Bottom clearance | `--rs-bottom-clearance` above fixed nav |
| Tap targets | ≥ `--rs-tap-min` (48px) |

Use `--rs-space-*` / `--pf-t--global--spacer--*` — not raw px in layout CSS.

---

## Images & dark scheme

- **Logo:** `BrandLogo` swaps `matchReadyLogo.png` / `matchReadyLogoWHITE.png` (PatternFly image handbook pattern).
- **Referee level chart:** single PNG + brightness tweak in dark scheme; consider dual asset later.

---

## Component conventions

See prior sections in this doc for pills, filter chips, sign-in, masthead, match list rows, etc. Primary actions = `--rs-color-primary` fill + `--rs-color-on-primary` label.

---

## Relationship to T03

| T03 (Flutter) | MatchReadyTX (PWA) |
|---------------|--------------------|
| `AppColors.primary` | `--rs-color-primary` |
| `AppColors.statusLive` | `--rs-color-urgent` |
| Bottom nav | `.rs-bottom-nav` |
| Roboto | `--rs-font-family` |
