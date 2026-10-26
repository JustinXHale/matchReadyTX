/**
 * Crew assignment / resend — client compose → notifyUser.
 * Keep in sync with functions/src/emailTemplates/assignment.ts
 */
import { mapsDirectionsUrl } from '@/services/maps';
import { matchAppUrl } from '@/services/appLinks';
import {
  formatMatchKickoffDate,
  formatMatchKickoffTime,
  DEFAULT_ORG_TIMEZONE,
} from '@/domain/matchTime';
import type { Match } from '@/domain/types';

export type EmailBody = { subject: string; text: string; html: string };
export type AssignmentCrewMate = { role: string; name: string };

function formatWhen(iso: string): string {
  const date = formatMatchKickoffDate(iso, DEFAULT_ORG_TIMEZONE);
  const time = formatMatchKickoffTime(iso, DEFAULT_ORG_TIMEZONE);
  return time ? `${date} at ${time}` : date;
}

function matchFactsText(match: Match): string {
  const address = match.venueAddress?.trim() || '';
  const maps = mapsDirectionsUrl({
    name: match.venueName,
    address: address || undefined,
    lat: match.venueLat,
    lng: match.venueLng,
  });
  return [
    `Home: ${match.homeTeamName}`,
    `Away: ${match.awayTeamName}`,
    `When: ${formatWhen(match.kickoffAt)}`,
    `Venue: ${match.venueName}`,
    address ? `Address: ${address}` : '',
    maps ? `Maps: ${maps}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function matchFactsHtml(match: Match): string {
  const address = match.venueAddress?.trim() || '';
  const maps = mapsDirectionsUrl({
    name: match.venueName,
    address: address || undefined,
    lat: match.venueLat,
    lng: match.venueLng,
  });
  const mapsLine = maps
    ? `<br/><strong>Maps:</strong> <a href="${maps}">Open in Google Maps</a>`
    : '';
  return `<p><strong>Home:</strong> ${match.homeTeamName}<br/>
<strong>Away:</strong> ${match.awayTeamName}<br/>
<strong>When:</strong> ${formatWhen(match.kickoffAt)}<br/>
<strong>Venue:</strong> ${match.venueName}${
    address ? `<br/><strong>Address:</strong> ${address}` : ''
  }${mapsLine}</p>`;
}

function crewOthersText(others: AssignmentCrewMate[]): string {
  if (others.length === 0) return '';
  return [
    'Also assigned:',
    ...others.map((o) => `· ${o.role}: ${o.name}`),
  ].join('\n');
}

function crewOthersHtml(others: AssignmentCrewMate[]): string {
  if (others.length === 0) return '';
  const items = others
    .map((o) => `<li><strong>${o.role}:</strong> ${o.name}</li>`)
    .join('');
  return `<p><strong>Also assigned:</strong></p><ul>${items}</ul>`;
}

export function assignmentEmailBody(opts: {
  match: Match;
  roleLabel: string;
  otherCrew?: AssignmentCrewMate[];
}): EmailBody {
  const { match, roleLabel, otherCrew = [] } = opts;
  const fixture = `${match.homeTeamName} vs ${match.awayTeamName}`;
  const matchUrl = matchAppUrl(match.id);
  const when = formatWhen(match.kickoffAt);
  const othersText = crewOthersText(otherCrew);

  const text = [
    `You've been assigned as ${roleLabel} for ${fixture}.`,
    '',
    matchFactsText(match),
    othersText ? '' : null,
    othersText || null,
    '',
    `Open in MatchReadyTX: ${matchUrl}`,
    '',
    'Open MatchReadyTX to review and confirm your assignment.',
  ]
    .filter((line) => line != null)
    .join('\n');

  const html = `<p>You've been assigned as <strong>${roleLabel}</strong> for <strong>${fixture}</strong>.</p>
${matchFactsHtml(match)}
${crewOthersHtml(otherCrew)}
<p><a href="${matchUrl}">Open this match in MatchReadyTX</a></p>
<p style="color:#757575;font-size:13px;">If you are not signed in, you will be asked to log in first, then taken to the match.</p>
<p>Open MatchReadyTX to review and confirm your assignment.</p>`;

  return {
    subject: when
      ? `Assigned: ${fixture} on ${when}`
      : `Assigned: ${fixture}`,
    text,
    html,
  };
}

export function unassignmentEmailBody(opts: {
  match: Match;
  roleLabel: string;
}): EmailBody {
  const { match, roleLabel } = opts;
  const fixture = `${match.homeTeamName} vs ${match.awayTeamName}`;
  const matchUrl = matchAppUrl(match.id);
  const when = formatWhen(match.kickoffAt);

  const text = [
    `You've been removed as ${roleLabel} for ${fixture}.`,
    '',
    matchFactsText(match),
    '',
    `Open in MatchReadyTX: ${matchUrl}`,
    '',
    'You no longer need to work this match. Open MatchReadyTX if you have questions.',
  ].join('\n');

  const html = `<p>You've been removed as <strong>${roleLabel}</strong> for <strong>${fixture}</strong>.</p>
${matchFactsHtml(match)}
<p><a href="${matchUrl}">Open this match in MatchReadyTX</a></p>
<p style="color:#757575;font-size:13px;">If you are not signed in, you will be asked to log in first, then taken to the match.</p>
<p>You no longer need to work this match. Open MatchReadyTX if you have questions.</p>`;

  return {
    subject: when
      ? `Unassigned: ${fixture} on ${when}`
      : `Unassigned: ${fixture}`,
    text,
    html,
  };
}
