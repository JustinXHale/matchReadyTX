# MatchReadyTX — Implementation specification

**Status:** Draft v1  
**Last updated:** 2026-07-25  
**Upstream:** [`PRD.md`](./PRD.md) wins on product conflicts.  
**Platform:** Mobile-first PWA (Vite + React + PatternFly + Firebase)

---

## 1. Stack

| Layer | Choice |
|-------|--------|
| App | Vite + React 19 + TypeScript |
| UI | PatternFly React v6 (mobile-first cards / stacked pages) |
| PWA | `vite-plugin-pwa` |
| Auth | Firebase Auth (Google + Apple) |
| Data | Cloud Firestore |
| Backend | Cloud Functions (TypeScript) |
| Email | Resend (`mail/` queue → `processOutboundMail`) |
| SMS | Deferred (field `smsOptIn` kept; UI hidden) |
| Sheets | Service account + Apps Script webhook + poll fallback |
| Hosting | Firebase Hosting |
| License | MIT |

---

## 2. Locked product defaults

See PRD §0 and §14 (build defaults). Summary: Sheet = schedule SoR; fees in-app **display only (never payouts)**; dual team confirm; MO visibility gate; auto-release on unavailable; history chain; availability ranges; game requests; T-72; **email notifications** (SMS opt-in UI deferred); **Team Admin** lens (`teamAdmin`, Contacts email link); **Referee/CMO = one lens (Q-R6)**.

---

## 3. Firestore shape

```
orgs/{orgId}
  name, timezone, mileageRatePerMile, mileageMinMiles,
  defaultFees: { mo, ar1, ar2, no4 },
  sheetId?, sheetSyncedAt?

orgs/{orgId}/members/{uid}
  roles: ('assigner'|'teamAdmin'|'official'|'cmo'|'fan')[]
  teamIds?: string[]
  fanTeamIds?: string[]   // Fan favorites; empty = general society fan

orgs/{orgId}/teams/{teamId}
  name, contactEmails[], contactPhones[]

orgs/{orgId}/matches/{matchId}
  sheetRowKey, status, kickoffAt, venueName, venueAddress,
  venueLat?, venueLng?, homeTeamId, awayTeamId, competition?,
  homeScore?, awayScore?,
  flightProvided, housingProvided,
  feeOverride?: { mo?, ar1?, ar2?, no4? },
  homeConfirmedAt?, awayConfirmedAt?,
  t72TeamHome?, t72TeamAway?,
  releasedAt?, cancelledAt?, postponedAt?

orgs/{orgId}/matches/{matchId}/crew/{slot}   // mo|ar1|ar2|no4
  userId?, status, confirmedAt?, history[]

orgs/{orgId}/matches/{matchId}/proposals/{proposalId}
  proposedByTeamId, fields, status, otherTeamAcceptedAt?,
  assignerAckAt?, resolvedAt?

orgs/{orgId}/matches/{matchId}/gameRequests/{requestId}
  userId, preferredSlot?, note?, status

orgs/{orgId}/availability/{uid}/ranges/{rangeId}
  startAt, endAt, kind: 'available'|'blocked'

users/{uid}
  firstName, lastName, displayName (derived), email, phone,
  smsOptIn (stored; UI hidden until SMS ships), homeStreet, homeUnit?, homeCity, homeRegion, homePostalCode,
  homeAddress (composed), homeLat?, homeLng?,
  birthday?, refereeLevel?, assessedLevel?, refereeingSince?,
  jerseySize?, shortsSize?, photoUrl?,
  profileComplete, roles: assigner|teamAdmin|official|cmo|fan,
  fanTeamIds?: string[]

mail/{mailId}   // outbound queue — Admin SDK only; see docs/EMAIL.md
  to, message: { subject, text?, html? }, uid?, event?, delivery?
```

**Onboarding (`/onboarding`):** progressive one-question flow with image placeholders. Ends with optional photo. Fan-only: roles → names → optional favorite teams → photo. Referee/Team Admin/CMO keep phone + birthday; referee level optional (“I don’t know”); began date + jersey/shorts when Referee/CMO. `cmo` shares the Referee/CMO lens with `official` (Q-R6). `fan` lens homes to Global schedule.

### Match status values

`draft` | `pending_team_review` | `change_proposed` | `team_confirmed` | `crew_pending` | `mo_confirmed` | `crew_confirmed` | `t72_team_pending` | `t72_officials_pending` | `locked_confirmed` | `needs_reconfirmation` | `needs_reassignment` | `cancelled` | `postponed`

### Crew slot status

`empty` | `pending_internal` | `official` | `confirmed` | `held` | `declined` | `released`

---

## 4. Security rules (intent)

- Auth required for all reads/writes except public health.
- Team admins: read matches for their teams; write confirmations/proposals for those matches; **cannot** read crew `userId`/PII until match status ≥ `mo_confirmed` (or field `crewVisibleToTeams`).
- Officials: read own assignments + open requestable matches (facts + economics); write own confirm/availability/requests.
- Assigner: full org read/write for scheduling.

---

## 5. Mobile IA (routes)

| Path | Role / notes |
|------|------|
| `/` | Redirect → `/referee/appointments` |
| `/login` | Google / Apple (demo: Continue in demo) |
| `/onboarding` | Multi-step profile gate (contact → address → roles → grade) |
| `/profile` | Edit contact, address, roles, grade, optional photo |
| `/about` | Informative page (no top tabs) |
| `/referee` | Redirect → appointments |
| `/referee/appointments` | Own assignments via `MatchListRow` cards; urgent strip for pending accept |
| `/referee/request/pending` | Own **active** raise-hand requests (kickoff upcoming, preferred slot still open) |
| `/referee/request/global` | Open games + raise-hand (role chips MO/AR/CMO/#4); past / filled games excluded |
| `/referee/reports/match` | **Match Reports** — referee duty (pending first) |
| `/referee/reports/coaching` | **Coaching Reports** — CMO duty |
| `/global` | Redirect → `/global/schedule` |
| `/global/schedule` | Society schedule cards + crew column; Men/Women + D1/D2/D3 filters |
| `/global/standings` | W/L/T/PF/PA/PD by gender × level; row opens team |
| `/global/teams` | Team list → `/global/teams/:teamId` (that team’s matches) |
| `/availability` | Official ranges |
| `/profile` | Contact, home address, roles (SMS opt-in deferred) |
| `/team-admin` | Team Admin home — upcoming club matches + confirm status |
| `/coach` | Redirect → `/team-admin` |
| `/scheduler` | Redirect → `/scheduler/queues` |
| `/scheduler/queues` | Assigner action inbox (raise-hand, needs officials, reassignment, proposals, T-72, notifications) |
| `/scheduler/schedule` | All-org match browse + filters; opens `/matches/:id` |
| `/scheduler/org` | Sheet template/link/sync, CSV, release, levels, default fees |
| `/matches/:id` | Canonical match detail for every role |
| `/assigner` | Redirect → `/scheduler/org` |
| `/requests` | Redirect → `/scheduler/queues` |
| `/settings` | Redirect → `/profile` |

**Bottom nav (always):** About · Referee/CMO · Global · Availability · Profile  
(Icons: info · whistle · globe · calendar · user — Font Awesome free solid; whistle is inlined SVG because Pro-only.)

**Referee/CMO top tabs** (only under `/referee/*`): Appointments · Request · Reports.  
Request / Reports use sub-nav (Pending \| Global; **Match Reports** \| **Coaching Reports**).  
Appointments and Request are shared for referees and CMOs. Reports is where duties differ: match reports vs coaching reports.  
**Due badges:** Appointments shows count of assignments awaiting accept; Reports (and Match Reports / Coaching Reports) show pending / missing report counts.

**Global top tabs:** Schedule · Standings · Teams.

**Masthead:** Brand + Demo badge; **org-local date · time** under the title; role switcher when multi-role.

**Match list cards (`MatchListRow`):** stacked month abbr + ordinal day; Men/Women + level ink chips; team names with scores (or `–`); optional kickoff time; trailing crew or raise-hand column.

**Back navigation:** Detail screens use descriptive **← Back to {label}** via `src/nav/backNav.ts` location state (e.g. Back to Teams, Back to Schedule). Fallback is browser history.

**Modular features:** one concern per route/page under `src/features/` — do not combine appointments, raise-hand, society browse, and assigner inbox into a single Matches mega-page. Scheduler is likewise split: `scheduler/queues`, `scheduler/schedule`, `scheduler/org`.

### Scheduler control center

Masthead **Scheduler** (= Assigner). Modular tabs:

| Tab | Job |
|-----|-----|
| **Queues** | God-mode inbox — raise-hand approve/decline, needs officials, reassignment, proposals awaiting ack, T-72 due, notification log |
| **Schedule** | Browse/filter all org matches; assign/edit via match detail |
| **Org** | Society Sheet template → link → sync (demo); CSV fallback; release drafts; levels + full default fee table |

Societies build fixtures in a **Google Sheet template**, link the Sheet ID under Org, and sync. The app is the operational layer; Sheet remains schedule SoR. Fees never leave the app; no payments.

### Domain helpers (UI-facing)

| Module | Helpers |
|--------|---------|
| `src/domain/requests.ts` | `isKickoffUpcoming`, `isMatchFilled`, `isPendingRequestActive`, `canOfficialRequestMatch`, `openRequestSlots` |
| `src/domain/standings.ts` | Aggregate W/L/T/PF/PA/PD from scored released matches |
| `src/nav/backNav.ts` | `BackNav`, `backState`, `readBackNav` |
| `src/services/maps.ts` | `mapsDirectionsUrl` for match **Where** row |

### Game request UX

1. Official opens **Referee → Request → Global**.
2. Taps raise-hand (or card) → match detail with request section (or `?request=1`).
3. Picks position + optional note → submit → appears on **Pending**.
4. **Pending** / Global omit past kickoffs, filled crews, and preferred-slot-taken requests (`isPendingRequestActive`).
5. Match detail **Request pending** chip only when the request is still active (not after kickoff).
6. Assigner approves/declines from **Scheduler → Queues** (raise-hand section).

### Distance / mileage / directions

- Haversine miles still computed in `src/domain/economics.ts` for future / assigner budgeting.
- **Match detail does not show Est. mileage** (no Distance Matrix API yet).
- **Where** opens Google Maps directions (`mapsDirectionsUrl`).
- Fee row + flight/housing perks remain on official/assigner detail.
- Demo geocode: city stubs in `demoGeocode` / `src/services/geocode.ts`.
- Production: Cloud Function `geocodeAddress`; optional Distance Matrix later.

### Role switcher

Masthead **role** control: **Referee/CMO | Team Admin | Scheduler**. Bottom nav mirrors the active lens (`/team-admin` for Team Admin).

**Contacts → Team Admin:** workbook Contacts tab (`team_name`, `email`, `phone`) sets `Team.contactEmails`. Users with role `teamAdmin` whose email matches are linked via `teamIds` (`linkTeamAdminsByEmail`). Demo Org card can edit/paste contacts until live Sheets pull exists.

| Lens | Persona | Notes |
|------|---------|--------|
| **Referee/CMO** | Officials (MO / AR / No.4) + CMO | Shared Appointments · Request. Reports: **Match Reports** (referee) vs **Coaching Reports** (CMO). **Q-R6** locked combined |
| **Coach** | Club contact (**= Team Admin**) | Stub today — design one club home (confirm / propose / T-72). Not a separate “Team Admin” product |
| **Scheduler** | Assigner | Control center: **Queues · Schedule · Org** (`src/features/scheduler/`). Match assign tools + history on `/matches/:id` |

Preference is stored in `sessionStorage`.

**Naming:** Club **Coach** ≠ **Coaching Reports** (society coaching of officials under Referee/CMO).

### Demo seed notes

- Open raise-hand games: `m_g01`…; **5** pending requests for Alex Assigner on the first five.
- Past results for standings: `m_res01`… with `homeScore` / `awayScore`, status `locked_confirmed`.
- Match reports: a few pending + submitted stubs for due badges.

### Payments

**Out of product scope forever.** Fees and mileage helpers are display / budgeting only — never wire payout UX.

---

## 6. Sheet contract

**Schedule columns:** `match_id`, `date`, `kickoff_time`, `location`, `home_team`, `away_team`, `competition?`, `level?` (D1/D2/D3), `gender?` (men/women), `notes?`, `game_slot?`  
**Contacts:** `team_name`, `email`, `phone`  
**Never on Sheet:** fees, mileage, flight, housing, official names for pay.

Match **level** options are admin-configurable in-app (default D1, D2, D3). **Gender** is men/women per match.

---

## 7. Cloud Functions

| Function | Trigger |
|----------|---------|
| `sheetWebhook` | HTTPS from Apps Script |
| `sheetPoll` | Scheduled every 5 min |
| `proposalWriteback` | On proposal approved |
| `notify` | Firestore triggers / callable |
| `t72Sweep` | Hourly scheduled |
| `geocodeAddress` | Callable — Google Maps Geocoding API; client uses `src/services/geocode.ts` |
| `csvImport` | Callable (assigner) |

**Distance note:** Haversine miles remain available in domain code. Match detail currently links **Where** to Maps directions and does **not** show Est. mileage until Distance Matrix (or equivalent) is wired. Driving distance is a follow-on.

---

## 8. Phased delivery

Aligned with build plan Phases 0–7. First demoable slice = Phases 0–4.
