# MatchReadyTX — Visual Theme

**Purpose:** Single reference for color, surfaces, and layout so the PWA stays visually consistent with the **T03 (to3-app)** monochrome system.

**Source of truth (code):**
- Tokens: [`src/styles/tokens.css`](../src/styles/tokens.css)
- Shell / layout: [`src/app/shell.css`](../src/app/shell.css)
- Mirror: [`.design/theme.md`](../.design/theme.md)

**Last updated:** 2026-07-25  
**Inspiration:** `/Users/jxhale/Documents/github-repos/to3-app` (Flutter) — adapted for Vite + PatternFly.

---

## Palette: Monochrome (Black & White)

High contrast, low distraction — works in daylight and on phone OLED. Greys carry hierarchy; **one red** is reserved for urgency.

| Role | CSS token | Hex | Usage |
|------|-----------|-----|--------|
| Primary (brand) | `--rs-color-primary` | `#000000` | Primary buttons, selected nav, ink, selected filter chips |
| Secondary (brand) | `--rs-color-secondary` | `#FFFFFF` | Text/icons on primary fills; card surfaces |
| Primary muted | `--rs-color-primary-muted` | `#1F2937` | Hover depth, dark borders |
| Charcoal | `--rs-color-charcoal` | `#374151` | Secondary badges, “upcoming / confirmed” status |
| Muted text | `--rs-color-muted` | `#6B7280` | Meta, unselected nav |
| Ended / quiet | `--rs-color-ended` | `#9CA3AF` | Cancelled, inactive |

**Do not** use PatternFly default blue as brand. PF brand tokens are remapped in `tokens.css`.

---

## Surfaces

| Token | Hex | Usage |
|-------|-----|--------|
| `--rs-color-bg` | `#F9FAFB` | App canvas |
| `--rs-color-surface` | `#FFFFFF` | Cards, masthead, bottom nav |
| `--rs-color-surface-muted` | `#F3F4F6` | Table headers, inset strips |
| `--rs-color-border` | `#E5E7EB` | Hairlines, card borders |

Cards: **12px** radius, **no elevation**, 1px border.

---

## Status (semantic — do not repurpose)

| Token | Hex | Usage |
|-------|-----|--------|
| `--rs-color-urgent` | `#DC2626` | Needs action, T-72, LIVE-style urgency, destructive |
| Charcoal pills | — | Default / confirmed / draft hierarchy |
| Ended grey | `#9CA3AF` | Cancelled / postponed |

---

## Layout (mobile-first, T03-aligned)

| Pattern | Spec |
|---------|------|
| Page pad | `--rs-page-pad` = `0.75rem` (12px) — T03 density between PF sm/md |
| Section stack | `--rs-space-md` (`--pf-t--global--spacer--md`, 16px) via `.rs-stack` |
| Card padding / field gaps | `--rs-space-md` via `.rs-detail-card`, `.rs-form-stack`, Form `GridGap` |
| Control / action row gaps | `--rs-space-sm` (`--pf-t--global--spacer--sm`, 8px) |
| Micro (chips, calendar cells) | `--rs-space-xs` (`--pf-t--global--spacer--xs`, 4px) |
| Bottom clearance | `--rs-bottom-clearance` above fixed nav |
| Tap targets | Prefer ≥ `--rs-tap-min` (PF 2xl / 48px) |
| Filters | Full-width search + **horizontal chip scroller**; selected chip = black fill / white label |
| List vs grid | Cards (compact tiles) or schedule table; list-row density for table |

**Spacing rule:** Use `--rs-space-*` / PatternFly `--pf-t--global--spacer--*` for layout gaps. Do not hard-code `8px` / `12px` / `16px` in new CSS. FormGroups outside a PatternFly `Form` belong in `.rs-form-stack` or `.rs-detail-card` so fields never sit flush against buttons.

---

## Implementation rules

1. Prefer `--rs-color-*` / `--rs-space-*` / layout tokens — avoid raw hex or raw px spacing outside `tokens.css`.
2. PatternFly components are allowed for structure; **skin** them with tokens (already overridden for brand). Prefer PF spacer tokens (`--pf-t--global--spacer--*`) for gaps.
3. Body text on white = pure black (`--rs-color-ink`).
4. Primary actions = black fill / white label; secondary = outlined black.
5. Test contrast on light surfaces (dark mode optional later).

---

## Component conventions

### Status / level chips
Use `.rs-label-row` + `.rs-pill` (not PatternFly `Label`, not full-width).
Variants: `.rs-pill--ink` (selected/primary), `.rs-pill--urgent` (needs action), `.rs-pill--quiet` (ended).

### Primary button
Black background, white text (PF `primary` remapped).

### Filter chips
`.rs-filter-chip` / `.rs-filter-chip--selected` — pill, horizontal scroll.

### Sign-in
Full-bleed auth composition (`.rs-signin`): brand hero, Google/Apple, optional **Try demo** → `/demo` when `VITE_DEMO_MODE` is enabled. No masthead on the login page. Showcase uses a Demo badge and optional Demo \| Live control when a Firebase session exists.

### Masthead clock
Under the brand: org-local **date · time** (`.rs-brand-date`). Quiet muted text; do not compete with the title.

### Due / count badges
`.rs-nav-badge` — urgent red pill for Appointments pending-accept and Reports due counts on referee tabs. Keep tiny; do not use for decorative counts.

### Match list cards
`.rs-list-row` — date stack (month + ordinal day), ink gender/level chips, team names with scores (or `–`). Trailing crew / raise-hand columns use `split="action"` or `split="crew"`.

### Dropdowns / filters
Use PatternFly **`FormSelect` + `FormSelectOption`** (not raw `<select class="pf-v6-c-form-control">`). The `pf-v6-c-form-control` class belongs on the PF wrapper so padding uses **control spacer tokens** (`--pf-t--global--spacer--control--*`). Do not override select padding for “centering.”

### Empty states
Icon or quiet title + one sentence + optional single CTA (e.g. Release drafts).

### Detail back control
`.rs-detail__back` — full-width underline control matching Request sub-tabs; label is **← Back to {destination}** when location state provides `backNav`.

---

## Relationship to T03

| T03 (Flutter) | MatchReadyTX (PWA) |
|---------------|--------------------|
| `AppColors.primary` | `--rs-color-primary` |
| `AppColors.statusLive` | `--rs-color-urgent` |
| `Wrap` 2-column grid | `.rs-card-grid` |
| Horizontal `FilterChip` row | `.rs-filter-chips` |
| Bottom `NavigationBar` | `.rs-bottom-nav` |
| Roboto | `--rs-font-family` (Roboto + system fallbacks) |
