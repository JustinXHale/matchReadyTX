# MatchReadyTX — Implementation specification

**Status:** Draft v1.1  
**Last updated:** 2026-07-29  
**Upstream:** [`PRD.md`](./PRD.md) wins on product conflicts.  
**Platform:** Mobile-first PWA (Vite + React + PatternFly + Firebase)

---

## 1. Stack

| Layer | Choice |
|-------|--------|
| App | Vite + React 19 + TypeScript |
| UI | PatternFly React v6 (mobile-first cards / stacked pages) |
| PWA | `vite-plugin-pwa` (install prompt + logo icons) |
| Auth | Firebase Auth (Google + Apple) |
| Data | Cloud Firestore |
| Backend | Cloud Functions (TypeScript) |
| Email | Resend (`mail/` queue → `processOutboundMail`) |
| Sheets | Service account + Apps Script webhook + poll fallback + proposal write-back |
| Hosting | Firebase Hosting |
| License | MIT |

**Not in product:** SMS, PWA push, in-app chat, multi-tenant SaaS billing, payment processing.

---

## 2. Locked product defaults

See PRD §0 and §14. Summary: Sheet = schedule SoR; fees in-app **display only (never payouts)**; dual team confirm; MO visibility gate; auto-release on unavailable; history chain; availability ranges; game requests; T-72; **email-only notifications**; **Team Admin** lens; **Referee/CMO = one lens (Q-R6)**; **Fan XOR working roles** on onboarding/profile; incomplete Members hidden except Scheduler view.

**Follow-up (not this release):** driving-distance / mileage display (home ZIP ↔ venue via Google Maps APIs). Geocode callable may still stub until then.

---

## 3. Firestore shape

```
orgs/{orgId}
  name, timezone, mileageRatePerMile, mileageMinMiles,
  defaultFees: { mo, ar1, ar2, no4 },
  sheetId?, sheetSyncedAt?

orgs/{orgId}/members/{uid}
  roles: ('assigner'|'teamAdmin'|'official'|'cmo'|'fan'|'reportAnalytics'|'judicial')[]
  teamIds?: string[]
  fanTeamIds?: string[]   // Fan favorite club id (0–1); empty + no fanTeamOther = general
  fanTeamOther?: string  // Free-text when fan picks “Other”
  joinedAt?

orgs/{orgId}/teams/{teamId}
  name, contactEmails[], contactPhones[], contactPeople[] { name?, email, phone? }

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

orgs/{orgId}/fixtureRequests/{requestId}
  … (team admin new-fixture requests)

orgs/{orgId}/teamLinkRequests/{requestId}
  requesterUserId, requesterName, requesterEmail, teamId, teamName,
  status: pending|approved|denied, autoApproved?, reviewedAt?, denyReason?

orgs/{orgId}/availability/{uid}/ranges/{rangeId}
  startAt, endAt, kind: 'available'|'blocked'

orgs/{orgId}/coachFeedback/{feedbackId}   // id = matchId_reportingTeamId
  matchId, slot: 'mo', officialUserId, officialName,
  home/away team ids+names, kickoffAt, competition?, level, score,
  scales: { breakdown, scrum, lineout, safety, communication,
            professionalism, overall } → 1|2|3|4|5 (Poor→Excellent),
  commentsOnScores?, areasDoneWell?, areasToImprove?, otherFeedback?,
  videoLink?, videoNotes?, otherCrewFeedback?,
  submitterUserId/Name/Email/Phone?, clubRole, contactAboutReport?,
  reportingTeamId, reportingTeamName,
  status: draft|submitted|declined,
  submittedAt?, edits: [{ at, byUserId, byName, action: save|submit|decline }],
  createdAt, updatedAt
  // One doc per match × reporting side (home and away each may submit).
  // Officials never read. Scheduler inbox shows submitted only.

orgs/{orgId}/matchReports/{reportId}   // id = matchReportDocId(matchId, officialId, slot)
  matchId, officialId, slot: mo|ar1|ar2|cmo, formKind?,
  status: pending|submitted, dueAt, kickoffAt, submittedAt?,
  subjectOfficialId? (CMO reports — MO user assessed),
  moPayload? | arPayload? | cmoPayload? (maps),
  orgId, createdAt, updatedAt
  // MO/AR post-match forms + CMO coaching reports (slot cmo).
  // Pending rows lazy-created when filer opens flow; not bulk-synced.

orgs/{orgId}/cardReports/{reportId}   // id = cardReportDocId(matchId, officialId)
  matchId, officialId, cards[], competitionUnion, conference?,
  matchFilmed?, homeScore?, awayScore?,
  official contact fields, additionalInfoPrivate?,
  status: draft|submitted, submittedAt?, orgId, createdAt, updatedAt
  // MO card incidents — created on submit (no pending doc).

orgs/{orgId}/judicialCases/{incidentId}
  reportId, matchId, conference, color, player snapshot, lawIds,
  status: recorded|pending|upheld|dismissed|reduced|summary_judgment,
  sanctionMatches?, sanctionNote?, ruledAt?, ruledByUid?,
  orgId, createdAt, updatedAt
  // One case per card (second offense = second case). Client-created on submit.

orgs/{orgId}/judicialCases/{incidentId}/comments/{commentId}
  authorUid, authorName, body, createdAt  // append-only; judicial + assigner

orgs/{orgId}/judicialSettings/dashboard
  recommendations[], updatedAt, updatedByUid?

users/{uid}
  firstName, lastName, displayName (derived), email, phone,
  smsOptIn (dormant; always false — no SMS product),
  homeStreet, homeUnit?, homeCity, homeRegion, homePostalCode,
  homeAddress (composed), homeLat?, homeLng?,
  birthday?, refereeLevel?, assessedLevel?, refereeingSince?,
  jerseySize?, shortsSize?, photoUrl?,
  profileComplete, roles: assigner|teamAdmin|official|cmo|fan|reportAnalytics|judicial,
  fanTeamIds?: string[],
  fanTeamOther?: string

mail/{mailId}   // outbound queue — Admin SDK only; see docs/EMAIL.md
  to, message: { subject, text?, html? }, uid?, event?, delivery?
```

**Onboarding (`/onboarding`):** progressive one-question flow. **Fan XOR** Referee/Team Admin/CMO — picking Fan disables working roles and vice versa. Team Admin adds a **teams** multi-select (individual sides). Fan-only: roles → names → favorite team → photo. Working roles: phone + birthday; address + kit when Referee/CMO; referee level optional (“I don’t know”). Pending Team Admin (no `teamIds`) browses Fan until first club is approved.

**Members directory:** incomplete profiles (`profileComplete === false`) are listed only in Scheduler view (Incomplete badge). Non-schedulers see complete members only. Fan favorite team shown under Fan badge when set.

### Match status values

`draft` | `pending_team_review` | `change_proposed` | `team_confirmed` | `crew_pending` | `mo_confirmed` | `crew_confirmed` | `t72_team_pending` | `t72_officials_pending` | `locked_confirmed` | `needs_reconfirmation` | `needs_reassignment` | `cancelled` | `postponed`

### Crew slot status

`empty` | `pending_internal` | `official` | `confirmed` | `held` | `declined` | `released`

---

## 4. Security rules (intent)

- Auth required for all reads/writes except public health.
- Org members may read fellow members’ `users/{uid}` profiles for the directory (names/roles). Address remains UI-gated for Scheduler.
- Team admins: read matches for their teams; write confirmations/proposals for those matches; **cannot** read crew `userId`/PII until match status ≥ `mo_confirmed` (or field `crewVisibleToTeams`).
- Officials: read own assignments + open requestable matches (facts + economics); write own confirm/availability/requests.
- Assigner: full org read/write for scheduling.
- **Coach feedback** (`coachFeedback`): assigner and `reportAnalytics` read all; Team Admins read/update when `reportingTeamId` is in their `teamIds` (club-owned, one doc per match×side). Org members may read a **submitted** report only when the Scheduler has set `publicOnProfile == true` (shown on the official’s profile; submitter phone/email stay off that view). Create/update binds match facts via `get(matches/…)` (home/away, kickoff, crew-visible status) and requires doc id `matchId_reportingTeamId`. Team Admin writes must not change `publicOnProfile`. Assigners may update only `publicOnProfile` + `updatedAt` on a submitted report.
- **Match reports** (`matchReports`): filer (`officialId`) read/write own; assigner and `reportAnalytics` read all; MO may read CMO reports where `subjectOfficialId == auth.uid`. Any org member may read **submitted CMO** reports (`slot == 'cmo'`, `status == 'submitted'`) for public profile write-ups. Pending MO/AR/CMO and all card reports stay private. Pending create + submit with shape validation; assigner delete.
- **Card reports** (`cardReports`): filer MO read/write own after kickoff; assigner, `reportAnalytics`, and `judicial` read all; assigner delete.
- **`reportAnalytics` role:** Scheduler grants on member profile only (not self-assignable, not in onboarding). Enables Insights bottom-nav tab and global read of coach feedback + reports.
- **`judicial` role:** Scheduler or existing Judicial grants (Members checkbox for assigner; `setJudicialRole` callable for Judicial-only). Not self-assignable. Unlocks Judicial lens: dashboard, cases, comments, rulings. Phone required. Cases and comments are assigner/judicial only — not visible to the filing referee, teams, or Insights. Filing MOs may **create** `judicialCases` for their own submitted card report (recorded/pending only); rulings are assigner/judicial updates.

---

## 5. Mobile IA (routes)

| Path | Role / notes |
|------|------|
| `/` | Redirect → `/referee/appointments` |
| `/login` | Google / Apple (demo: Try demo); PWA install nudge |
| `/onboarding` | Multi-step profile gate; Fan XOR working roles |
| `/profile` | Edit contact, address, roles, grade, optional photo |
| `/about` | Informative page + PWA install nudge |
| `/referee` | Redirect → appointments |
| `/referee/availability` | Official availability calendar (under Referee lens) |
| `/referee/appointments` | Own assignments; urgent strip for pending accept |
| `/referee/request/pending` | Own active raise-hand requests |
| `/referee/request/global` | Open games + raise-hand |
| `/referee/reports/match` | Match Reports |
| `/referee/reports/coaching` | Coaching Reports |
| `/global/*` | Schedule / Standings / Teams |
| `/members` | Society directory (incomplete: Scheduler only) |
| `/team-admin` | Team Admin Schedule (confirm upcoming) |
| `/team-admin/report` | Optional MO feedback after past games (tab: Referee Feedback) |
| `/team-admin/report/:matchId` | Feedback form (create / edit own) |
| `/team-admin/request-fixture` | Request a new fixture |
| `/scheduler/queues` | Assigner inbox |
| `/scheduler/schedule` | All-org match browse |
| `/scheduler/feedback` | Coach feedback inbox (assigner-only) |
| `/scheduler/feedback/:id` | Feedback detail |
| `/insights` | Insights overview (reportAnalytics) — pyramid + global stats |
| `/insights/coach-feedback` | All submitted coach feedback |
| `/insights/coach-feedback/:id` | Feedback detail (read-only) |
| `/insights/cmo-reports` | Submitted CMO coaching reports |
| `/scheduler/org` | Sheet link/sync, CSV, release, fees |
| `/judicial` | Executive discipline dashboard + print one-pager |
| `/judicial/cases` | Card caseload |
| `/judicial/cases/:incidentId` | Case detail, comments, ruling |
| `/matches/:id` | Canonical match detail |

**Bottom nav (by lens):** About · (Referee/CMO \| Team Admin \| Scheduler \| Judicial home) · Global (except Judicial lens) · **Insights** (when assigner/`reportAnalytics`) · Profile — Members lives under Info sub-nav for all lenses.  

**Judicial top tabs:** Dashboard · Cases.  

**Referee/CMO top tabs:** Availability · Appointments · Request · Reports.  

**Team Admin top tabs:** Schedule · Report.

**Scheduler top tabs:** Queues · Schedule · Feedback · Upload.

**Global top tabs:** Schedule · Standings · Teams.

**Masthead:** Logo + brand; org-local date · time; Demo badge; role switcher from **available lenses** (includes Fan when held).

**PWA:** Manifest icons from app logo; install card on login/About (Chrome `beforeinstallprompt` / iOS Add to Home Screen tip).

---

## 6. Sheet contract

**Schedule columns:** `match_id`, `date`, `kickoff_time`, `location`, `home_team`, `away_team`, `competition?`, `level?`, `gender?`, `notes?`, `title?`, `status?`  
**Contacts:** `team_name`, `email`, `phone`  
**Locations:** `abbreviation`, `name?` (full team name), `competition?` (conference), `gender?` (optional if competition encodes men/women), address fields  
**Never on Sheet:** fees, mileage, flight, housing, official names for pay.

### Sync & write-back

| Path | Behavior |
|------|----------|
| `syncSheet` (callable) | Assigner-triggered full ingest via `runSheetSync` |
| `sheetPoll` | Daily (~06:00 UTC) → `runSheetSync` when `sheetId` + SA present |
| `sheetWebhook` | Apps Script push → same `runSheetSync` ingest |
| `proposalWriteback` | After other-team accept + assigner ack → update Schedule row + Firestore match facts |
| `submitTeamLinkRequests` | Onboarding/profile: auto-approve via Contacts or create pending |
| `reviewTeamLinkRequest` | Assigner or club TA: approve (Contacts append) / deny |

See also [`SHEET_SYNC.md`](./SHEET_SYNC.md).

---

## 7. Cloud Functions

| Function | Trigger |
|----------|---------|
| `syncSheet` | Callable (assigner) |
| `sheetWebhook` | HTTPS from Apps Script → full sync |
| `sheetPoll` | Scheduled daily (~06:00 UTC); assigner manual Sync anytime |
| `proposalWriteback` | Callable on proposal completion |
| `submitTeamLinkRequests` | Callable (self) |
| `reviewTeamLinkRequest` | Callable (assigner or team TA) |
| `notify` / mail queue | Email outbound |
| `t72Sweep` | Hourly scheduled |
| `geocodeAddress` | Callable — stub until Maps mileage walkthrough |
| `approveFixtureRequest` | Assigner tooling |
| `matchSelfService` | Callable — official confirm/decline + T-72 (Admin SDK crew write) |
| `deleteOrgMemberAccount` | Assigner |
| `setJudicialRole` | Assigner or Judicial — grant/revoke `judicial` |

---

## 8. Phased delivery

Aligned with build plan Phases 0–7. Mileage/Maps Distance Matrix is a deliberate follow-up after Sheet SoR write-back + auto sync are solid.
