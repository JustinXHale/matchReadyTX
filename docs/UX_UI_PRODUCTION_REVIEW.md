# MatchReadyTX UX/UI Production Review

Status: Working product-design specification  
Review method: page-by-page  
Current page: Event / Match detail  
Last updated: October 10, 2026

## Purpose

This document is the shared UX/UI review for taking MatchReadyTX from a useful internal tool to a production product that can be sold to other organizations.

The review focuses on:

- what a user is trying to accomplish on each page;
- what information should be visible by default;
- what should appear only when it is relevant;
- what is read-only, directly actionable, or editable;
- how roles and permissions change the experience;
- how loading, empty, error, success, and exceptional states behave;
- responsive behavior, accessibility, and production acceptance criteria;
- concrete implementation guidance for the current application.

This is an interaction specification, not just a visual restyling exercise. A quieter production interface comes primarily from better hierarchy, progressive disclosure, and clearer modes—not from reducing font sizes or changing colors alone.

## Review index

| Area | Status | Document section |
| --- | --- | --- |
| Event / Match detail | Initial redesign implemented — pending visual/user review | [Event / Match detail](#event--match-detail-page) |
| Remaining pages | Not yet reviewed | Add one page at a time |

---

# Event / Match detail page

## 1. Executive recommendation

The current event page behaves like an always-open administrative form. That is efficient for a single expert who already understands every control, but it creates high visual and cognitive load for a product sold to new organizations.

The recommended model is:

1. **View mode is the default for everyone**, including assigners.
2. **Edit details is an explicit, transactional mode** available only to users with permission.
3. **Operational actions remain available outside edit mode** when they are part of running the match rather than changing its underlying record.
4. **Crew management is its own focused workflow**, not part of the general event-details form.
5. **Urgent, required actions appear near the top only when applicable**; historical and administrative material is progressively disclosed.

This avoids one giant global “editable/not editable” switch. The page instead distinguishes between three types of interaction:

| Interaction type | Examples | Recommended behavior |
| --- | --- | --- |
| Record configuration | Event title, gender, tier, event type, format, side, fees, flight, lodging, notes, schedule URL | Enter **Edit details**, change a draft, then Save or Cancel |
| Match operations | Assign an official, confirm details, respond to a schedule proposal, resend an assignment, alert for coverage | Available from the relevant section or action menu, with confirmation where consequential |
| Utility action | Open maps, add to calendar, email contacts, view schedule/report | Available in view mode; never requires edit mode |

### Product principle

> The default event page should answer “What match is this, when and where is it, what needs attention, and who is involved?” Editing the database should be a deliberate secondary task.

### Implementation status

The initial production pass is implemented in the working tree on the `MaterialDesignMigration` branch:

- assigners now land in a read-first view;
- event name, kickoff, venue, and classification live together in Match Details;
- event metadata uses an explicit Edit details draft with Save and Cancel;
- unsaved changes are protected and save failures preserve the draft;
- event-detail fields persist through one Firestore write;
- crew assignment controls are hidden until Manage crew is activated;
- routine crew actions use descriptive labels instead of an ambiguous `×`;
- Edit details is grouped into the scheduler action menu;
- on compact windows, the entire solid bottom action bar opens scheduler
  actions in a modal bottom sheet; the desktop kebab retains a compact menu;
- bottom action labels use the shared action-label type role, and the page adds
  only local action-bar clearance instead of duplicating shell/nav clearance;
- played forfeit, postpone, and forfeit are grouped under Change match status;
- compliance actions use the shorter Lock match / Unlock match labels;
- match-status choices open in a focused dialog instead of a nested dropdown;
- back navigation is rendered by the app shell as a non-scrolling contextual
  subheader and names its destination;
- the Back and compact Match actions bars use inverse-surface theme roles so
  they remain visually distinct in light and dark modes;
- on compact screens, edit-mode Save and Cancel remain visible in the bottom
  action area and replace Match actions until editing ends;
- appointment response and withdrawal actions are restricted to the Official view;
- scheduler mode no longer inherits team-administrator confirmation messaging;
- assigned crew rows open the shared official profile drawer, with compact
  credentials and tappable email/phone links;
- report-status pills act as the primary report links when a report is
  actionable, while N/A states remain noninteractive;
- the current official's Match report and Card report actions live together in
  the Crew & reports section above the crew report rows instead of competing
  with the match title; applicable actions remain visible but disabled before
  their reporting window opens, and paired actions divide the available row
  equally at compact and desktop widths;
- the page does not duplicate report actions in a fixed bottom CTA; Crew &
  reports is the single report-action location on match detail;
- routine report rows contain only status/navigation; scheduler Reset and
  Delete controls live in a Report actions overflow menu on the opened report;
- after kickoff, scheduler report statuses are integrated into each crew row;
  the official name remains a separate profile target and the duplicated
  Reports card appears only for exceptional orphan-record cleanup;
- integrated statuses appear when the report window opens 90 minutes after
  kickoff, and compact visual pills retain independent 48dp link targets;
- team confirmation and crew-report statuses share the same compact visual
  treatment while interactive statuses retain a separate 48dp touch target;
- detail-card spacing follows the shared 4dp Material 3 spacing scale;
- adjacent detail cards use an explicit 8dp separation;
- entering Edit details returns the viewport to the top of the match;
- the official quick look uses three compact identity lines: name/location,
  contact methods, and level/starting year;
- the demo data includes a past match with submitted MO, AR, and CMO reports
  so every report state can be reviewed from the match page;
- responsive header/editor layouts and larger interactive targets are included.

The broader proposal, confirmation, report, and historical workflows remain functionally intact and can be refined in subsequent page-review passes.

## 2. Evidence from the current implementation

The implemented page is `src/features/matches/MatchDetailPage.tsx`, supported by `MatchDivisionPickers.tsx`, `MatchAssignerMenu.tsx`, `MatchCrewReportStatusPanel.tsx`, `MatchForfeitModal.tsx`, and shared/detail CSS.

For an assigner, the current page exposes the following at once:

- editable event title;
- five classification selector groups;
- match status and crew-status labels;
- schedule-change workflow messages and actions;
- date, time, and venue;
- per-role fees;
- flight and lodging choices;
- notes;
- tournament schedule URL;
- team contacts and team confirmation controls;
- every crew assignment, removal, resend, and role-add control;
- report status and report administration;
- assignment history and raise-hand history;
- match-state commands in the overflow menu;
- role-specific sticky actions and several modal workflows.

Many current changes persist immediately or on blur. As a result, a user can modify production data simply by interacting with what visually resembles a summary page. Different persistence rules are also mixed together:

- division choices save immediately;
- flight and lodging save immediately;
- title, fee, and schedule URL save on blur;
- notes update on each change;
- proposals and destructive state changes use explicit dialogs.

That inconsistency makes it hard to know whether a change is a draft, already saved, or reversible.

## 3. Primary users and jobs

### Assigner / scheduler

Primary jobs:

- identify the match quickly;
- see schedule, location, status, confirmations, and coverage;
- address exceptions and incomplete assignments;
- contact teams or crew;
- review reports after the match;
- occasionally correct event metadata or economics.

The assigner is the only role that needs full record editing, but even the assigner reads the page far more often than they edit every property.

### Official

Primary jobs:

- verify the correct appointment;
- see kickoff, venue, role, crew, and important notes;
- confirm, decline, or reconfirm an appointment;
- add the match to a calendar or open directions;
- contact the relevant people;
- submit or view applicable reports;
- raise a hand for an open match when eligible.

### Team administrator

Primary jobs:

- verify kickoff and venue;
- confirm match details;
- propose or respond to a schedule change;
- see the appropriate amount of crew information;
- contact stakeholders;
- read event instructions.

### Read-only or restricted viewer

Primary job:

- understand the match without being shown misleading or unusable controls.

## 4. Core problems in the current page

### P0 — Editing is the default visual state

The assigner view begins with a large text field and five rows of selectable pills. The selected values are important, but the unselected alternatives are not. Showing every possible alternative dramatically increases visual weight.

**Production correction:** render the selected classification as a concise summary in view mode. Show the full inputs only in Edit details.

### P0 — Changes use inconsistent commit behavior

Some values save immediately, some save on blur, and some open a confirmation flow. Blur-saving is especially easy to miss and offers no clear review point.

**Production correction:** edit event metadata as one draft with explicit Save and Cancel. Show a saving state, success confirmation, recoverable error, and unsaved-change protection.

### P0 — Configuration, operations, and utilities compete for attention

Changing a tier, opening directions, confirming a team, assigning crew, and canceling a match are fundamentally different actions, but the current page gives many of them similar visual prominence.

**Production correction:** separate the information architecture into overview, attention-required workflow, participants, and secondary administration.

### P1 — The header does not deliver the most useful scan

The team matchup is clear, but the page spends substantial vertical space on setup controls before the user reaches when and where. On a match-detail page, date, time, location, and state are primary identification data.

**Production correction:** place the compact event summary directly under the matchup, with date/time and location visible without scrolling on typical compact and medium windows.

### P1 — Too many pill-shaped elements do different jobs

The UI uses visually similar pills for selected options, statuses, warnings, roles, and interactive toggles. Users must infer behavior from context.

**Production correction:**

- use plain text or compact badges for passive metadata;
- use status badges for state;
- use segmented/radio controls only while editing;
- use buttons for actions;
- do not make static labels look tappable.

### P1 — Low-frequency administration lengthens the primary path

Report administration, assignment history, raise-hand history, schedule-link administration, and match-state commands are valuable but not part of most visits.

**Production correction:** collapse or move administrative history below the active match content; use section-level actions and progressive disclosure.

### P1 — Affordances depend on expert knowledge

Examples include tapping status pills to toggle confirmation, tapping a crew row to assign or contact depending on role, an “×” that can clear an official or remove a role block, and separate meanings for Email versus Resend.

**Production correction:** make the action label explicit and stable. The same row should not silently change semantic purpose between roles without a visible cue.

### P1 — The back control is visually oversized at wide widths

The sticky back row stretches across the content area and becomes a large empty outlined region in the supplied wide screenshot.

**Production correction:** retain the requested full-width back/navigation bar directly below the application header, but reduce its visual weight to a single divider and a compact destination-aware back action. Avoid rendering the entire strip as a large outlined button.

### P1 — Several custom targets are smaller than production touch guidance

The current CSS includes 32px edit targets and a 40px overflow target. These can be difficult to use on touch devices.

**Production correction:** provide at least a 48 by 48 CSS-pixel touch area for Android-oriented/touch surfaces, even when the visible icon is smaller.

## 5. Proposed information architecture

The default page should use this order:

1. **Page header**
2. **Required action**, only when one exists
3. **Match Details**
4. **Teams**
5. **Crew**
6. **Reports**, when applicable
7. **Activity and history**, collapsed by default
8. **Role-specific bottom action area**, only when a primary action is pending

### 5.1 Page header

Contents:

- contextual back navigation;
- home team versus away team;
- one primary match-status badge;
- compact classification summary, for example `Women · Tier 3 · League · XVs`;
- overflow `More actions` menu containing Edit details and exceptional commands;
- role-appropriate report action only when it is currently useful.

Avoid showing all crew-state badges in the header. Crew coverage belongs in the Crew section or in one summarized exception such as `2 roles open`.

Suggested hierarchy:

```text
← Schedule                                                  More

UNT
vs Louisiana State University (LSU)             Official
```

On compact screens, actions reduce to one visible action plus overflow. On expanded screens, the header may share a row with a narrow supporting summary, but content width must remain bounded.

### 5.2 Required-action region

This region appears only when the signed-in user has something to do now. It is not a permanent card.

Examples:

- official must confirm, decline, or reconfirm;
- team must confirm match facts;
- team must accept or deny a proposed change;
- assigner must review a schedule change;
- compliance hold blocks normal actions;
- crew coverage is incomplete and requires assigner attention;
- a submission failed and requires retry.

Rules:

- show the highest-priority action first;
- explain why it is required in one or two sentences;
- offer one high-emphasis primary action;
- use a secondary or text action for the alternative;
- do not duplicate the same action at the top and bottom unless the page is long and the sticky bottom action materially helps completion;
- after completion, remove or transform the region rather than leaving a stale success panel.

Priority order:

1. compliance or access block;
2. schedule change/reconfirmation;
3. direct user confirmation or decline;
4. assignment/coverage exception;
5. informational success or acknowledgement.

### 5.3 Match Details

Use one calm section rather than a form-like card. Recommended rows:

| Label | View-mode content | Utility action |
| --- | --- | --- |
| Event | Event or tournament name, when one exists | None |
| When | Localized date, time, and timezone when ambiguity exists | Add to calendar for eligible users |
| Where | Venue name plus formatted address, or `Venue not set` | Directions when a map target exists |
| Classification | Gender, tier, event type, format, side | None |
| Compensation | Role fee summary, only for permitted roles | None |
| Travel | `Flight provided`, `Lodging provided`, both, or omitted when neither is relevant | None |
| Notes | Human-readable instructions | Expand only when lengthy |
| Schedule | Named external tournament schedule | Open link |

Do not display `Disabled` as a prominent choice in view mode. Prefer natural-language summaries:

- `Flight and lodging not provided`
- `Lodging provided`
- omit the row if travel is outside this match type or organization workflow.

When no event title exists, do not show an empty labeled field. When no notes exist, assigners may see a quiet `No additional notes`; other roles should generally see no Notes row.

### 5.4 Teams

Default content:

- Home and Away labels;
- full team display names and abbreviations;
- confirmation state using text plus icon/status, not color alone;
- contact action where the viewer is permitted to see contact information;
- one section action for `Email teams` when recipients exist.

Interaction changes:

- do not make a status badge itself the hidden toggle;
- team administrators should receive a visible `Confirm details` action in their required-action region;
- permitted users update confirmation by tapping the labeled confirmation status; the same control toggles the state;
- selecting a team row may open contact details only if it is styled and announced as a contact action;
- do not place instructions such as “Tap a status chip…” in the permanent content once controls are self-explanatory.

### 5.5 Crew

Default content:

- required roles in consistent order;
- assigned official name or `Open`;
- assignment/confirmation status;
- concise coverage summary in the section heading, for example `3 of 4 filled`;
- role-appropriate contact access;
- `Manage crew` for assigners;
- `Email crew` only when at least one valid recipient exists.

Recommended assigner workflow:

1. Select `Manage crew`.
2. Enter a focused inline management state or supporting panel.
3. Each role row exposes explicit `Assign`, `Replace`, `Clear`, and overflow actions as applicable.
4. `Add role` is presented as an action, not a permanently empty select field.
5. Selecting an official shows availability, conflicts, requests, and appointment context.
6. Assignment changes provide in-context save progress and completion feedback.
7. Leaving management returns to the concise crew summary.

`Resend assignment email` belongs in a row overflow menu or assignment detail, not as a permanent peer of the official’s name. `Contact` is a distinct action and must not be confused with resend.

Destructive clarity:

- replace the ambiguous `×` with a named menu action;
- distinguish `Clear official; keep role open` from `Remove role from match`;
- require confirmation when removing an occupied assignment or a configured role;
- explain downstream consequences such as notifications or coverage state.

### 5.6 Reports

Before kickoff, show nothing or a quiet one-line availability note only when the viewer intentionally opens Reports.

After kickoff:

- show a concise completion summary;
- list only reports relevant to the current role by default;
- assigners may expand `Report administration` to view reset/delete controls;
- reset and delete remain named, confirmed actions;
- errors remain inline with a recovery action;
- report completion should not compete visually with unresolved pre-match operations.

### 5.7 Activity and history

Combine assignment history and raise-hand history under a single collapsed `Activity` section with optional filters if volume grows.

The summary should show whether activity exists, for example `Activity · 8`. Empty history should not occupy a full card.

## 6. Explicit modes

### 6.1 Default view mode

Entry:

- every navigation into the event page;
- returning from a child flow;
- successful save or cancel from Edit details.

Behavior:

- renders values as text, links, statuses, and concise summaries;
- keeps utilities and required role actions available;
- contains no generic editable text fields or selector banks;
- makes permissions visible through available actions rather than disabled clutter;
- preserves scroll position when returning from a modal or supporting panel.

### 6.2 Edit details mode

Entry:

- assigner selects `Edit details` in the header.

Scope:

- event title;
- gender;
- tier;
- event type;
- format;
- optional side;
- role fees or fee overrides;
- flight provided;
- lodging provided;
- additional information;
- tournament schedule link when relevant.

Not in scope:

- team confirmation;
- crew assignments;
- schedule-change proposal review;
- match status transitions;
- report administration;
- contact and email utilities.

Behavior:

- copy current saved data into a local draft at entry;
- use persistent labels and appropriate form controls;
- use radio/segmented selection for short, mutually exclusive choices;
- use switches for immediate independent settings only; because this mode is transactional, checkboxes or segmented choices may better communicate that travel selections are part of the unsaved draft;
- make dependent logic explicit, such as Tier applying only to League;
- preserve draft values if validation fails;
- do not write to the store/server until Save;
- show a fixed or sticky action area with `Cancel` and `Save changes`;
- disable Save only when there are no changes or the draft is invalid;
- while saving, disable duplicate submission and label the action `Saving…`;
- on success, return to view mode and announce `Event details updated`;
- on failure, stay in edit mode, retain the draft, show the specific error, and offer Retry;
- if the user navigates away with unsaved changes, confirm `Discard unsaved changes?`;
- if remote data changes during editing, do not silently overwrite either version; warn the user and provide a reload/review path.

Recommended layout:

- compact/medium: full-width editing surface in normal document flow;
- expanded: bounded main form with a sticky summary or action pane if useful;
- do not place a large form in a small modal;
- avoid presenting five full-width rows of pills when a compact accessible select is clearer at narrow widths.

### 6.3 Crew management mode

Entry:

- assigner selects `Manage crew`.

Behavior:

- emphasize role coverage and conflicts;
- allow one assignment operation at a time;
- use a bottom sheet on compact windows or supporting side pane on wider windows for the official picker;
- keep match date, time, and role visible while choosing;
- display save, email, and error feedback close to the affected assignment;
- offer an explicit Done action that returns to the summary.

Crew changes may remain immediate operations because they often trigger notifications and workflow state. Each immediate operation must visibly report `Saving`, `Assigned`, `Cleared`, or `Failed—retry`.

### 6.4 Exceptional action dialogs

Use confirmation dialogs for consequential state transitions:

- cancel match;
- postpone match;
- reactivate match;
- apply or deny a schedule proposal when consequences require explanation;
- add/remove compliance hold;
- record or clear a forfeit;
- remove an occupied crew assignment or configured role;
- reset/delete a submitted report.

Dialog rules:

- title names the consequence;
- body states what changes and who is affected;
- destructive action uses a destructive style and specific label;
- safe exit uses `Cancel` or `Keep as is` consistently;
- focus enters at the title/first safe control, stays inside the dialog, and returns to the trigger;
- Escape/back closes only when dismissing cannot lose committed work;
- never use browser `alert()` or `confirm()` in the final production experience.

## 7. Detailed interaction specification

### Navigation and page lifecycle

| Trigger | Result | Feedback/state preservation |
| --- | --- | --- |
| Back | Return to the originating list/context | Preserve list filters and scroll position |
| Browser back | Same semantic result as in-app Back | Must not reopen a completed dialog |
| Refresh/deep link | Load the event directly | Show skeleton, then content/not-found/permission error |
| Event removed or inaccessible | Replace content with a clear unavailable state | Provide `Back to schedule` |
| Role lens changes | Recalculate available actions | Preserve page identity and safe view state; exit unauthorized edit state |

Back label should identify the destination where possible (`Schedule`, `Requests`, or `Reports`) rather than the generic `Back`.

### Header actions

| Action | Visibility | Result |
| --- | --- | --- |
| Edit details | Assigner with edit permission | Enter transactional edit mode |
| More actions | Assigner; or any role with at least one relevant secondary action | Open grouped action menu |
| View/file report | Role and match state dependent | Navigate to applicable report flow |
| Alert officials | Assigner when coverage is incomplete | Confirm and send; show sent/error state |

Overflow grouping:

1. communication/coverage;
2. match-state actions;
3. compliance actions;
4. forfeit/result actions;
5. destructive `Cancel match`, visually separated last.

Hide unavailable actions rather than disabling an entire menu of irrelevant commands. A disabled action is appropriate only when the reason is useful and can be explained.

### View-mode utility actions

| Action | Preconditions | Result | Failure behavior |
| --- | --- | --- | --- |
| Directions | Valid location/map target | Open maps in a new context | If no target, show location as text only |
| Add to calendar | Valid kickoff and eligible role | Download/open calendar event | Inline/snackbar error with Retry if generation fails |
| View schedule | Valid external schedule URL | Open safely in new context | Do not render action for invalid/missing URL |
| Contact person/team | Permission plus contact target | Open contact detail sheet/dialog | Show `No contact information listed` rather than dead links |
| Email teams/crew | At least one valid email | Choose scope, then open email client | Explain if device has no configured handler; keep recipient list available to copy |

### Schedule-change proposal

Use a single comparison component with Current and Proposed values. Highlight changed fields semantically and include text labels; do not rely on background color.

States:

| State | Primary viewer experience |
| --- | --- |
| No proposal | No proposal component shown |
| Proposed by this team | Waiting status plus Withdraw if supported |
| Awaiting other team | Other team receives Accept and Deny |
| Accepted, scheduler review required | Assigner receives Apply/Acknowledge based on actual business meaning |
| Applied | Brief success history; current values become canonical |
| Denied/dismissed | Concise result with reason, then move to Activity after acknowledgement |
| Save/sync failure | Proposal remains unresolved; show retry and do not claim it was applied |

Terminology needs product clarification: current copy distinguishes Apply, Deny, and Acknowledge in ways that depend on an external Sheet workflow. Before selling to other organizations, labels should describe product outcomes without assuming a spreadsheet. Suggested neutral terms are `Apply to match`, `Reject proposal`, and `Mark reviewed`. Organization-specific sync status can appear as secondary technical feedback.

### Confirmation workflow

Confirmation is a task, not a passive editable status.

- When the current user must confirm, show `Confirm details` as the primary action.
- Provide the exact facts being confirmed close to the action.
- After confirmation, announce success and change the status to `Confirmed`.
- Clearing someone else’s confirmation is an assigner override and belongs in a named menu action.
- A changed schedule invalidates affected confirmations and explains why reconfirmation is needed.
- Compliance hold disables the task and explains the recovery owner/action.

### Save and feedback model

| Event | Recommended feedback |
| --- | --- |
| Edit opened | No toast; mode and Save/Cancel controls make state clear |
| Save started | Button busy state plus `Saving…` |
| Save succeeded | Return to view mode; non-blocking `Event details updated` status/snackbar |
| Save failed | Inline error summary, field-level errors if applicable, Retry; keep draft |
| Immediate operational action started | Busy state on the initiating row/action |
| Immediate operational action succeeded | Row update plus polite live-region announcement |
| Immediate operational action failed | Inline row error and Retry; revert optimistic state if needed |
| Destructive action succeeded | Updated page state plus concise confirmation |

Do not claim “saved locally” while a server write failed in the commercial experience. Either queue the write with an explicit offline/syncing state or treat the operation as failed and preserve a retryable draft.

## 8. Role and permission matrix

Exact authorization must be enforced server-side; this table defines the UI exposure.

| Capability | Assigner | Official | Team admin | Restricted viewer |
| --- | :---: | :---: | :---: | :---: |
| View core event facts | Yes | Yes | Yes | Yes, if event is visible |
| Edit record metadata | Yes | No | No | No |
| View fees | Yes | Only if product policy explicitly allows | No | No |
| Manage crew | Yes | No | No | No |
| View crew names | Yes | Yes where policy allows | After visibility condition | Policy dependent |
| Contact teams/crew | Yes | Relevant contacts only | Relevant contacts only | No |
| Confirm own appointment | No | Yes | No | No |
| Confirm own team facts | Override only | No | Yes | No |
| Propose schedule change | Review/apply | No | Yes | No |
| Respond to proposal | Review/apply | Reconfirm if affected | Yes for other team | No |
| Raise hand | No | Eligible open matches | No | No |
| Manage reports | Yes | Own reports only | No | No |
| Change match state/compliance/forfeit | Yes | No | No | No |

Avoid rendering unauthorized controls as disabled unless seeing the capability has an intentional educational purpose. Otherwise, remove them from the interaction tree.

## 9. Component map

The application currently uses PatternFly components, with a project-level Material 3-style theme. The production implementation should preserve library accessibility while applying the following semantic component choices.

| Need | Component behavior |
| --- | --- |
| Page chrome | Top app bar / compact page header with back navigation |
| Primary status | Status badge with text and icon where helpful |
| Passive classification | Plain inline metadata or compact non-interactive badges |
| Edit entry | Medium-emphasis outlined/tonal button labeled `Edit details` |
| Short exclusive choice | Segmented button or radio group in edit mode |
| Optional multi-choice | Checkbox group in edit mode |
| Text/URL/numeric input | Labeled text field with helper/error text |
| Utility action | Text button, icon button with accessible name, or descriptive link |
| Required task | Tonal/outlined alert region with one filled primary action |
| More actions | Accessible menu anchored to labeled or named icon button |
| Compact supplemental workflow | Bottom sheet on compact widths; supporting pane/dialog on wider widths |
| Blocking decision | Accessible dialog |
| Brief completion | Snackbar or inline status with live-region announcement |
| Long history | Disclosure/details component or dedicated activity view |

Do not use chips as generic buttons. Use them only for selection/filter semantics. Static metadata must not share the exact same treatment as interactive selections.

## 10. Visual hierarchy and tokens

### Semantic color roles

Use project semantic tokens, not one-off literals:

- page background: `surface`/project background role;
- primary content: `onSurface`;
- secondary content: `onSurfaceVariant`;
- calm section grouping: `surfaceContainer` or spacing/dividers;
- separator: `outlineVariant`;
- primary action: `primary` + `onPrimary`;
- warning/action required: warning container + on-warning-container equivalent;
- destructive/error: error container + on-error-container;
- success: dedicated success roles already represented in the project token layer.

Color must reinforce a label or icon, never replace it.

### Type hierarchy

- matchup: page title;
- event/tournament name: supporting title, not a full input in view mode;
- date/time and venue: prominent body text;
- section names: consistent heading level, not merely uppercase visual labels;
- metadata labels: quiet label style;
- helper/history text: body small, still meeting contrast requirements.

The DOM heading structure should remain logical: one `h1` for the page, `h2` for major sections, and `h3` only for subsections. Do not choose heading elements based solely on font size.

### Shape and containment

- do not put every block in an outlined rounded card;
- use spacing and dividers for routine Overview, Teams, and Crew content;
- reserve stronger containers for required action, warning, proposal comparison, or a truly independent item;
- avoid making all statuses and controls capsules;
- use elevation only when an overlay, sticky action region, or floating surface needs separation.

### Density

The redesign should reduce visible choices, not compress all touch targets. Information density may increase through concise summaries while interaction targets remain comfortably sized.

## 11. Responsive and adaptive behavior

### Compact window

- single column;
- full-width contextual back bar in the app shell, directly beneath the app header and outside scrolling content;
- matchup wraps naturally without clipping;
- date/time and venue stay near the top;
- the entire solid bottom action bar opens scheduler actions rather than placing the kebab below a wrapped team name;
- section actions move into row/section menus if space is constrained;
- edit mode uses normal page flow;
- official picker and contact details use a bottom sheet/full-height sheet as appropriate;
- sticky bottom action respects safe-area and keyboard insets.

### Medium window

- single bounded reading column or a modest two-column overview where it improves scanning;
- teams and crew may use wider rows;
- action labels remain visible rather than becoming unexplained icons;
- do not stretch form controls to the full viewport without a readable max width.

### Expanded window

- use a bounded primary column plus an optional supporting pane;
- suggested supporting pane content: status, required action, and compact crew coverage—not filler;
- Edit details may keep Save/Cancel and a change summary in the supporting pane;
- preserve reading order and keyboard order;
- the back action remains a full-width navigation surface with a compact, left-aligned destination label; it must not read as a large empty outlined button.

### Resize continuity

Preserve:

- selected event;
- scroll position where practical;
- open disclosure state;
- edit draft;
- focused field;
- active modal/panel if the representation changes safely.

Test just below and above each project breakpoint, narrow landscape, a wide desktop window, browser zoom, large text, and the on-screen keyboard.

## 12. Accessibility requirements

### Required for release

- interactive touch targets are at least 48 by 48 CSS pixels on touch-oriented layouts;
- all icon-only actions have accessible names and visible tooltips where helpful;
- focus indicators are clearly visible against every surface;
- keyboard order follows the visual/content order;
- menus, dialogs, sheets, radio groups, and disclosures expose correct role, name, value/state, and focus behavior;
- passive status elements are not exposed as buttons;
- selected, warning, success, and error states are conveyed in text, not color alone;
- normal text meets at least 4.5:1 contrast and meaningful non-text indicators meet at least 3:1;
- text can scale without clipping, overlap, or lost actions;
- event/team names and translated labels may wrap without fixed-height truncation;
- validation is associated with its field and announced;
- save/result messages use an appropriate polite or assertive live region;
- dialogs trap focus while open and restore it to their trigger on close;
- reduced-motion preferences are honored;
- links that open a new context are understandable from label/context;
- sticky content does not obscure focused elements or page content.

### Specific corrections from the current page

- enlarge the 32px edit icon targets and 40px overflow target;
- replace ambiguous clickable status pills with explicit actions;
- ensure the title is the single page `h1` rather than an `h2` chosen for styling;
- ensure fee fields expose currency and units, not only role abbreviations and unlabeled numbers;
- replace browser alerts/confirms with application feedback/dialogs;
- do not depend on hover/title text to explain crew status;
- verify the custom chip/radio controls have complete keyboard behavior; prefer library radio/segmented components when possible;
- announce loading and saving states rather than only disabling a control.

## 13. Loading, empty, error, and offline states

### Initial loading

Show a stable skeleton shaped like the header, overview rows, and two participant sections. Do not show an empty form and then populate it.

### Not found

Message: `Match not found`  
Support: `It may have been removed, or you may no longer have access.`  
Action: `Back to schedule`

### Permission denied

Do not reuse Not found if the product intentionally tells the user they lack access. Provide a safe navigation action and no leaked event details.

### Partial data

- missing kickoff: `Time not set`;
- missing venue: `Venue not set`;
- missing contact: `Not listed`;
- no crew assignee: `Open`;
- no notes: omit for non-assigners, quiet empty state for assigners;
- no schedule link: omit in view mode;
- no history: closed disclosure with zero count or omit the section.

### Network failure

- retain last confirmed data when safe;
- label stale/offline data explicitly;
- do not allow a user to believe a consequential server update succeeded when it did not;
- preserve drafts and offer Retry;
- if offline queuing is supported, show `Pending sync` until the server confirms.

### Concurrent update

If another user updates the event while Edit details is open:

- flag that newer data exists;
- show which fields conflict when feasible;
- allow the user to review/reload;
- never silently overwrite newer server data with an old draft.

## 14. Content and terminology changes

Recommended copy:

| Current or likely label | Recommended label/reason |
| --- | --- |
| Event information | Match Details — contains the event title, date, location, and match classification |
| Event title | Event or tournament name |
| Enabled / Disabled for travel | Provided / Not provided in edit mode; natural-language summary in view mode |
| Back | Destination-aware, e.g. `Schedule` |
| × | Named `Clear official` or `Remove role` action |
| Edit pencil beside When/Where | `Propose change` for team admins; direct editing stays in assigner Edit details |
| Acknowledge only | `Mark reviewed`, after confirming exact business semantics |
| Apply change | `Apply to match` |
| Email | `Email teams` or `Email crew` |
| Additional info | Match notes or Instructions, based on intended content |

Use “match” consistently for the scheduled fixture and “event/tournament” for the grouping that may contain matches. The current page and model use both concepts; commercial onboarding will be easier if the distinction is explicit.

## 15. Proposed view-mode wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ ← Schedule                                              │
│                                                          │
│ UNT                                                      │
│ vs Louisiana State University (LSU)         [Official]  │
│ Sat, Oct 10 · 10:00 AM                                  │
│ North Elm Fields · Denton, TX             [Directions]  │
│ Women · Tier 3 · League · XVs                            │
├──────────────────────────────────────────────────────────┤
│ ACTION REQUIRED (only when applicable)                   │
│ Schedule details changed. Review and reconfirm.          │
│ [Review change]                         [Decline]         │
├──────────────────────────────────────────────────────────┤
│ MATCH DETAILS                                            │
│ Event       Dallas Rugby Weekend                         │
│ Match fee   MO $100 · CMO $100                           │
│ Travel      Flight and lodging not provided              │
│ Notes       Arrive 60 minutes before kickoff             │
│ Schedule    Tournament schedule                 [Open]   │
├──────────────────────────────────────────────────────────┤
│ TEAMS                                      [Email teams] │
│ Home   UNT                                      Confirmed │
│ Away   Louisiana State University             Unconfirmed│
├──────────────────────────────────────────────────────────┤
│ CREW · 2 of 3 filled            [Email crew] [Manage]    │
│ MO    Jordan Lee                                Confirmed │
│ AR1   Open                                           Open│
│ AR2   Sam Ortiz                           Awaiting reply  │
├──────────────────────────────────────────────────────────┤
│ REPORTS · 1 pending                              [View]   │
├──────────────────────────────────────────────────────────┤
│ › Activity · 8                                           │
└──────────────────────────────────────────────────────────┘
```

The wireframe communicates hierarchy and behavior, not final spacing or visual style.

## 16. Implementation recommendations

### State model

Introduce explicit local UI state rather than deriving editability directly from `isAssignerView`:

```ts
type MatchDetailMode = 'view' | 'edit-details' | 'manage-crew';
```

Use a dedicated edit draft:

```ts
type MatchDetailsDraft = {
  title: string;
  division: MatchDivisionSelection;
  feeOverrides: Partial<Record<RequestableSlot, string>>;
  flightProvided: boolean;
  housingProvided: boolean;
  notes: string;
  scheduleUrl: string;
};
```

Do not route draft field changes through `store.setMatchFlags`. Add a single validated save operation that can report pending, success, and failure.

### Suggested component decomposition

`MatchDetailPage.tsx` currently owns many unrelated states and workflows. Split by user task:

- `MatchDetailHeader`
- `MatchAttentionPanel`
- `MatchOverviewSection`
- `MatchDetailsEditor`
- `MatchTeamsSection`
- `MatchCrewSection`
- `MatchCrewManager`
- `MatchReportsSection`
- `MatchActivitySection`
- `MatchActionsMenu`
- focused dialogs/sheets for proposal, contact, email, compliance, forfeit, and destructive confirmation

Keep business rules in domain/services. Components should receive permission-aware capabilities and callbacks, not independently infer every role rule.

### Persistence boundary

Create one service/store command for the edit transaction. It should:

1. validate the complete draft;
2. normalize empty optional values;
3. detect whether anything changed;
4. persist atomically where the backend permits;
5. return structured field/global errors;
6. refresh or reconcile the canonical match;
7. emit one success result.

Schedule-derived fields need an explicit source-of-truth policy before implementation:

- **If imported schedule data is authoritative:** label it as schedule-managed and offer an override flow with a clear reset-to-schedule action.
- **If MatchReadyTX is authoritative:** edit it here and sync outward.
- **If bidirectional:** show sync status and conflict behavior; never hide which source will win.

This decision is essential for production because an edit mode alone does not prevent external sync from overwriting user changes.

### URL and navigation state

Recommended:

- base route remains the canonical read view;
- edit/manage mode may be local state if deep-linking is unnecessary;
- if the browser Back button must exit Edit details before leaving the match, represent the mode in nested routing or history state;
- preserve the originating list’s filters and scroll position.

## 17. Implementation sequence

### Phase 1 — Highest-value visual reduction

1. Add default view mode for assigners.
2. Move title, division, fees, travel, notes, and schedule URL into Edit details.
3. Group event title, date/time, and location inside Match Details.
4. Replace the classification selector bank with a compact view summary.
5. Replace travel Enabled/Disabled controls with view-mode text.
6. Add explicit Save/Cancel and unified save feedback.

### Phase 2 — Operational clarity

1. Add a dedicated required-action region.
2. Make each permitted confirmation-status control toggle its state directly.
3. Add Manage crew mode.
4. Replace `×` and always-visible Resend with named row actions.
5. Reorganize the overflow menu by consequence, including one Change match status submenu.

### Phase 3 — Production hardening

1. Replace browser alert/confirm calls.
2. Add loading, offline, conflict, retry, and permission states.
3. Complete keyboard/screen-reader and text-scaling audit.
4. Validate touch targets and focus restoration.
5. Add analytics for mode entry, completion, abandonment, and errors.
6. Run usability testing with first-time assigners, officials, and team administrators.

## 18. Acceptance criteria

The event page is ready for production review when:

- [ ] every role lands in a read-first view;
- [ ] an assigner can identify teams, status, kickoff, and venue without scrolling on a typical compact viewport;
- [ ] only selected classification values appear outside Edit details;
- [ ] event metadata cannot change until the assigner deliberately enters Edit details;
- [ ] Edit details uses a draft with Save and Cancel;
- [ ] a failed save preserves all entered data and offers recovery;
- [ ] unsaved changes are protected on exit;
- [ ] crew operations are visually and semantically separate from event metadata editing;
- [ ] required user actions are prioritized above informational content;
- [ ] no passive status looks like an interactive selection control;
- [ ] no action depends on an unlabeled `×`, pencil, color, or hover tooltip alone;
- [ ] utilities such as directions, calendar, contact, email, and schedule remain available in view mode;
- [ ] destructive and workflow-changing actions explain their consequences;
- [ ] touch targets, keyboard focus, screen-reader semantics, contrast, and text scaling pass the accessibility review;
- [ ] layout behaves intentionally at compact, medium, and expanded widths;
- [ ] server failure, offline, not-found, permission, and concurrent-update states are defined and tested;
- [ ] the final terminology clearly distinguishes a match from its event/tournament grouping;
- [ ] source-of-truth and synchronization behavior are visible and documented.

## 19. Production review score

Scoring: `0` missing/incorrect, `1` partially addressed, `2` production-ready.

| Category | Current | Target | Main gap |
| --- | :---: | :---: | --- |
| Task clarity | 1 | 2 | Reading, editing, and operations compete |
| Information hierarchy | 0 | 2 | Configuration controls precede core match facts |
| Component semantics | 0 | 2 | Chips/pills and rows serve ambiguous action/status roles |
| Token discipline | 1 | 2 | Semantic tokens exist, but component hierarchy needs consolidation |
| Adaptive behavior | 1 | 2 | Wide back bar and stretched single-column behavior need refinement |
| States and feedback | 0 | 2 | Mixed autosave/blur save, browser alerts, incomplete retry/conflict model |
| Accessibility | 0 | 2 | Small targets and ambiguous custom controls require correction/testing |
| Expressive restraint | 1 | 2 | Too many equally prominent pills, inputs, and cards |

**Current result: not production-ready.** The page is functionally rich, but the information architecture and interaction model must be simplified before visual polish can make it feel like a commercial product.

## 20. Decisions to confirm during review

These are product decisions, not blockers to agreeing on the overall direction:

1. Is the master schedule, MatchReadyTX, or a bidirectional sync the source of truth for match facts?
2. Should fees be shown as per-role amounts, a range/summary, or only inside Edit details?
3. Does `Side` describe an event-level grouping that most organizations understand, or should it use organization-configurable terminology?
4. Should crew assignments save immediately with notifications, or should Manage crew support a staged multi-change review?
5. When an assigner changes date or venue directly, should that always invalidate team and official confirmations?
6. Should activity/history stay inline or become a dedicated audit-log view for larger organizations?
7. Which action is most common for assigners after opening a match: review coverage, assign crew, confirm facts, or edit metadata? This affects the single visible header action.
