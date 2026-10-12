# MatchReadyTX App Theme and Material 3 Migration Guide

| Document status | Value |
| --- | --- |
| Status | App-wide design-system source of truth |
| Last updated | October 11, 2026 |
| Approved reference page | Event / Match detail |
| Page-by-page decisions | [`UX_UI_PRODUCTION_REVIEW.md`](UX_UI_PRODUCTION_REVIEW.md) |

## 1. Purpose

This document defines how MatchReadyTX should look, behave, and adapt as the
interface is migrated to Material Design 3 (M3). It is the reusable standard for
future page reviews. Page-specific workflow decisions belong in
`UX_UI_PRODUCTION_REVIEW.md`; reusable patterns discovered during those reviews
must be promoted here.

MatchReadyTX is a touch-first scheduling and officiating product used on phones
in the field and on larger screens for administrative work. The product keeps
its high-contrast monochrome identity while applying M3 semantics, accessible
interaction, and adaptive layout.

This is not a mandate to make every element rounded, elevated, or colorful.
The governing sequence is:

> user task → role and permissions → information hierarchy → adaptive layout →
> semantic tokens → component choice → states → accessibility → visual polish

## 2. Authority and implementation sources

When guidance conflicts, use this order:

1. User safety, data integrity, permissions, and accessibility.
2. This document for app-wide product behavior and visual rules.
3. The current page specification in `UX_UI_PRODUCTION_REVIEW.md`.
4. Current Material 3 guidance and native web conventions.
5. Existing implementation, which may still be transitional.

| Source | Responsibility |
| --- | --- |
| [`src/styles/tokens.css`](../src/styles/tokens.css) | CSS palette, semantic roles, spacing, shape, typography, and legacy compatibility tokens |
| [`COLOR_REFERENCE.md`](COLOR_REFERENCE.md) | Resolved light-to-dark color mapping for CSS and MUI roles |
| [`src/theme/paletteLiterals.ts`](../src/theme/paletteLiterals.ts) | Temporary TypeScript palette bridge for MUI |
| [`src/theme/m3Theme.ts`](../src/theme/m3Theme.ts) | MUI palette and component defaults |
| [`src/theme/MuiThemeProvider.tsx`](../src/theme/MuiThemeProvider.tsx) | Synchronizes MUI with the app color scheme |
| [`src/app/theme.ts`](../src/app/theme.ts) | Persists and applies light/dark and high-contrast theme state |
| [`src/styles/shell/`](../src/styles/shell/) | Shared app shell and reusable page primitives |
| Feature `*.css` | Feature-specific layout and presentation |
| [`src/lib/pf-mui/`](../src/lib/pf-mui/) | Transitional compatibility wrappers backed by MUI |

The app uses MUI v6. Existing `pf-v6-*` class names are compatibility hooks,
not evidence that PatternFly remains the design system. New documentation and
new components should use M3 terminology. Do not add a PatternFly dependency or
new PatternFly-only behavior during migration.

## 3. Product design principles

### 3.1 Read first, edit deliberately

Detail pages open in view mode, including for administrators. View mode should
answer the page's main questions without presenting every possible input.

Use an explicit edit mode when multiple fields describe one record:

- enter through a clearly named action such as **Edit details**;
- initialize a draft from persisted data;
- commit the draft with **Save changes**;
- leave without mutation through **Cancel**;
- warn before discarding dirty changes;
- preserve the draft after validation or network failure;
- disable duplicate submission and show a saving state;
- return focus or scroll to a predictable location when the mode changes.

Do not mix silent blur-saving, immediate persistence, and transactional saving
inside the same form. Immediate controls such as a true independent switch may
save immediately, but that behavior must be clear and should not have a
redundant Save button.

### 3.2 Show only actions the active role can perform here

Visibility is part of permission design. A role must not see controls that imply
another persona's authority, even if a backend check would reject the action.

- Scheduler actions affect the event, crew, or operational status.
- Official actions affect that official's appointment or required reports.
- Team administrator actions affect that administrator's team.
- Read-only users receive information and relevant utilities, not disabled
  administrative controls.

A disabled control is appropriate when the action belongs to the current role
but is temporarily unavailable. Hide it when it does not belong to the role or
page at all. Explain important disabled states in nearby text or an accessible
description.

### 3.3 Separate navigation, actions, status, and content

- Navigation changes location.
- Actions change the current record or start a task.
- Status communicates state.
- Content communicates facts.

Do not make status chips look like generic buttons. Do not make actions resemble
navigation solely to fit a composition. Keep destructive commands separate from
routine navigation and primary actions.

### 3.4 Use progressive disclosure

Keep the default page calm. Place high-frequency reading and required actions
first. Put editing, administration, history, and destructive operations behind
explicit modes, menus, dialogs, sheets, or disclosure sections.

Each action should have one obvious home. Do not repeat the same report or CTA
at the top of a card, within a section, and again in a fixed bar.

### 3.5 Wider space must improve the experience

Do not center an unchanged phone layout inside a desktop canvas. Wider layouts
may improve comparison, keep supporting information visible, or arrange related
controls side by side, while retaining a bounded readable width.

## 4. Page anatomy

Use this order for a typical authenticated detail page when applicable:

1. App top bar and global navigation.
2. Contextual back/up bar naming the destination.
3. Page identity: title and concise state.
4. Attention-required or blocking condition.
5. Primary details.
6. People, assignments, or related working content.
7. Secondary information and history.
8. Role-specific action surface.

Not every page needs every region. Remove empty regions rather than preserving
blank containers.

### Contextual back/up bar

Use the shell-level `.rs-contextual-bar`, not an inline sticky button inside the
scrolling page. It must:

- sit directly beneath the top app bar without a gap;
- remain outside the page's scroll content so content cannot appear behind it;
- use the inverse-surface color pair in both light and dark themes;
- make the full bar width clickable within the content bound;
- include page padding before the arrow;
- name the destination, for example **← Back to Schedule**;
- meet the 48px minimum target and expose correct button/link semantics.

Use browser-history back only when it reliably returns to the named context;
otherwise route explicitly and preserve relevant list/filter state.

Do not use the contextual back bar for movement between steps inside one form.
An in-flow previous-step control uses `.rs-report-step-back`, names the preceding
section, and appears only when a preceding step exists. Page exit remains in the
shell bar so navigation and form progression are not presented as the same act.

## 5. Adaptive layout

Design for available width, not a device label.

| Width | App behavior |
| --- | --- |
| Compact: below 600px | Bottom navigation; single content column; bottom-reachable page actions; modal bottom sheets for supplemental action sets |
| Medium: 600–839px | Navigation rail; bounded content; layouts may add columns when content benefits |
| Expanded: 840px and above | Persistent rail; bounded readable content; supporting panes or denser aligned rows only when useful |

The current shell uses `--rs-page-pad`, a maximum primary content width of
approximately 720px on detail surfaces, `--rs-bottom-nav-height`, and safe-area
environment variables. These are implementation constraints, not permission to
hardcode those values in page components.

Required responsive checks:

- 320px and 360px compact widths;
- immediately below, at, and above 600px;
- immediately below, at, and above 840px when page behavior changes there;
- narrow landscape and a wide desktop window;
- 200% text zoom or equivalent text scaling;
- long names, translated-length labels, and unbroken values;
- virtual keyboard visible;
- pointer, keyboard, and touch input;
- device safe areas.

Preserve current data, selection, edit state, and logical focus when resizing.

## 6. Spacing, alignment, and density

Use the shared 4px-based scale:

| Token | Value | Typical use |
| --- | ---: | --- |
| `--rs-space-xs` | 4px | Tight icon or metadata relationship |
| `--rs-space-sm` | 8px | Adjacent cards, compact row gaps, related controls |
| `--rs-space-md` | 16px | Default card padding and section gap |
| `--rs-space-lg` | 24px | Major groups or form sections |
| `--rs-space-xl` | 32px | Page-region separation or terminal breathing room |
| `--rs-page-pad` | 12px currently | Compact page edge padding; consume the token |

Rules:

- Related elements use the smaller spacing; unrelated groups use the larger.
- Adjacent cards have at least 8px of visible separation and never touch.
- A parent stack owns the gap between children; children must not add a second
  competing outer margin.
- Align labels, values, rows, and action columns to stable axes.
- Use spacing before adding another card, divider, or background.
- Keep visual content compact without shrinking interactive targets.
- Fixed bars must add exactly one corresponding content clearance. The shell's
  bottom-navigation clearance must not be counted twice.
- Include `env(safe-area-inset-*)` where a fixed or edge-aligned surface can
  overlap system UI.

Raw layout values are allowed only when a component has a documented,
component-specific dimension that is not represented by a token. Prefer adding
a reusable token over repeating a literal.

## 7. Color and surface roles

MatchReadyTX uses a monochrome, high-contrast brand. Semantic role, not a raw
color, chooses appearance.

The neutral foundation is intentionally absolute: the light canvas and standard
card surface are pure white (`#FFFFFF`), and their dark-theme equivalents are
pure black (`#000000`). One neutral gray serves supporting content, disabled
states, dividers, and borders in both themes. Container hierarchy uses the
surface, spacing, and borders rather than additional gray fills. Do not
introduce off-white or off-black base surfaces.

The light/dark preference is stored under `rs-theme`; `src/app/theme.ts` applies
the scheme to the document and `MuiThemeProvider` keeps MUI synchronized. The
product currently enables its high-contrast theme by default through
`HIGH_CONTRAST_ENABLED`. Forced-colors and increased-contrast system preferences
must remain supported rather than overridden.

Brand imagery must remain legible in both schemes. `BrandLogo` currently swaps
the light and dark logo assets. Any new image containing essential information
needs an explicit dark-theme treatment or a theme-neutral asset; CSS filters are
acceptable only after legibility and contrast are verified.

| Intent | CSS role |
| --- | --- |
| App canvas | `--rs-m3-surface` |
| Standard contained region | `--rs-m3-surface-container` |
| Hover or stronger contained region | `--rs-m3-surface-container-high` |
| Primary text | `--rs-m3-on-surface` |
| Secondary text | `--rs-m3-on-surface-variant` |
| High-emphasis action | `--rs-m3-primary` / `--rs-m3-on-primary` |
| Supporting/data emphasis | `--rs-color-secondary` / `--rs-color-on-secondary` |
| High-contrast contextual chrome | `--rs-m3-inverse-surface` / `--rs-m3-inverse-on-surface` |
| Subtle boundary | `--rs-m3-outline-variant` |
| Destructive/error state | `--rs-m3-error` / `--rs-m3-on-error` |

Status colors use one warning, success, and error color unchanged across both
themes. Every colored status also contains a text label, icon, or other
non-color cue. Use each status's `on-*` token for content placed directly on its
solid fill. Success uses the same accessible green in both themes. Warning uses
a small accessible tonal pair and must not be remapped to the page surface,
because that removes operational cues such as double-booking. Error obligations
retain the solid error treatment. Use spacing, outlines, and typography before
introducing a new semantic color.

Run `npm run audit:contrast` whenever theme or status colors change. It checks
the shared normal-text semantic pairs in both light and dark modes against the
4.5:1 release threshold.

Rules:

- Do not add hex, RGB/HSL, named colors, or independent gray values in feature
  CSS or page components.
- New CSS should prefer `--rs-m3-*` semantic roles. Existing `--rs-color-*`
  tokens remain supported during migration.
- Core and tonal-container literals exist in both `tokens.css` and the MUI
  TypeScript bridge. `paletteLiterals.ts` must remain synchronized until CSS
  custom properties can directly supply the MUI theme. The palette is meant to
  stay small, not meet an arbitrary numeric limit.
- Verify every pair in light and dark mode. Inversion must preserve hierarchy,
  not merely swap black and white.
- Primary color is scarce. Routine cards and metadata do not receive primary
  fill simply to create contrast.
- Use surfaces, spacing, and borders for routine hierarchy. Shadows are
  not decorative; the current high-contrast theme intentionally uses
  `--rs-shadow: none`.

## 8. Typography

Roboto with system fallbacks is the app family. Choose type by semantic job.

| App token | Semantic use |
| --- | --- |
| `--rs-font-title` | Page or prominent content title |
| `--rs-font-card-title` | Card/item title |
| `--rs-font-card-title-compact` | Dense item title |
| `--rs-font-body` | Reading and descriptive content |
| `--rs-font-meta` | Supporting metadata |
| `--rs-font-chip` | Compact status/filter label |
| `--rs-font-action` | Buttons and action rows |
| `--rs-font-nav` | Navigation and contextual bars |

Rules:

- Do not shrink important text to make a layout fit.
- Action labels use the shared action role; changing a control from a dropdown
  to a sheet must not silently change its font size.
- Uppercase is reserved for short section labels or compact metadata, never
  paragraphs or action labels.
- Preserve line height and allow wrapping. Avoid fixed-height text containers.
- Do not rely on placeholder text as a field label.
- Use weight, color role, spacing, and containment with type size; size alone
  should not carry the hierarchy.

## 9. Shape, cards, and containment

| Token | Current value | Use |
| --- | ---: | --- |
| `--rs-radius-card` | 12px | Section cards and contained content units |
| `--rs-radius-chip` | 8px | Compact controls/status containers and row actions |
| `--rs-radius-dialog` | 16px | Dialogs and top corners of modal bottom sheets |
| `--rs-radius-pill` | Fully rounded | Navigation indicators and true pill semantics only |

Use a card when the content is a meaningful contained unit. Prefer:

1. spacing for simple grouping;
2. a divider for subtle separation;
3. a surface-role change for a region;
4. a card when the unit needs a distinct boundary.

Do not wrap every section or every row in its own card. Avoid nested cards unless
each layer has a distinct semantic purpose. Components with the same role use
the same radius and containment treatment across the app.

## 10. Components and interaction patterns

### Action emphasis

| Need | Component |
| --- | --- |
| Primary action in a region | Filled button |
| Secondary alternative | Outlined button |
| Low-emphasis contextual action | Text button/link action |
| Recognizable compact action | Icon button with accessible name |
| Supplemental contextual action set on compact screens | Modal bottom sheet |
| Blocking decision or focused task | Dialog |
| Brief result of a recent action | Snackbar/status message |

Use one visually dominant filled action in an immediate action group. Destructive
actions use error semantics and are separated from routine actions. Confirm
irreversible or high-consequence actions; do not add confirmation to harmless,
easily reversible filtering or selection.

### Mobile fixed action bar

Use a page-level mobile action bar only for a high-value role-specific action or
entry to an action set. It must:

- sit immediately above the global bottom navigation;
- span the full available width;
- make the entire visible bar the tap target;
- be at least 56px high, with a minimum 48px target in all cases;
- center its icon and label together vertically and horizontally;
- use `--rs-font-action` rather than inheriting an accidental font size;
- use inverse-surface roles when visual separation from the page is needed;
- replace, not stack with, edit-mode Save/Cancel actions;
- reserve content clearance exactly once.

### Top app bar and local sticky navigation

- Keep the active persona selector in the top-right action region at every
  width. It must not drop into a separate full-width row on compact screens.
- Protect enough width for both the brand identity and persona value; truncate
  secondary chrome before obscuring either one.
- A page-local contents bar may be sticky inside the scrolling content region.
  It uses an opaque surface, remains in normal document flow, and sits at the
  scroll region's top edge so page text cannot show through or become hidden
  behind it.
- Keep the shell contextual back bar separate from page-local navigation. The
  former navigates up; the latter moves within the current document.

### Modal bottom sheet

On compact screens, use a modal bottom sheet for a supplemental action list such
as Match actions. It should be bottom anchored, bounded in height, safe-area
aware, and have full-width rows with at least 48px targets. Keep destructive
items visually separated at the end. Do not show a drag handle unless the sheet
actually supports dragging. Rely on the dialog primitive for focus trap, Escape,
backdrop dismissal, and focus return.

On wider screens the same action set may use a kebab/dropdown when that is more
space efficient. The actions, labels, permissions, and consequences must remain
the same across presentations.

### Status indicators

Statuses are compact visual labels, not oversized buttons. Use a consistent chip
height, typography, padding, and semantic color for comparable states across
teams, crew, reports, requests, and assignments.

If a status opens content, keep the compact visual chip inside a separate
minimum-48px interactive target. Provide hover, focus, pressed, and disabled
states. A noninteractive status must not receive link/button semantics.

Prefer integrating related status into its owning row instead of duplicating the
same person or object in a second status-only section. Keep exceptional orphaned
records in a clearly labeled cleanup area rather than distorting the normal
information architecture.

Attention states that govern an entire row use a full-width top banner with
centered text. Do not force short labels such as **Change Proposed**, **Waiting
on Referee Confirmation**, or **LOCKED** into a narrow stacked column. A locked
list item replaces only its top status region with **LOCKED**; retain the event
date, venue, teams, and other identifying facts below it.

An overdue report card uses the filled error-container treatment by default,
not a border-only treatment. The visible **Pending** or equivalent text remains
present so the state is not communicated by color alone.

When an error chip appears on an error-filled parent, invert the chip to the
on-error surface with error-colored text. Never place an error-colored chip on
the same error-colored card background.

### Lists and person rows

- Prefer a list with dividers over a card per row.
- Make the person's name/profile target distinct from report or assignment
  actions in the same row.
- Names may wrap; do not remove identity to save space.
- Contact email uses `mailto:` and phone uses `tel:` when available.
- Preserve a predictable reading order: role, name, supporting state/actions.
- The visible density may be compact while every interactive target remains at
  least 48px.
- When crew details support a match card from a bottom region, arrange crew
  roles horizontally and wrap only when the available width requires it. Do not
  turn four short crew values into a tall stacked footer.
- Match-card metadata uses a compact `time | location` row. Place the event
  title directly beneath that row and before the team matchup.
- Team abbreviations inherit the matchup text color; do not demote them to a
  low-contrast secondary gray.

### Forms

- Use persistent labels and helpful supporting text where uncertainty exists.
- Choose controls by data type: checkbox for independent multiple selection,
  radio/segmented control for one visible choice, switch for an immediate binary
  setting, and appropriate date/time controls for structured values.
- Put validation near the affected field and explain recovery.
- Preserve all entered data on failure.
- Keep focused fields visible when the software keyboard opens.
- Use the shared date/time field and expose exactly one picker affordance. Do
  not layer a custom calendar/clock icon over a native browser picker icon.
- On compact detail pages, transactional Save/Cancel may occupy the bottom
  action area so they remain reachable. On wider screens they may appear at the
  end of the form if the whole transaction remains clear.

### Feedback and overlays

- Use inline feedback for persistent or recoverable errors.
- Use a snackbar for brief non-blocking confirmation, with no more than one
  directly relevant action.
- Preserve page context during local loading; do not blank the whole page for a
  small operation.
- Prevent duplicate submission while busy.
- Never stack modal surfaces unless there is a compelling, tested workflow.

## 11. Accessibility requirements

Accessibility is a release requirement.

- Interactive targets are at least `--rs-tap-min` (48px) in both dimensions.
- Normal text targets at least 4.5:1 contrast; large text and meaningful
  non-text UI target at least 3:1.
- Every icon-only control has an accessible name.
- Custom controls expose a correct name, role, value/state, and keyboard model.
- Focus is visible and follows the visual/task order.
- Modal surfaces trap and restore focus; no component creates a keyboard trap.
- Status, selection, warnings, and errors are never communicated by color alone.
- Errors are associated with their fields and explain how to recover.
- Content remains usable at 200% zoom and with long text.
- Motion respects `prefers-reduced-motion`; motion is never the only explanation
  of a state change.
- Headings form a logical hierarchy and sections have accessible names.
- Fixed bars, overlays, and focused inputs account for safe areas and the IME.

Keyboard-test every interactive path. Automated checks are useful but do not
replace screen-reader, zoom, contrast, and physical-device review.

## 12. Theme and CSS architecture

### Token hierarchy

Use:

> palette literal → semantic product/M3 role → component/page rule

Do not skip directly from a feature selector to a literal color. Reuse spacing,
shape, type, and target tokens as well as color tokens.

### File placement

- Global semantic values: `src/styles/tokens.css`.
- MUI theme/component defaults: `src/theme/m3Theme.ts`.
- Shared app chrome and cross-feature primitives: `src/styles/shell/`.
- Feature-only UI: colocated `*.css`, imported by its feature layout/page.
- Reusable behavior belongs in a shared component, not copied page markup.

Split a feature stylesheet by sub-feature or selector family when it grows past
roughly 400 lines. `match-detail.css` currently exceeds this threshold and is a
migration-debt example, not a template for new pages.

### Transitional compatibility

The `src/lib/pf-mui` wrappers and `pf-v6-*` selectors allow existing pages to
move to MUI incrementally. During migration:

- use wrapper props consistently where changing the public API is unnecessary;
- do not introduce new behavior that depends on PatternFly packages;
- prefer new `rs-*` selectors and M3 role names;
- remove obsolete compatibility selectors only after all consumers migrate and
  tests confirm parity.

## 13. Page migration workflow

Review and migrate one page at a time:

1. **Define the job.** State the primary question/action for each persona.
2. **Inventory content and actions.** Mark each as navigation, utility,
   configuration, operation, status, or history.
3. **Create the role matrix.** Define visible, hidden, enabled, disabled, and
   read-only behavior for every persona and state.
4. **Design view mode first.** Remove unselected choices and controls that do not
   help users read the current state.
5. **Choose transaction boundaries.** Group fields that save together and define
   Cancel, dirty, saving, success, and failure behavior.
6. **Remove duplication.** Give every action and data point one primary home.
7. **Choose semantic components.** Select by purpose, not appearance.
8. **Define compact and wide behavior.** Include fixed actions, menus/sheets,
   navigation, content bounds, wrapping, and safe-area clearance.
9. **Apply tokens and shared primitives.** Do not solve a page-wide problem with
   one-off literals.
10. **Cover all states.** Loading, empty, error, success, disabled, selected,
    hover, focus, pressed, and permission-denied where relevant.
11. **Verify accessibility and devices.** Keyboard, screen reader, zoom, contrast,
    reduced motion, light/dark, mobile hardware, and wide desktop.
12. **Document the decision.** Record page behavior in the UX review and promote
    reusable rules into this file.

## 14. Production acceptance checklist

### Task and hierarchy

- [ ] The page's identity and primary purpose are obvious.
- [ ] View mode is calm and read-first where appropriate.
- [ ] Configuration, operations, utilities, statuses, and history are separated.
- [ ] Every action and repeated datum has one obvious home.
- [ ] Empty sections and redundant containers are removed.

### Roles and states

- [ ] Each role sees only actions appropriate to that role and screen.
- [ ] Disabled controls belong to the role and explain temporary unavailability.
- [ ] Loading, empty, error, success, disabled, selected, hover, focus, pressed,
  and dirty states are defined where applicable.
- [ ] Destructive actions are separated and appropriately confirmed.
- [ ] Validation/network errors preserve user input and offer recovery.

### Visual system

- [ ] Feature code uses semantic tokens, not raw colors.
- [ ] Spacing follows the shared scale and adjacent cards have at least 8px.
- [ ] Cards represent meaningful units and are not unnecessarily nested.
- [ ] Comparable statuses use the same compact chip treatment.
- [ ] Action typography and target sizes remain consistent across presentations.
- [ ] Light and dark themes preserve the same hierarchy.

### Adaptive and accessible behavior

- [ ] Compact, breakpoint, landscape, and wide layouts were tested.
- [ ] Fixed bars do not cover content and do not create duplicate blank scroll.
- [ ] Safe areas and keyboard/IME overlap are handled.
- [ ] All targets are at least 48px and the visible surface matches the tap area
  when the component is presented as a full-width bar or row.
- [ ] Focus order and focus visibility are correct.
- [ ] Icon-only controls have accessible names.
- [ ] State is not communicated by color alone.
- [ ] The page remains usable at 200% zoom and with long content.

### Engineering

- [ ] Shared behavior uses shared components/primitives.
- [ ] Feature CSS is colocated and remains reasonably modular.
- [ ] Production build, relevant tests, lint/static checks, and `git diff --check`
  pass.
- [ ] Physical-device behavior is checked for compact fixed and modal UI.

## 15. Match detail page analysis and reusable lessons

The Event / Match detail redesign is the first approved migration reference. It
established these app-wide decisions:

- Defaulting to view mode removed the visual weight of an always-open admin form.
- Moving title, time, venue, and classifications into **Match details** created
  one clear information source.
- A transactional Edit details mode made saving, canceling, dirty state, and
  failure behavior understandable.
- Moving scheduler commands into one adaptive Match actions entry removed
  competition with the match identity.
- A desktop kebab and compact modal bottom sheet can represent the same action
  set without changing permissions or labels.
- The compact action bar works only when the whole visible bar is interactive,
  the label keeps the action type role, and icon/text are centered as one unit.
- Putting the contextual back bar in the shell removed the header gap and
  prevented scrolling content from appearing behind it.
- Integrating report statuses into crew rows removed duplicated identities;
  report actions remain visible but disabled when relevant and not yet available.
- Compact status visuals and independent 48px hit targets reconcile information
  density with touch accessibility.
- Profile access from a person's name, plus tappable email and phone details,
  makes identity rows useful without adding more page chrome.
- Exactly one fixed-action clearance prevents both covered content and excessive
  empty scrolling below the page.

### Current readiness audit

| Category | Score | Reason |
| --- | ---: | --- |
| Task clarity | 2/2 | Match identity, details, crew, and role actions have clear homes. |
| Information hierarchy | 2/2 | Read-first grouping and progressive disclosure replace the open form. |
| Component semantics | 2/2 | Menus, sheet, dialog, buttons, links, and statuses match their behavior. |
| Token discipline | 1/2 | Semantic roles are used, but transitional literals and legacy selectors remain. |
| Adaptive behavior | 2/2 | Compact action bar/sheet and wider menu preserve the same workflow. |
| States and feedback | 2/2 | Edit, dirty, saving, error, disabled report, and destructive flows are covered. |
| Accessibility | 1/2 | Targets, labels, focus-capable primitives, and non-color statuses are present; final screen-reader/zoom/device certification remains manual. |
| Expressive restraint | 2/2 | Inverse bars clarify key actions without making routine content visually loud. |

Total: **14/16**. The page is an approved pattern reference, with manual
accessibility certification and theme consolidation remaining app-wide work.

## 16. Explicit anti-patterns

Do not carry these patterns into migrated pages:

- always-editable detail screens;
- save-on-blur mixed with explicit Save in one transaction;
- controls from another persona shown in the current role;
- multiple copies of the same CTA;
- status chips used as generic buttons or navigation;
- a small button floating inside a bar that visually promises a full-width tap;
- inline sticky back controls competing with the shell header;
- cards touching, repeated nested cards, or every list item becoming a card;
- arbitrary radii, font sizes, spacing, colors, or shadows;
- compact text achieved by shrinking targets or hiding names;
- mobile layouts stretched unchanged across desktop;
- disabled controls with no explanation;
- destructive actions mixed with routine actions;
- fake bottom-sheet drag handles;
- duplicate bottom clearance that creates empty scroll space;
- color-only state communication;
- visual approval without keyboard, zoom, dark-mode, and physical-device checks.

## 17. Shared component boundaries

Use shared components by information model and behavior, not by visual
resemblance:

- `MatchSummaryCard` is the canonical schedule-feed card for League, Referee,
  Team Admin, and Scheduler views. Personas provide status text, permissions,
  supporting statuses, crew visibility, and actions; they must not recreate the
  date tile, match hierarchy, state rail, or crew regions. In scheduler coverage
  views, crew occupies the top supporting region and raise-hand review occupies
  the bottom supporting region. Confirmed crew checks replace a redundant
  `Crew confirmed` chip.
- `MatchListRow` is the compact match reference for report headers, dense
  administrative queues, and embedded detail summaries. It is not a schedule
  feed card.
- `MatchCrewTrailing` and `CrewColumnContent` own crew labels, assignment
  highlighting, redaction, open-slot actions, and profile links.
- `MatchFilterSummary` owns the visible Date + Filters trigger row.
  `FilterDialog`, `RsFilterSelect`, and `RsDateField` own the corresponding
  filter controls.
- The shared `Modal` wrapper owns dialog structure and focus behavior. Feature
  code supplies content and actions rather than styling a new modal shell.
- `RsDateField` / `IconDateInput` own date-picker icon and native-calendar
  behavior. New date inputs must not add a second calendar icon.

Run `npm run audit:components` with the existing CSS and contrast audits. The
component audit prevents schedule feeds and shared filter bars from drifting
back to persona-specific markup.
