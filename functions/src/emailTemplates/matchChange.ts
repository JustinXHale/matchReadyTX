/**
 * Match change notification — time, venue, details, or status.
 * Triggered after assigner applies a proposal (or notifyMatchChangeCallable).
 */
import {
  formatKickoffDateTime,
  matchFactsHtml,
  matchFactsText,
  matchLinkHtml,
  type EmailBody,
  type MatchEmailFacts,
} from './shared';

export type MatchChangeType = 'time' | 'venue' | 'status' | 'details';

export type MatchChangeDetails = {
  oldKickoffAt?: string;
  newKickoffAt?: string;
  oldVenueName?: string;
  newVenueName?: string;
  oldVenueAddress?: string;
  newVenueAddress?: string;
  newStatus?: string;
};

function subjectSuffix(
  changeType: MatchChangeType,
  newStatus?: string,
): string {
  if (changeType === 'time') return 'Time Changed';
  if (changeType === 'venue') return 'Venue Changed';
  if (changeType === 'status') {
    if (newStatus === 'cancelled') return 'Cancelled';
    if (newStatus === 'postponed') return 'Postponed';
    return 'Status Update';
  }
  return 'Details Changed';
}

export function matchChangeEmailBody(opts: {
  changeType: MatchChangeType;
  match: MatchEmailFacts;
  changes: MatchChangeDetails;
  recipientType: 'crew' | 'team';
  matchUrl: string;
}): EmailBody {
  const { changeType, match, changes, recipientType, matchUrl } = opts;

  const fixture = `${match.homeTeamName} vs ${match.awayTeamName}`;
  const subject = `Match Change: ${fixture} - ${subjectSuffix(changeType, changes.newStatus)}`;

  const changeSummary: string[] = [];
  const changeSummaryHtml: string[] = [];

  if (changes.oldKickoffAt && changes.newKickoffAt) {
    changeSummary.push(
      `Kickoff time changed:\n  From: ${formatKickoffDateTime(changes.oldKickoffAt)}\n  To: ${formatKickoffDateTime(changes.newKickoffAt)}`,
    );
    changeSummaryHtml.push(
      `<p><strong>Kickoff time changed:</strong><br/>
      <span style="text-decoration:line-through;color:#757575;">From: ${formatKickoffDateTime(changes.oldKickoffAt)}</span><br/>
      <strong style="color:#DC2626;">To: ${formatKickoffDateTime(changes.newKickoffAt)}</strong></p>`,
    );
  }

  if (changes.oldVenueName && changes.newVenueName) {
    changeSummary.push(
      `Venue changed:\n  From: ${changes.oldVenueName}\n  To: ${changes.newVenueName}`,
    );
    changeSummaryHtml.push(
      `<p><strong>Venue changed:</strong><br/>
      <span style="text-decoration:line-through;color:#757575;">From: ${changes.oldVenueName}</span><br/>
      <strong style="color:#DC2626;">To: ${changes.newVenueName}</strong></p>`,
    );
  }
  if (changes.oldVenueAddress && changes.newVenueAddress) {
    changeSummary.push(
      `Address changed:\n  From: ${changes.oldVenueAddress}\n  To: ${changes.newVenueAddress}`,
    );
    changeSummaryHtml.push(
      `<p><strong>Address changed:</strong><br/>
      <span style="text-decoration:line-through;color:#757575;">From: ${changes.oldVenueAddress}</span><br/>
      <strong style="color:#DC2626;">To: ${changes.newVenueAddress}</strong></p>`,
    );
  }

  if (changes.newStatus) {
    const statusLabel =
      changes.newStatus === 'cancelled'
        ? 'CANCELLED'
        : changes.newStatus === 'postponed'
          ? 'POSTPONED'
          : changes.newStatus.toUpperCase();
    changeSummary.push(`Match status: ${statusLabel}`);
    changeSummaryHtml.push(
      `<p><strong style="color:#DC2626;">Match status: ${statusLabel}</strong></p>`,
    );
  }

  const isCancelled = changes.newStatus === 'cancelled';
  const isPostponed = changes.newStatus === 'postponed';
  const ctaText = isCancelled
    ? recipientType === 'crew'
      ? 'This appointment is cancelled. You are no longer required for this match. Open MatchReadyTX if you need details.'
      : 'This match has been cancelled. Open MatchReadyTX if you need details or have questions for the scheduler.'
    : isPostponed
      ? recipientType === 'crew'
        ? 'This match is postponed. Please open MatchReadyTX to review details and reconfirm when a new time is set.'
        : 'This match has been postponed. Please open MatchReadyTX to review details and reconfirm when updated.'
      : recipientType === 'crew'
        ? 'Please confirm you can still work this match by opening MatchReadyTX and reviewing the updated details.'
        : 'Please confirm your team received this change by opening MatchReadyTX and reviewing the updated details.';

  const heading = isCancelled
    ? 'Match Cancelled'
    : isPostponed
      ? 'Match Postponed'
      : 'Match Details Changed';
  const intro = isCancelled
    ? `The following match has been cancelled: ${fixture}.`
    : isPostponed
      ? `The following match has been postponed: ${fixture}.`
      : `Match details have changed for ${fixture}.`;

  const text = [
    intro,
    '',
    ...changeSummary,
    '',
    'Current match details:',
    matchFactsText(match),
    '',
    ctaText,
    '',
    `Open match: ${matchUrl}`,
    '',
    'If you have any questions, please contact the scheduler.',
  ].join('\n');

  const html = `
<h2>${heading}</h2>
<p><strong>${fixture}</strong></p>

${changeSummaryHtml.join('\n')}

<h3>Current Match Details</h3>
${matchFactsHtml(match)}

<p>${ctaText}</p>

${matchLinkHtml(matchUrl)}

<p style="color:#757575;font-size:13px;">
  If you have any questions, please contact the scheduler.
</p>
`;

  return { subject, text, html };
}
