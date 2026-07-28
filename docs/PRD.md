# MatchReadyTX — Product Requirements Document (PRD)

**Status:** Draft v0.9 (build defaults locked)  
**Last updated:** 2026-07-25  
**Owner:** Justin  
**Product name:** **MatchReadyTX**  
**Platform:** Progressive Web App (PWA), open source  
**Sport framing:** Officials scheduling (rugby-first; keep domain language generic where cheap)

This document is the **product** source of truth for what we are building and why. The **schedule** system of record is the linked **Google Sheet**. Implementation details will live in `docs/IMPLEMENTATION_SPEC.md`.

---

## 0. Locked decisions (v0.9)

| ID | Decision |
|----|----------|
| **Name** | **MatchReadyTX** |
| **Club persona** | **Team Admin** (UI + lens). Domain role `teamAdmin`. Linked via Contacts emails. Club home for confirm / propose / T-72 |
| **Payments** | **Never** — no Stripe, reimbursements, or fee payouts. Fees (and any future mileage estimates) are **display / budgeting only** |
| **Q-R3** | **Both** home and away Team Admins (Coaches) confirm date, time, and location |
| **Q-G3** | Teams **may propose changes in-app**; accepted changes are **written to the Sheet** |
| **Q-P1** | Change **approval** (facts): **other team accepts** + **assigner acknowledges**. Officials do **not** vote on the change — they mark **availability** for the new date/time/location |
| **Q-P3** | Official **unavailable / no** on a change → **auto-release** that slot, **reason required**, assigner + teams notified. Assigner sees an **assignment history chain** (who was assigned and who denied / released, in order) |
| **Q-G8** | **Google Sheet is the system of record** for schedule facts; the app syncs from it and writes accepted proposals back to it |
| **Q-A1** | Availability is **opt-in calendar days** with local time windows (closed by default); blocked is an explicit cut |
| **Availability** | Officials can set **general availability ranges** in-app — MVP |
| **Game request** | Officials request from **Referee → Request → Global** (position modal); assigner approves or declines — MVP |
| **Q-$1** | **Fee rates live in-app only** — **not** on the Google Sheet (Sheet may be shared; pay is not for everyone) |
| **Fee model** | Org **default fee structure** by slot (MO / AR / No.4); per-match or tournament **overrides** when needed |
| **Match economics (display)** | Officials (+ assigner) see **match fee** and optional **flight provided** / **housing provided** indicators — MVP. **Where** opens Maps directions. **Distance / Est. mileage** remain in domain for assigner budgeting and return when driving distance is reliable (Distance Matrix); not shown on match detail today |
| **Travel perks UI** | Flight / housing are **uncommon**; show as **icons** (or compact badges) when true — do not clutter every match with “not provided” text |
| **Profile contacts** | **Email and phone are required** for all users |
| **Q-N2** | Users **must choose SMS opt-in** (yes/no). Email notifications are always on. SMS only if opted in |
| **Q-T1** | **Vite + React + TypeScript** PWA |
| **UI** | **PatternFly** |
| **Q-T2** | **Firebase** (Auth, Firestore, Cloud Functions; FCM later if useful) |
| **Q-N1** | **Email + SMS from day one** (SMS only to opted-in users) |
| **Q-V1** | Teams see officials **only after any assigned Match Official has confirmed** the assignment (see §5.5 for crew nuance) |
| **Q-G1** | Prefer **automatic Sheet sync** (push via Apps Script webhook and/or short-interval pull) |
| **Q-R4** | Each role type (MO, AR1, AR2, No.4, optional CMO) may have **multiple explicit blocks** (including empty). Assigners add blocks via **Add role** (all types always listed). At least **one Match Official** block is required. Raise-hand stays open until empty blocks are filled |
| **Q-R6** | **Referee + CMO share one app lens** (masthead / bottom nav: **Referee/CMO**). Appointments and Request (Pending / Global) are shared. Reports split by duty: **Match Reports** (referee) vs **Coaching Reports** (CMO context) |

Still open items are listed in §14.

---

## 1. One-line intent

**MatchReadyTX** is a referee match-scheduling PWA where a **master Google Sheet** drives **home + away team confirmation** → assigner notification → **crew assignment** → official confirmations (including a **72-hour** reconfirm), with **strict visibility rules** so teams never see officials until the **Match Official has confirmed**.

---

## 2. Problem

Assigners currently manage schedules, contacts, and referee assignments across spreadsheets, texts, and email. That breaks down when:

- Schedule details change (time/location moves)
- Teams have not yet verified what is actually happening
- Officials are assigned before details are locked, causing confusion or no-shows
- There is no reliable “is this game still on?” check close to kickoff
- Cancelled or declined officials leave teams and assigners out of sync

**Goal:** Make the schedule the source of truth, force confirmation at the right moments, and only reveal the crew after the Match Official confirms.

---

## 3. Personas & roles

| Role | Who (v1 mental model) | Primary jobs |
|------|------------------------|--------------|
| **Assigner / Org Admin** | You (can be same person) | Link schedule, approve for team review, assign crew, handle declines/reassigns, receive alerts |
| **Team Admin** | Club contact for a side | Confirm date/time/location; **request a new fixture** (assigner approve → Sheet row); propose changes; T-72 yes/no. Linked when email matches team Contacts |
| **Match Official (MO)** | Required crew member | Set availability ranges; **request games**; confirm assignment; T-72; mark unavailable with reason when needed |
| **Assistant Referee (AR1 / AR2)** | Optional but supported in v1 | Same availability / request / confirm / T-72 flows when assigned |
| **Number 4** | Optional fourth official | Same when assigned |
| **CMO (optional)** | Coaching Match Official on a fixture | Selectable profile role + crew/contact slot; **Coaching Reports** under the shared **Referee/CMO** lens — not a separate masthead role |
| **Org / Tenant** | Society using an open-source deploy | Owns schedules, teams, officials, settings |

**v1 assumption:** Assigner and Org Admin are often the same person. Model capabilities separately for other societies later.

**UI lenses (masthead / bottom nav):** **Referee/CMO | Team Admin | Scheduler**. Scheduler = Assigner **control center** (Queues · Schedule · Org). Referee and CMO share one lens (**Q-R6** locked).

### Role open items (non-blocking)

| ID | Question | Current lean |
|----|----------|--------------|
| Q-R1 | Can a person hold multiple roles? | **Yes** — profile + memberships |
| Q-R2 | Multiple Coaches (Team Admins) per team? | **Yes** (primary + backups) |
| Q-R5 | Assigner pool vs single assigner? | **Single assigner** for v1 |
| **Q-R6** | Keep **Referee + CMO** as one app lens? | **Locked: yes** — one lens; Reports sub-tabs distinguish Match vs Coaching reports |

---

## 4. Core product principles

1. **Google Sheet is the schedule system of record.** The app syncs from it; in-app **change proposals** only become real when written back to the Sheet after the approval chain.
2. **Both teams must confirm** match facts before assignment becomes official.
3. **Confirmation gates assignment reality.** Pre-assignment is allowed for the assigner; it is **not official** until **both** teams have confirmed.
4. **One game = one line item.**
5. **Schedule change invalidates confirmation.** Until both teams re-confirm, there is **no confirmed crew**.
6. **Teams see officials only after Match Official confirmation** (not merely after assignment).
7. **Crew model:** role types MO / AR1 / AR2 / No.4 / CMO; **multiple blocks per type** (empty or filled); at least one MO block required. Teams see crew when **any** assigned MO has confirmed. Official Accept/Decline only in Referee lens.
8. **72-hour dual reconfirm** (teams first, then each assigned official).
9. **Email for everyone; SMS only if the user opts in** (choice required on profile). **Email and phone are both required.**
10. **Officials see match fee** and rare **flight / housing** perks when provided; **Where** opens Maps directions. Distance / mileage estimates stay in domain until driving distance is reliable. **Fees stay in-app**, never on the shared Sheet.
11. **Lean stack:** Vite + React + PatternFly + Firebase.
12. **Multi-tenant later** — don’t hard-code a single society into the schema.
13. **No payments** — the product never processes fees or mileage reimbursements.
14. **Team Admin** — one club persona (domain `teamAdmin`); Contacts tab emails link admins to clubs.

---

## 5. End-to-end user flows

### 5.1 Happy path (first assignment)

```
Admin links Google Sheet (Schedule + Contacts)
        │
        ▼
Admin marks schedule Ready / Approved for team review
        │
        ▼
Home Team Admin confirms date / time / location
Away Team Admin confirms date / time / location
  (either may propose a change instead — see §5.6)
        │
        ▼
Both teams confirmed
        │
        ├──► Assigner notified: “Match needs officials” (at least MO)
        │
        ├──► If assigner already pre-assigned crew:
        │         assignments become Official → each assigned official notified
        │
        └──► If no / partial pre-assignment:
                  Assigner fills MO (required) + optional AR1/AR2/No.4
                  → notified officials confirm
        │
        ▼
Match Official confirms date / time / location
        │
        ▼
Teams can now SEE the crew (MO + any assigned assistants)
        │
        ▼
AR1 / AR2 / No.4 confirm when assigned (parallel; MO already unlocks team visibility)
```

### 5.2 Pre-assign before team confirms (supported)

```
Admin links/releases schedule
        │
        ▼
Assigner assigns MO / ARs / No.4  (INTERNAL / PENDING)
        │
        ├── Teams: do NOT see any officials
        ├── Officials: no official “you’re on” until both teams confirm
        │
        ▼
Home + Away both confirm
        │
        ▼
Pending → Official → notify assigned crew → MO confirms → teams see crew
```

### 5.3 Master schedule change after confirmation

```
Facts change (Sheet sync or accepted in-app proposal): e.g. 2pm → 3pm
        │
        ▼
Match → needs_reconfirmation
All official confirmations voided / held
Team visibility of crew revoked until MO re-confirms after both teams re-confirm
        │
        ▼
Home + Away re-confirm new facts
        │
        ▼
Re-notify assigned crew to confirm new details
MO confirms → teams see (updated) crew again
```

### 5.4 Seventy-two hour reconfirm

```
T-72h before kickoff
        │
        ▼
Home + Away: “Is this match still taking place?”  Yes / No
        │
        ├── Either says No → Assigner notified; all officials released;
        │                     match Cancelled / Postponed (Q-S5)
        │
        └── Both Yes → each assigned official: “Still attending?” Yes / No
                         │
                         ├── All Yes → locked_confirmed
                         └── Any No (+ reason) → Assigner reassign that slot;
                                                 teams notified “official being reassigned”
                                                 (hide that slot until replacement confirms)
```

**T-72 team rule:** Both home and away must answer Yes for the match to proceed to official T-72 prompts. If one says No, treat as match not proceeding (assigner decides cancel vs postpone).

### 5.5 Visibility rules (locked)

| Audience | Sees crew names / contacts | When |
|----------|----------------------------|------|
| Assigner / Org Admin | Yes | Always |
| Home / Away Team Admin | **No** | Until **Match Official has confirmed** (and both teams’ fact confirmation is current) |
| Assigned officials | Own assignment + match facts | After assignment becomes **Official** |
| Public | No | Never in v1 |

**Crew nuance (locked lean):**

- Team visibility unlocks when the **Match Official** confirms — not when ARs/No.4 confirm.
- Until MO confirms, teams see **no** official names (including ARs already assigned).
- If MO later declines / is released, **hide crew again** until a new MO confirms.
- Optional: show AR/No.4 slots as “TBD” vs named only after MO unlock — **default: show full assigned crew once MO has confirmed**.

### 5.6 In-app change proposals (locked)

Either Team Admin may propose a change to date, time, and/or location.

**Fact approval** (does the schedule change?) is separate from **official availability** (can this person still cover it?).

```
Team A proposes change (date / time / location)
        │
        ▼
Notify: other team (accept/deny) + assigner (acknowledge)
        │
        ├── Other team denies
        │     → Proposal rejected; proposer notified; Sheet unchanged
        │
        └── Other team accepts + Assigner acknowledges
                │
                ▼
            Write new facts to Google Sheet (system of record)
                │
                ▼
            Auto-sync → match needs_reconfirmation
            Both teams confirm new facts as usual
                │
                ▼
            Each already-assigned official is asked:
            “Are you available for the new date/time/location?”  Yes / No
                │
                ├── Yes → keep assignment; official re-confirms details as needed
                │
                └── No (+ required reason)
                      → Auto-release that slot
                      → Append to assignment history chain
                      → Assigner alerted (reason + history)
                      → Teams notified: official unavailable / being reassigned
                      → Match needs_reassignment for that slot (MO required)
```

**Fact-approval rules:**

| Step | Actor | Action | Required? |
|------|-------|--------|-----------|
| 1 | Proposing team | Create proposal | Yes |
| 2 | Other team | **Accept** or deny | Yes |
| 3 | Assigner | **Acknowledge** | Yes |

Officials are **not** on this approval chain — they do not veto the Sheet write.

**Availability check (after facts land, or when proposed facts are known):**

| Step | Actor | Action |
|------|-------|--------|
| A | Each named official on the match (official or pending_internal) | Mark **available** or **unavailable** for the new slot |
| B | If unavailable | **Reason required** → **auto-release** → history chain + notify assigner & teams |

### 5.7 Assignment history chain (locked)

For each match (and each crew slot), the assigner sees an ordered **history chain**, for example:

```
MO: Alice (assigned) → Alice unavailable on time change (“conflict”) → released
MO: Bob (assigned) → Bob declined T-72 (“injury”) → released
MO: Cara (assigned, confirmed)
```

Include at least: person, slot, timestamps, action (`assigned` / `confirmed` / `unavailable_on_change` / `declined` / `released` / `reassigned`), and free-text reason when present. This is the assigner’s audit trail when the same slot turns over multiple times.

### 5.8 Official availability input (MVP)

Officials need a simple way to declare **general availability** so assigners can pick people who can work a fixture — not only react to one-off change prompts.

**MVP (locked): opt-in day calendar + time windows**

- **Default closed:** unmarked days mean not available until the official opens them.
- **UI:** month calendar under Referee/CMO → Availability (CMO same tool). Tap cycles **closed → available → blocked → closed**.
- **Available** days carry one or more **local time windows** (default 07:00–21:00 org timezone; editable per day, including split windows for tournament days).
- **Blocked** means the official reviewed the date and cut it (distinct from forgetting to open a day).
- **Set pattern:** date range + weekday chips + open **or block** + hours (when opening) → apply to matching days. Opening preserves blocked days; blocking overwrites open/closed.
- **Bulk month actions:** e.g. open all Fridays, open Fri–Sun, clear month (blocked skipped when opening).
- Storage: `AvailabilityRange` docs at `orgs/{orgId}/availability/{uid}/ranges/{rangeId}` (Firestore); in-app only (no Google Calendar sync).
- Assigner picker: badge **Available** / **Outside window** / **Blocked** / **No availability set**; sort **Available first** (still advisory — assigner may assign anyone).
- Match-day check: blocked that local day wins; otherwise available if kickoff falls inside that day’s open window.

### 5.9 Game requests (MVP)

Officials can **request a game** — express interest in officiating a specific **existing** match and confirm a preferred crew slot. This is distinct from **Team Admin fixture requests** (§5.9a).

```
Official browses Referee → Request → Global (upcoming open games only)
        │
        ▼
Taps raise-hand / card → match detail request section
        │
        ▼
Confirms position (MO / AR1 / AR2 / No.4 / CMO when needed) + optional note
        │
        ▼
Assigner notified (email; SMS if assigner opted in)
        │
        ├── Assigner approves → creates / upgrades assignment for that slot
        │     (same pending_internal → official pipeline as a normal assign)
        │     → Request marked fulfilled; history chain notes “assigned via request”
        │
        └── Assigner declines (+ optional reason)
              → Official notified; request closed
```

**IA:** Officials request from **Referee → Request → Global**. Active waiting requests live under **Request → Pending**. Past kickoffs, filled crews, and preferred-slot-taken requests are dropped from both lists. Society-wide **Global** bottom tab covers **Schedule · Standings · Teams**. Assigners use **Scheduler → Queues** to approve/decline raise-hands and clear other action items; **Org** for Sheet link/sync/release. Modular pages — do not merge these surfaces into one Matches page.

**Rules (locked leans):**

| Item | Decision |
|------|----------|
| Who can request | Any official role in the org; not limited to people already on a crew |
| Where they request | **Referee → Request → Global** (and match detail) |
| What they see before request | Match facts, **fee**, flight/housing icons if provided; **not** other officials’ names until MO visibility gate. Distance/mileage when shown again will be per-user |
| Slot preference | **Required** when raising a hand; assigner may still place them in a different open slot |
| Multiple requesters | Allowed; assigner picks; others remain pending or are declined |
| Duplicate request | One open request per official per match |
| Home address | Collected on profile for future distance/mileage; **not** required to raise a hand today |
| Active request lists | Pending / Global hide past kickoffs, filled crews, and preferred-slot-taken requests |
| Relationship to availability | Request does not require an overlapping availability range, but assigner UI should warn on mismatch |

**Q-A3:** Unreleased (`draft`) matches do **not** appear as requestable — only released / needs-official matches.

### 5.9a Team Admin fixture requests (MVP)

Team Admins may **request a new fixture** (not an official raise-hand). Flow:

1. Team Admin → FAB **+** → form (own club + Home/Away, opponent from org teams, date/time, venue name + address, competition, level, gender, notes, flight/housing).
2. Creates a pending `FixtureRequest` (Firestore `orgs/{orgId}/fixtureRequests`).
3. Assigner reviews in **Scheduler → Queues → Fixture requests**.
4. **Approve** → Cloud Function appends a Schedule row (`APP-…` match_id) + Locations row, creates the match as `pending_team_review` (requester’s side pre-confirmed), marks request approved.
5. **Decline** → request closed with optional reason; Team Admin sees status on home.

Sheet remains system of record for schedule facts; app-created rows use `APP-{yyyyMMdd}-{short}` ids.

### 5.10 Match economics for officials & assigner (MVP)

Fees and travel compensation are **app-only**. They must **not** live on the Google Sheet — the Sheet may be shared with people who should not see pay.

#### Fee structure

| Layer | Behavior |
|-------|----------|
| **Org default rates** | Standard fees by crew slot (MO / AR1 / AR2 / No.4). Most regular matches use these |
| **Override** | Tournament or special matches can override fee per match and/or per slot |
| **Visibility** | Officials + assigner. **Teams do not see official fees** in v1 |

#### What officials see on a match

| Field | When shown | Notes |
|-------|------------|-------|
| **Match fee** | Always (for the slot they’re viewing / requesting) | From default schedule or override |
| **Flight provided** | **Icon / label only when true** | Most matches: no icon, no “not provided” noise |
| **Housing provided** | **Icon / label only when true** | Same — presence = perk; absence = normal |
| **Where → Maps** | When venue is known | Opens directions in Maps |
| **Distance / mileage estimate** | Deferred on match detail | Still computed in domain; show again when driving miles are reliable. Assigner inbox may still surface estimates when budgeting |

Assigner sees the same fee/perks, plus ability to set overrides and flight/housing flags, and to review mileage estimates when assigning / budgeting (when shown).

#### Travel perks UX (locked)

- Flight and housing are **exceptions** (e.g. out-of-town tournament).
- UI: compact **icons** (with accessible labels / tooltips) when provided.
- Do **not** show “Flight: No / Housing: No” on every card.
- Assigner sets flags per match in-app (not on Sheet).

#### Out of scope forever (payments)

- Actual payouts / Stripe / reimbursements / cutting checks — **never**. Fees and mileage math are display / budgeting aids only.

Open items: mileage formula (**Q-$3**), whether mileage is $0 under a minimum distance (**Q-$4**).

---

## 6. Match & crew lifecycle

### 6.1 Match states

| State | Meaning |
|-------|---------|
| `draft` | In sheet / synced; not released |
| `pending_team_review` | Released; waiting on home and/or away confirmation |
| `change_proposed` | In-app proposal pending other-team accept + assigner acknowledge |
| `team_confirmed` | **Both** teams confirmed facts; crew may be officialized |
| `crew_pending` | Official assignments sent; awaiting MO (and any other assigned) confirms |
| `mo_confirmed` | Match Official confirmed → **teams can see crew** |
| `crew_confirmed` | All currently assigned officials confirmed |
| `t72_team_pending` | Waiting on home + away T-72 |
| `t72_officials_pending` | Waiting on each assigned official’s T-72 |
| `locked_confirmed` | T-72 complete — game is on |
| `needs_reconfirmation` | Fact delta invalidated confirmations |
| `needs_reassignment` | Required MO missing / declined; or optional slot decline needing action |
| `cancelled` / `postponed` | Terminal / semi-terminal (Q-S5) |

### 6.2 Crew slots (v1)

| Slot | Code | Required? |
|------|------|-----------|
| Match Official | `mo` | **Yes** |
| Assistant Referee 1 | `ar1` | No |
| Assistant Referee 2 | `ar2` | No |
| Number 4 | `no4` | No |

A match can proceed through the pipeline with **only MO** filled. Assigner may add AR1/AR2/No.4 at any time before kickoff (subject to confirmation + visibility rules).

### 6.3 Per-slot assignment status

| Status | Meaning |
|--------|---------|
| `empty` | Unfilled |
| `pending_internal` | Pre-assigned; not official |
| `official` | Both teams confirmed; official notified |
| `confirmed` | Official accepted details |
| `held` | Facts changed or match held; prior confirm voided |
| `declined` | Declined assignment / marked unavailable (with reason); **auto-released** |
| `released` | Cleared by assigner/system |
| `history` | Not a status — each transition appends to the slot’s **assignment history chain** (§5.7) |

**Gate:** Assignments flip from `pending_internal` → `official` only when match is `team_confirmed` (both sides).

**Team visibility gate:** Match reaches “crew visible to teams” when **any** assigned Match Official is `confirmed`.

---

## 7. Google Sheet as schedule source (system of record)

### 7.1 Model

- **The linked Google Sheet is the system of record** for match date, time, location, and team pairing.
- **Not on the Sheet:** fees, mileage rates, flight/housing flags, official PII beyond what’s already in Contacts for ops.
- Firestore holds workflow state plus **in-app fee schedule**, per-match economic overrides, and a synced cache of Sheet rows.
- **Tab A — Schedule:** one row per game.
- **Tab B — Contacts:** team admins (phone, email, identifiers).

Admin links the Sheet. **Automatic sync** keeps the app aligned when the Sheet changes.

### 7.2 Suggested schedule columns

| Column | Required | Notes |
|--------|----------|-------|
| `match_id` / stable key | Strongly recommended | Dedupe on sync |
| Date | Yes | |
| Kickoff time | Yes | Timezone — Q-G4 |
| Location / venue | Yes | |
| Home team | Yes | |
| Away team | Yes | |
| Competition / grade | Optional | |
| Notes | Optional | |
| Game number / slot | Optional | Doubleheaders |

### 7.3 Sync behavior

- **Auto sync (preferred):** Apps Script `onEdit` / timed trigger → webhook to Cloud Function, with **fallback poll** if webhook misses.
- **Additive rows** → new matches (`draft` or `pending_team_review` per release mode — Q-G5).
- **Edits to date/time/location** → `needs_reconfirmation`; hold crew; revoke team visibility until MO re-confirms after both teams re-confirm.
- **Deletes** → soft-cancel + notify (Q-G6).
- **Contacts** → upsert Team Admin records / invite targets.
- **Fully approved in-app proposals** → **write back to the Sheet** first; app then reflects via sync (same path as a manual Sheet edit).

### Sheets open items

| ID | Question | Lean |
|----|----------|------|
| Q-G2 | User OAuth vs service account? | Service account on shared sheet for open-source deploys |
| Q-G4 | Timezone handling | Store UTC; display org timezone |
| Q-G5 | Release all vs by range? | TBD |
| Q-G6 | Delete = cancel vs archive? | Soft-cancel |
| Q-G7 | CSV fallback? | Yes, for forks without Google |

---

## 8. Notifications (email + SMS from day one)

**Contact rules (locked):**

- Every user **must** provide **email** and **phone** (profile incomplete until both are set).
- Every user **must** choose **SMS opt-in: Yes or No** (explicit decision; no silent default to SMS).
- **Email notifications:** always enabled for account/workflow alerts.
- **SMS:** sent **only** if `smsOptIn === true`.
- Assigner notification matrix below uses email always; SMS follows each recipient’s opt-in.

### 8.1 Trigger matrix (v1)

| Event | Assigner | Home + Away Team Admins | Assigned official(s) |
|-------|----------|-------------------------|----------------------|
| Schedule released | — | Review request | — |
| Change proposed | **Acknowledge** CTA | Other team: **Accept/deny**; proposer: waiting | — (not a vote) |
| Other team denies proposal | Info | Proposer notified; Sheet unchanged | — |
| Proposal approved (other team + assigner) | — | — | — |
| Sheet updated (write-back or manual edit) | Alert | Reconfirm request | **Availability?** Yes/No for new facts |
| Official available on change | — | — | Re-confirm details as needed |
| Official unavailable on change (+ reason) | **Alert + reason + history chain** | “Official unavailable / being reassigned” | Auto-released |
| Game request submitted | Review CTA (approve/decline) | — | Ack / waiting |
| Game request approved | — | — (crew still hidden until MO confirms) | Assignment confirm path |
| Game request declined | — | — | Notified (+ reason if provided) |
| Both teams confirmed | Needs officials (if no MO) | Ack | — |
| Assignment becomes official | — | — (still hidden) | Confirm CTA |
| MO confirms | Optional | **Crew revealed** | Ack |
| AR/No.4 confirms | Optional | Optional update | Ack |
| Official declines assignment (+ reason) | Reassign + reason + history | “Official being reassigned” | Auto-released |
| T-72 team prompt | Escalation if overdue | Yes/No | — |
| Either team says match off | Yes | Other team | All released |
| T-72 official prompt | Escalation if overdue | — | Yes/No (availability) |
| T-72 official no (+ reason) | Reassign + history | “Official being reassigned” | Auto-released |
| Replacement MO confirms | — | Updated crew visible | — |

### Notifications open items

| ID | Question | Lean |
|----|----------|------|
| Q-N3 | Soft “tentative hold” for pre-assign? | **No** for v1 (less noise) |
| Q-N4 | Quiet hours? | Later |
| Q-N5 | Reminder cadence? | 24h then 12h before kickoff if pending |
| Q-N6 | PWA Web Push in MVP? | **No** — email/SMS first |
| Q-N7 | Can user change SMS opt-in later? | **Yes** |

**Providers (implementation lean):** Email via Resend/Postmark/SES; SMS via Twilio; orchestrated from Cloud Functions.

---

## 9. Auth, profiles, and pay display (no payouts)

### 9.1 Auth

- Sign in with **Google**
- Sign in with **Apple**
- Firebase Auth

### 9.2 Profile fields (locked)

| Field | Required? | Purpose |
|-------|-----------|---------|
| First name + last name | **Yes** | Display (joined as `displayName`); prefilled from email when guessable |
| Email | **Yes** | Auth + email notify (always); prefilled from sign-in |
| Phone | **Yes** | Contact + SMS when opted in |
| SMS opt-in | **Yes (explicit Yes/No)** | Whether to send SMS for workflow alerts |
| Home address | **Yes** (street, city, state, ZIP; apt/unit optional) | Round-trip distance; Google Address Validation / Places later |
| Self-selected roles | **Yes** (≥1 of Referee, Team Admin, CMO) | Access lenses; Scheduler/assigner stays org-granted |
| Birthday | **Yes** | Society records |
| Referee level | Optional when Referee/CMO (“I don’t know” allowed) | Assigner placement |
| Began refereeing | **Yes** when Referee or CMO | Experience signal |
| Jersey + shorts size | **Yes** when Referee or CMO | Kit ordering |
| Photo | Optional (≤5 MB JPEG/PNG/WebP); last onboarding step | Profile + assigner surfaces |

Profile onboarding is incomplete until first/last name, email, phone, SMS opt-in, home address, and at least one self-selected role are set (plus referee grade fields when Referee/CMO).

### 9.3 Match economics (display only — in-app)

- **Default fee structure** in app settings (by slot). Most games inherit it.
- **Per-match / tournament overrides** when fees differ.
- **Mileage estimate** = org rate × distance (domain-ready; deferred on match detail UI).
- **Flight provided** / **housing provided** = per-match boolean flags; **when true only**.
- Never sync fee/mileage/perk fields to the shared Sheet.
- **No payments product** — never Stripe, reimbursements, or fee payouts.

### Identity & economics open items

| ID | Question | Lean |
|----|----------|------|
| Q-I1 | Invite path for Coaches (Team Admins)? | Invite from contacts sheet + assigner invite |
| Q-I2 | Phone-only accounts (no Google/Apple)? | Not v1 |
| Q-I3 | Certification grade on profile? | **Yes** for Referee/CMO onboarding |
| Q-I4 | Multi-org membership? | **Yes** |
| Q-I5 | Block official request/confirm until home address set? | Address is an **onboarding hard gate** for everyone; raise-hand itself still does not re-check address |
| Q-$3 | Mileage formula (e.g. IRS rate vs org flat rate)? | Org-configurable rate ($/mile) — display only |
| Q-$4 | Minimum distance before mileage estimate applies? | Org setting (e.g. 0 or 30 miles) |
| Q-$5 | If flight provided, is mileage estimate suppressed? | **Lean: yes** (or show $0 with note) |
| Q-$2 | Distance unit default — miles vs km? | **Miles** |

---

## 10. MVP scope vs later

### 10.1 MVP

1. Org + roles: Assigner (Scheduler), Coach (Team Admin), Official  
2. Google Sheet link + **automatic sync** (+ CSV fallback)  
3. Contacts → team mapping  
4. Admin release for confirmation  
5. **Home + Away** confirm / reconfirm; in-app **change proposals** (other team accept + assigner ack → Sheet write-back; officials mark **availability**, not a vote)  
6. Crew assign / pre-assign: MO (required) + AR1/AR2/No.4; **assignment history chain** per slot  
7. Officialize after both teams confirm  
8. Official confirmations; **team crew visibility after MO confirms**  
9. Fact change → team reconfirm; officials availability check; **unavailable → auto-release**  
10. T-72: both teams, then each assigned official availability (+ reason on no)  
11. **Email** for all alerts; **SMS** only when user opted in (email + phone required)  
12. **Official availability ranges** + assigner overlap hints  
13. **Game requests** (official requests match → assigner approve/decline)  
14. Official/assigner match view: **fee** + flight/housing **when provided** + **Maps directions**; distance/mileage estimate deferred pending driving-distance API  
15. Role-based match lists (PatternFly UI); **Global** = Schedule / Standings / Teams; masthead **Referee/CMO | Team Admin | Scheduler**  
16. PWA installability (Android-first; iOS secondary)

### 10.2 Later

- Multi-tenant SaaS billing (org hosting — **not** official fee payouts)  
- Auto-assign / conflict AI beyond simple availability overlap  
- Native apps  
- In-app chat  
- Public fixture pages  
- PWA push  
- Third-party calendar sync (Google) for availability  

**Never:** payment processing, Stripe, fee/mileage reimbursements.

---

## 11. Technical direction (locked)

| Layer | Choice |
|-------|--------|
| App | **Vite + React + TypeScript** |
| UI | **PatternFly** |
| PWA | `vite-plugin-pwa` (Workbox) |
| Auth | **Firebase Auth** (Google + Apple) |
| Data | **Cloud Firestore** |
| Backend jobs | **Cloud Functions** (sync webhook, T-72, reminders, notify) |
| Email | Transactional provider (TBD) |
| SMS | **Twilio** (or equivalent) |
| Sheets | Google Sheets API + Apps Script webhook (+ poll fallback) |
| Hosting | Firebase Hosting **or** Vercel for the SPA; Functions on Firebase |

**Online-first + installable PWA** (not SevensManager-style offline-first). Offline read cache is optional later.

**Reuse patterns from:** SevensManager (PWA/spec style), ReflectED (docs culture), skill-n-rules / PF skills (PatternFly), Firebase skill pack as needed.

---

## 12. Non-functional requirements

| Area | Target |
|------|--------|
| Security | RBAC; teams cannot read official PII until MO-confirmed visibility gate |
| Audit | Who confirmed what / when (esp. T-72 and declines) |
| Privacy | No secrets in repo; per-deploy credentials |
| Accessibility | Mobile-first; PatternFly a11y defaults |
| Reliability | Failed SMS/email visible to assigner |
| Licensing | OSI-friendly TBD (MIT / Apache-2.0) |

---

## 13. Success criteria (first real season)

- Assigner runs a weekend without a parallel “secret crew spreadsheet” for teams  
- Teams never see officials before MO confirmation  
- Both home and away must confirm before crew is official  
- Fact changes always force reconfirm before crew is treated as confirmed again  
- T-72 reduces surprise no-shows  
- Another society can fork/deploy with docs + env template  

---

## 14. Build defaults (locked)

| ID | Locked decision |
|----|-----------------|
| **Q-A2** | “Available” on change still requires a **separate** details confirm |
| **Q-A3** | Game requests only on **released / needs-official** matches |
| **Q-A4** | Preferred crew slot on request is **required in the modal** (assigner may reassign slot) |
| **Q-P2** | Ask availability of **anyone named on a slot** (including pending_internal) |
| **Q-$2** | Distance unit default: **miles** |
| **Q-$3** | Mileage = org **$/mile** setting |
| **Q-$4** | **Minimum miles** org setting (default 0) |
| **Q-$5** | **Flight provided → mileage estimate $0** (display only) |
| **Q-G2** | Sheet access via **service account** |
| **Q-G4** | Org timezone; store UTC; default `America/Chicago` |
| **Q-G5** | Assigner can **release all** or **by date range** |
| **Q-G6** | Sheet row delete → soft-**cancel** + notify |
| **Q-S5** | Cancel and postpone both supported; postpone **holds** crew and requires reconfirm |
| **Q-C1** | AR decline: teams keep seeing MO; only that AR slot clears |
| **Q-C2** | Required AR slots by competition — **not MVP** |
| **License** | **MIT** |
| **Domain** | Rugby terms (Match Official / AR / Number 4); club contact = **Coach** (= Team Admin) |
| **Email / SMS** | Resend + Twilio; SMS only if opted in |
| **Hosting** | Firebase Hosting + Cloud Functions |
| **Payments** | **Never** — no Stripe / reimbursements |
| **Q-R6** | **Referee + CMO = one lens** (label **Referee/CMO**); Reports: Match Reports vs Coaching Reports |

---

## 15. Out of scope (v1 and forever where noted)

- **No payment processing** (forever) — fee/distance/mileage are display-only when shown  
- No Flutter/native commitment  
- No fees/pay columns on the shared Google Sheet  
- No offline-first sync / multi-tenant SaaS billing in v1  
- No separate Coach vs Team Admin products (they are one persona)  
- No separate CMO masthead role — CMO shares **Referee/CMO**; only Reports routing differs (Match vs Coaching)

---

## 16. Implementation

See [`IMPLEMENTATION_SPEC.md`](./IMPLEMENTATION_SPEC.md).

---

## Appendix A — Glossary

| Term | Definition |
|------|------------|
| Master schedule | Linked Google Sheet schedule tab (**system of record** for match facts) |
| Line item | One match row = one game |
| Crew | MO + optional AR1, AR2, Number 4 |
| Change proposal | In-app request to alter Sheet facts; requires other team accept + assigner acknowledge (officials do not approve) |
| Availability check | Official yes/no for a specific match slot (or proposed new slot); not a vote on whether facts should change |
| Availability range | Start–end datetime window for an open or blocked calendar day (org timezone) |
| Coach / Team Admin | Same club persona — confirm facts, propose changes, T-72 for their team’s matches |
| CMO | Coaching Match Official — optional match contact/slot; shares **Referee/CMO** lens. **Coaching Reports** (not club Coach) are the CMO-side report path; referees use **Match Reports** |
| Game request | Official expresses interest from **Referee → Request → Global**; assigner approves or declines. Pending lists only **active** requests (upcoming kickoff, open preferred slot) |
| Match fee (display) | Slot fee from in-app default schedule or match override; never on shared Sheet; **never paid out in-app** |
| Mileage estimate | Org rate × distance (rules may zero out under minimum or when flight provided); domain-ready, deferred on match detail UI; display only |
| Flight / housing provided | Per-match flags; shown only when true |
| Distance | Estimated travel distance from official home address to match venue |
| Standings | W/L/T and points for/against/differential from scored released matches, by gender × level |
| SMS opt-in | Required Yes/No profile choice; SMS sent only when Yes |
| Assignment history chain | Ordered per-slot log of who was assigned, confirmed, declined, or released — and why |
| Official assignment | Past both-team confirmation gate; notifies the official |
| Pending internal | Pre-assign visible only to assigner |
| MO visibility gate | Teams see crew only after Match Official confirms |
| T-72 | Reconfirm window starting 72 hours before kickoff |

## Appendix B — Related local references

| Repo | Useful for |
|------|------------|
| `sevensManager` | PWA + dual product/implementation specs |
| `ReflectED` | Docs culture; PWA skill |
| PatternFly MCP / PF skills | UI component standards |
| `skill-n-rules` | PWA + Firebase skill packs |
| `TexasRugbyReferees` | Domain context |
