# Sheet sync (MatchReadyTX)

Pull the society **Schedule** Google Sheet into Firestore via Cloud Function `syncSheet`. The app then listens to `orgs/{orgId}/matches`. Fully approved change proposals write facts **back** to the Sheet via `proposalWriteback`.

## One-time setup

### 1. Service account

1. Google Cloud Console → project **matchreadytx** → **IAM & Admin** → **Service Accounts**.
2. Create (or use) a service account, e.g. `sheet-sync@matchreadytx.iam.gserviceaccount.com`.
3. Create a JSON key → download. **Do not commit** the key (keep under `keys/`, already gitignored patterns).
4. Enable **Google Sheets API** for the project.

### 2. Share the workbook

In Google Sheets → **Share** → add the service account **email** as **Editor** (needed for fixture-request append and proposal write-back). **Viewer** is enough for read-only sync only.

### 3. Store the secret for Functions

```bash
# From repo root — paste the full JSON as the secret value when prompted
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_JSON
```

Or:

```bash
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_JSON --data-file=keys/your-sa.json
```

### 4. Deploy Functions

```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions:syncSheet,functions:sheetPoll,functions:sheetWebhook,functions:proposalWriteback,functions:approveFixtureRequest,functions:submitTeamLinkRequests,functions:reviewTeamLinkRequest,firestore:rules
```

Always run `npm run build` in `functions/` before deploy — Firebase uploads `lib/`, not `src/`.

Optional secrets / params:

- `DEFAULT_ORG_ID=lonestar` (Functions runtime)
- `SHEET_ID` fallback if org doc has no `sheetId`
- `SHEET_WEBHOOK_SECRET` — **required** after deploy; Apps Script must send header `x-webhook-secret`

### Webhook URL + secret (Apps Script)

1. Firebase Console → **Functions** → `sheetWebhook` → copy the **Trigger URL** (e.g. `https://sheetwebhook-….run.app`).
2. Create a long random string (password generator). This is **not** auto-created — you choose it.
3. Store it:

```bash
firebase functions:secrets:set SHEET_WEBHOOK_SECRET
# paste the same random string when prompted
firebase deploy --only functions:sheetWebhook
```

4. In the Google Sheet → **Extensions → Apps Script** → **Project settings → Script properties**:

| Property | Value |
|----------|--------|
| `WEBHOOK_URL` | `sheetWebhook` trigger URL from step 1 |
| `WEBHOOK_SECRET` | same string as step 2 |
| `ORG_ID` | `lonestar` (or your `VITE_DEFAULT_ORG_ID`) |

The function name `sheetWebhook` is not the secret — only the shared `WEBHOOK_SECRET` / `SHEET_WEBHOOK_SECRET` value authenticates calls.

### 5. Auth domain (phone / LAN)

Firebase Console → Authentication → Settings → **Authorized domains** → add your LAN host (e.g. `192.168.1.121`) when testing on a physical device.

## Sync paths

| Path | Trigger | Behavior |
|------|---------|----------|
| `syncSheet` | Assigner → Upload → Sync | Full Schedule (+ Contacts / Locations) → Firestore |
| `sheetPoll` | Daily (~06:00 UTC) | Fallback ingest when `sheetId` + SA present; use Upload → Sync anytime |
| `sheetWebhook` | Apps Script `onEdit` / timed | Same ingest (no longer timestamp-only) |
| `proposalWriteback` | Assigner ack after other-team accept | Updates Schedule row + match facts |
| `submitTeamLinkRequests` | Onboarding / Profile | Auto-approve when email on Contacts; else pending |
| `reviewTeamLinkRequest` | Assigner or Team Admin for club | Approve → Contacts append + `teamIds`; deny may strip TA / Fan |

Failed poll / webhook / sync / write-back sets `orgs/{orgId}.sheetSyncError` (cleared on success). Scheduler → Upload shows last sync time and that error.

## Sheet contract

**Tab name:** `Schedule` (required)

| Column | Required |
|--------|----------|
| `match_id` | yes |
| `date` | yes (YYYY-MM-DD) |
| `kickoff_time` | yes preferred (`time` / `kickoff` also accepted). Empty → defaults to **15:00** |
| `location` | yes |
| `home_team` | yes |
| `away_team` | yes |
| `competition` | no |
| `level` | no |
| `gender` | no (men/women) |
| `notes` | no |
| `status` | no (`CANCELLED` marks cancelled) |

App-created fixtures (Team Admin request → assigner approve) use `match_id` values like `APP-20260728-ABC123` and append a Schedule row (plus a Locations row for venue address).

Proposal write-back finds the row by `match_id` / `sheetRowKey` and updates date, kickoff time, location (and related columns when present).

Optional tabs:

- **Contacts** — `team_name`, `email`, `phone` → team contact emails
- **Locations** — `abbreviation` (+ optional `gender`, `venue_name`, `address`, `lat`, `lng`) joined on Schedule `location`

Timezone for kickoff: America/Chicago (−06:00) for v1.

## Apps Script push

See [`docs/apps-script-sheet-webhook.gs`](apps-script-sheet-webhook.gs). Set script properties `WEBHOOK_URL`, `WEBHOOK_SECRET`, `ORG_ID`. The webhook runs full `runSheetSync` (rows in the body are optional; the function re-reads the Sheet).

## In the app

1. Sign in as an **assigner** (first org member is assigner + official).
2. **Scheduler → Upload** → paste Sheet link → **Sync schedule**.
3. **Release all drafts** (or a date range) so teams can confirm.
4. After a change proposal is accepted by the other team, **Acknowledge** as assigner to write facts back to the Schedule tab.

While signed in with Firebase (**Live**), Global / Scheduler lists come from Firestore (not demo seed). Open **/demo** or use the masthead **Demo | Live** toggle for the seed showcase — it never mixes with your live org.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `permission-denied` / cannot read Sheet | Share workbook with the service account email |
| Write-back permission error | Share as **Editor** (not Viewer only) |
| `GOOGLE_SERVICE_ACCOUNT_JSON secret is not set` | Run `firebase functions:secrets:set` and redeploy |
| `Only assigners can sync` | Grant `assigner` on `orgs/lonestar/members/{uid}` |
| Sync OK but empty UI | Confirm you’re on **Live** (not Demo); hard-refresh after sync |
| Upload shows “Last sync failed” | Read `sheetSyncError`; fix sharing / tab name / columns; Sync again |
| `auth/unauthorized-domain` on phone | Add LAN IP to Authorized domains |
| Webhook 503 | Org missing `sheetId` or SA secret not bound to `sheetWebhook` |
