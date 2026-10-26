# Outbound email (MatchReadyTX)

Transactional email via **Resend** + Cloud Functions. Write a document to Firestore `mail/{id}` (Admin SDK only); `processOutboundMail` sends it and writes `delivery` status back.

SMS is deferred — email only for now.

## One-time setup

### 1. Resend account

1. Sign up at [resend.com](https://resend.com).
2. Create an API key.
3. For production: add and verify your domain, then use a From address on that domain.
4. For early testing: Resend allows `onboarding@resend.dev` as From (only delivers to the account owner’s email).

### 2. Store the secret

```bash
# From repo root
firebase functions:secrets:set RESEND_API_KEY
```

### 3. From address (optional param)

Default is `MatchReadyTX <onboarding@resend.dev>`. For a verified domain:

```bash
# functions/.env or Firebase params — see Firebase params docs
# RESEND_FROM_EMAIL=MatchReadyTX <noreply@yourdomain.com>
```

Or set the `RESEND_FROM_EMAIL` param when deploying / in Google Cloud Console for the function.

### 4. Deploy

```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions:processOutboundMail,functions:notifyUser,functions:sendTestEmail
firebase deploy --only firestore:rules
```

## Mail document shape

```ts
await db.collection('mail').add({
  to: 'ref@example.com', // or string[]
  message: {
    subject: 'T-72: confirm Austin vs Dallas',
    text: 'Please confirm in MatchReadyTX…',
    html: '<p>Please confirm in MatchReadyTX…</p>', // optional
  },
  uid: 'firebaseUid',   // optional — who this is for
  event: 't72_team',    // optional — audit tag
  createdAt: new Date().toISOString(),
  delivery: { state: 'PENDING', attempts: 0 },
});
```

After send, `delivery` becomes:

- `{ state: 'SUCCESS', messageId, attempts, updatedAt }`
- `{ state: 'ERROR', error, attempts, updatedAt }`

Clients **cannot** create `mail` docs (rules deny). Use:

| Callable | Who | What |
|----------|-----|------|
| `notifyUser` | Self or assigner | Queue email to `users/{uid}.email` |
| `sendTestEmail` | Assigner | Queue a smoke-test to yourself |

## Where templates live

Transactional copy is **in code** (not Resend dashboard Templates):

[`functions/src/emailTemplates/`](../functions/src/emailTemplates/) — server-side sends (barrel: `index.ts`).

| Module | Event(s) |
|--------|----------|
| `matchChange.ts` | `match_change_*` |
| `assignment.ts` | `assignment`, `assignment_resend` |
| `unassignment.ts` | `unassignment` |
| `gameRequestDeclined.ts` | `game_request_declined` |
| `teamLinkRequest.ts` | `team_link_request` |
| `complianceHold.ts` | `compliance_hold`, `compliance_hold_cleared` |
| `shared.ts` | Helpers |

Client-composed sends (Vite cannot import Functions) mirror assignment / compliance under [`src/domain/emailTemplates/`](../src/domain/emailTemplates/) and are used by [`liveAssignment.ts`](../src/services/liveAssignment.ts) / [`complianceHoldNotify.ts`](../src/services/complianceHoldNotify.ts).

## Assignment / unassignment copy

Subject/body/HTML for crew assign/unassign are still built in the client:

[`src/services/liveAssignment.ts`](../src/services/liveAssignment.ts)

| Event | Subject | Trigger |
|-------|---------|---------|
| `assignment` | `Assigned: {home} vs {away} on {date} at {time}` | Assign from Match Detail / raise-hand approve |
| `assignment_resend` | same subject/body | Scheduler → open assigned crew row → **Resend email** |
| `unassignment` | `Unassigned: {home} vs {away} on {date} at {time}` | Clear / remove a named official from Match Detail |

Body includes home/away, venue, **full `venueAddress`**, a **Google Maps** link when address or lat/lng exist, (on assign) any **other named crew**, and a deep link to **`/matches/{id}`** in MatchReadyTX.

Both call the `notifyUser` Cloud Function → Firestore `mail/` → Resend.

**Deep links:** Opening the match URL may require Google/Apple sign-in first; login keeps a `?next=` return path so they land on the match afterward. Set `VITE_APP_ORIGIN` (e.g. `https://your-host`) for production emails if the compose client’s origin is not the public PWA URL.

**Note:** Address completeness depends on what is stored on the match (`venueAddress`). If the sheet only has a short line (e.g. “1001 Academy”), that is what emails and Maps will use — improve the sheet/import for street + city + ZIP.

## Smoke test

1. Sign in with Google/Apple as an **assigner** (Scheduler lens).
2. Open a match → assign an official whose **profile email** is the same address as your **Resend account** (required while From is `onboarding@resend.dev`).
3. Assign yourself to a slot if that email matches.
4. Check:
   - Inbox for “Assigned: …”
   - Firestore `mail` → `delivery.state: SUCCESS`
   - Resend dashboard

To email other people, verify your own domain in Resend and set `RESEND_FROM_EMAIL`.

## Cost

Resend free tier is enough for society-scale reminders (thousands of emails/month). Cloud Functions + Firestore ops for the queue are usually within Blaze free allowances at this volume.

## Match change notifications

When match details change (time, venue, or status), all assigned crew and team contacts receive notification emails via the `notifyMatchChange` function.

### Triggers

Notifications are sent **after the assigner applies / acknowledges a change** (proposal write-back). Team requests alone do not email anyone — the assigner might still deny the request.

- `proposalWriteback` succeeds → `notifyMatchChange`
- Assigner can also call `notifyMatchChangeCallable` manually

### Email events

| Event | Recipients | Trigger |
|-------|-----------|---------|
| `match_change_time` | Assigned crew | Kickoff time changed |
| `match_change_venue` | Assigned crew | Venue name or address changed |
| `match_change_details` | Assigned crew | Time and venue both changed |
| `match_change_status` | Assigned crew | Match cancelled or postponed |
| `*_team` | Home + away `Team.contactEmails` / `contactPeople` | Same events, team copy |

Proposal snapshots use `previousKickoffAt` / `previousVenueName` / `previousVenueAddress` (not `oldKickoffAt`).

### Email content

Subject: `Match Change: {home} vs {away} - {Time Changed|Venue Changed|Status Update}`

Body includes:
- What changed (old value → new value)
- Current match details (home, away, date, time, venue, address)
- Google Maps link to venue
- Deep link to match detail page: `/matches/{id}`
- Call to action: "Please confirm you can still work/attend this match"

### Reconfirmation workflow

1. Write-back sets `needs_reconfirmation`, clears team timestamps, and puts named crew/CMO on `held`
2. Recipients open `/matches/{id}` from the email
3. Match Detail shows a banner until that person / team has acked
4. Crew confirm uses the existing assignment confirm path (`matchSelfService` / `confirmCrewSlot`) so status becomes `confirmed`, not only a timestamp
5. Teams confirm via `setTeamDetailsConfirmed` (live: `saveMatchTeamConfirmation`)
6. `needs_reconfirmation` stays until **both teams and remaining held crew** have confirmed

### Manual notification trigger

Assigners can manually trigger notifications via:

```ts
await callNotifyMatchChangeCallable({
  matchId: 'match_123',
  changeType: 'time' | 'venue' | 'status',
  changes: {
    oldKickoffAt?: '2026-10-25T18:00:00Z',
    newKickoffAt?: '2026-10-25T20:00:00Z',
    oldVenueName?: 'Old Field',
    newVenueName?: 'New Field',
    // ... other change details
  },
});
```

### Recipient filtering

- **Crew:** All assigned officials with `userId` (excludes outside appointments)
- **Teams:** All email addresses in `Team.contactEmails` for home and away teams
- **Warnings:** Logged when crew member has no email or team has no contacts

### Related functions

- `notifyMatchChange` — Core notification logic (bulk email queue)
- `notifyMatchChangeCallable` — Manual trigger (assigner-only)
- `confirmMatchChange` — Record confirmation from crew/team
- `needsReconfirmation` — Domain helper to check who needs to confirm
