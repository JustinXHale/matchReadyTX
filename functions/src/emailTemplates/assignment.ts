/**
 * Crew assignment / resend confirmation.
 * Client currently composes via notifyUser; keep this as the Functions-side source of truth.
 */
import {
  formatKickoffDateTime,
  matchFactsHtml,
  matchFactsText,
  matchLinkHtml,
  type EmailBody,
  type MatchEmailFacts,
} from './shared';

export type AssignmentCrewMate = { role: string; name: string };

function subjectWithWhen(
  prefix: 'Assigned' | 'Unassigned',
  match: MatchEmailFacts,
): string {
  const fixture = `${match.homeTeamName} vs ${match.awayTeamName}`;
  const when = formatKickoffDateTime(match.kickoffAt);
  return when
    ? `${prefix}: ${fixture} on ${when}`
    : `${prefix}: ${fixture}`;
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
  match: MatchEmailFacts;
  roleLabel: string;
  matchUrl: string;
  otherCrew?: AssignmentCrewMate[];
}): EmailBody {
  const { match, roleLabel, matchUrl, otherCrew = [] } = opts;
  const fixture = `${match.homeTeamName} vs ${match.awayTeamName}`;
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
${matchLinkHtml(matchUrl)}
<p>Open MatchReadyTX to review and confirm your assignment.</p>`;

  return {
    subject: subjectWithWhen('Assigned', match),
    text,
    html,
  };
}
