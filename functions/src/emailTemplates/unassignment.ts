/**
 * Official removed from a crew / CMO slot.
 */
import {
  formatKickoffDateTime,
  matchFactsHtml,
  matchFactsText,
  matchLinkHtml,
  type EmailBody,
  type MatchEmailFacts,
} from './shared';

export function unassignmentEmailBody(opts: {
  match: MatchEmailFacts;
  roleLabel: string;
  matchUrl: string;
}): EmailBody {
  const { match, roleLabel, matchUrl } = opts;
  const fixture = `${match.homeTeamName} vs ${match.awayTeamName}`;
  const when = formatKickoffDateTime(match.kickoffAt);
  const subject = when
    ? `Unassigned: ${fixture} on ${when}`
    : `Unassigned: ${fixture}`;

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
${matchLinkHtml(matchUrl)}
<p>You no longer need to work this match. Open MatchReadyTX if you have questions.</p>`;

  return { subject, text, html };
}
