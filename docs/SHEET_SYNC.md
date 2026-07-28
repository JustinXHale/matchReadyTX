# Sheet sync (MatchReadyTX)

Pull the society **Schedule** Google Sheet into Firestore via Cloud Function `syncSheet`. The app then listens to `orgs/{orgId}/matches`.

## One-time setup

### 1. Service account

1. Google Cloud Console → project **matchreadytx** → **IAM & Admin** → **Service Accounts**.
2. Create (or use) a service account, e.g. `sheet-sync@matchreadytx.iam.gserviceaccount.com`.
3. Create a JSON key → download. **Do not commit** the key (keep under `keys/`, already gitignored patterns).
4. Enable **Google Sheets API** for the project.

### 2. Share the workbook

In Google Sheets → **Share** → add the service account **email** as **Editor** (needed for fixture-request write-back and future proposal write-back). **Viewer** is enough for read-only sync only.

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
firebase deploy --only functions:syncSheet,functions:sheetPoll,functions:approveFixtureRequest
```

Always run `npm run build` in `functions/` before deploy — Firebase uploads `lib/`, not `src/`.

Optional env for poll fallback:

```bash
firebase functions:config:set  # prefer params / .env for Functions v2
# Or set DEFAULT_ORG_ID=lonestar in the Functions runtime environment
```

### 5. Auth domain (phone / LAN)

Firebase Console → Authentication → Settings → **Authorized domains** → add your LAN host (e.g. `192.168.1.121`) when testing on a physical device.

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

Optional tabs:

- **Contacts** — `team_name`, `email`, `phone` → team contact emails
- **Locations** — `abbreviation` (+ optional `gender`, `venue_name`, `address`, `lat`, `lng`) joined on Schedule `location`

Timezone for kickoff: America/Chicago (−06:00) for v1.

## In the app

1. Sign in as an **assigner** (first org member is assigner + official).
2. **Scheduler → Upload** → paste Sheet link → **Sync schedule**.
3. **Release all drafts** (or a date range) so teams can confirm.

While signed in with Firebase (**Live**), Global / Scheduler lists come from Firestore (not demo seed). Open **/demo** or use the masthead **Demo | Live** toggle for the seed showcase — it never mixes with your live org.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `permission-denied` / cannot read Sheet | Share workbook with the service account email |
| `GOOGLE_SERVICE_ACCOUNT_JSON secret is not set` | Run `firebase functions:secrets:set` and redeploy |
| `Only assigners can sync` | Grant `assigner` on `orgs/lonestar/members/{uid}` |
| Sync OK but empty UI | Confirm you’re on **Live** (not Demo); hard-refresh after sync |
| `auth/unauthorized-domain` on phone | Add LAN IP to Authorized domains |
