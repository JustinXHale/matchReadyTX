# MatchReadyTX

Mobile-first PWA for referee match scheduling. Google Sheet is the schedule source of truth; fees and travel perks live in-app as **display only** (no payments).

Product: [`docs/PRD.md`](docs/PRD.md) · Implementation: [`docs/IMPLEMENTATION_SPEC.md`](docs/IMPLEMENTATION_SPEC.md) · Theme: [`docs/THEME.md`](docs/THEME.md)

/**Personas:** **Referee/CMO** (one lens — Match Reports vs Coaching Reports under Reports), **Coach** (= Team Admin), **Scheduler** (= Assigner control center: Queues · Schedule · Org).

## Stack

- Vite + React 19 + TypeScript
- PatternFly React v6 (mobile-first cards / bottom nav)
- Firebase Auth, Firestore, Cloud Functions, Hosting
- Resend (email)
- PWA via `vite-plugin-pwa`

## Quick start (demo showcase)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open the printed URL on a phone or narrow viewport. Use **Try demo** on the login screen (or open `/demo`) — no Firebase required. The showcase uses seed data and a tour persona; switch **Referee/CMO · Team Admin · Scheduler** in the header.

When signed in with Google/Apple, use the masthead **Demo | Live** control to compare the showcase with your real org (data never mixes).

### Suggested demo path

1. **Try demo** → header **Scheduler** → **Upload** → **Release all drafts**
2. Switch role to **Team Admin** → open match → confirm as home (or away for that club)
3. Switch to **Scheduler** → **Schedule** → open match → assign **Riley Official** as Match Official  
   *(Or: Official raises hand → Scheduler → **Queues** → Approve)*
4. **Referee/CMO** → **Appointments** → confirm assignment (badge shows pending accepts) → teams can now see the crew
5. **Global** → Schedule / Standings / Teams; open a team then a past result for scores
6. Referee → **Reports** (due badge) for match / coaching stubs
7. Scheduler → **Queues** → Notifications for the email log

### Demo surfaces worth clicking

| Area | What to notice |
|------|----------------|
| Match cards | Month + ordinal day, Men/level chips, scores or `–`, crew / raise-hand column |
| Match detail | **Where** → Maps directions; fees + flight/housing; **← Back to …**; assigner history + availability overlap |
| Scheduler Queues | Raise-hand, needs officials, T-72, notifications (badged tab) |
| Scheduler Org | Sheet ID, sync, CSV, release, full fee table |
| Request → Pending | Five seeded open requests (Alex Assigner); past kickoffs hidden |
| Header | Date · time under MatchReadyTX; Demo badge; Demo \| Live when signed in |

## Firebase production

1. Create a Firebase project; enable Google + Apple auth.
2. Set `VITE_DEMO_MODE=false` to hide the showcase (optional) and fill `VITE_FIREBASE_*` in `.env.local`.
3. Deploy rules: `firebase deploy --only firestore:rules`
4. Configure Functions secrets: `SHEET_ID`, service account, `RESEND_API_KEY`, `SHEET_WEBHOOK_SECRET`.
5. Point Apps Script `onEdit` / time trigger at `sheetWebhook`.
6. `npm run build` && `firebase deploy --only hosting,functions`

### CI (auto-deploy)

Pushing to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml) (Hosting + Firestore rules + Functions).

1. Create a CI token: `firebase login:ci` (copy the token once).
2. GitHub repo → **Settings → Secrets and variables → Actions** → add:
   - `FIREBASE_TOKEN`
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN` (`matchreadytx.web.app`), `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
3. Optional **Variables**: `VITE_DEMO_MODE` (CI defaults to `true`), `VITE_DEFAULT_ORG_ID`, `VITE_APP_ORIGIN`, `RESEND_FROM_EMAIL`.

Function secrets (Resend, sheet service account, etc.) stay in Firebase Secret Manager — not in GitHub.

## Design

Visual system mirrors **T03 / to3-app** monochrome (black & white + urgent red). See [`docs/THEME.md`](docs/THEME.md) and [`.design/theme.md`](.design/theme.md).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build + PWA assets |
| `npm test` | Vitest domain tests |
| `npm run preview` | Preview production build (test installability) |

## License

MIT
