# Email templates (Cloud Functions → Resend)

One file per notification type. Each export builds `{ subject, text, html }` for `enqueueMail`.

| File | Event | Used by |
|------|-------|---------|
| `matchChange.ts` | `match_change_*` | `notifyMatchChange` |
| `assignment.ts` | `assignment` / `assignment_resend` | Ready for Functions; client uses `src/domain/emailTemplates` today |
| `unassignment.ts` | `unassignment` | Same |
| `gameRequestDeclined.ts` | `game_request_declined` | `raiseHandFulfillment` |
| `teamLinkRequest.ts` | `team_link_request` | `teamLinkRequests` |
| `complianceHold.ts` | `compliance_hold` / `_cleared` | Ready for Functions; client uses `src/domain/emailTemplates` today |
| `shared.ts` | — | Kickoff format, Maps, match facts |

Import via the barrel:

```ts
import { matchChangeEmailBody, teamLinkRequestEmailBody } from './emailTemplates';
```

Client cannot import this package; keep assignment / compliance copy mirrored under `src/domain/emailTemplates/` until those sends move server-side.
