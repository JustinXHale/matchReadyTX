import { defineString } from 'firebase-functions/params';

/** Public PWA origin for deep links in outbound email (match VITE_APP_ORIGIN). */
const appOriginParam = defineString('APP_ORIGIN', {
  default: 'https://matchreadytx.web.app',
});

export function appOrigin(): string {
  return appOriginParam.value().replace(/\/$/, '');
}

/** Scheduler → Schedule → Requests → Team links (approve / deny). */
export const SCHEDULER_TEAM_LINKS_PATH =
  '/scheduler/schedule/requests/team-links';

export function schedulerTeamLinksUrl(): string {
  return `${appOrigin()}${SCHEDULER_TEAM_LINKS_PATH}`;
}

/** Absolute URL to a match detail page in the MatchReadyTX PWA. */
export function matchAppUrl(matchId: string): string {
  const origin = appOrigin();
  const path = `/matches/${encodeURIComponent(matchId)}`;
  return origin ? `${origin}${path}` : path;
}
