/**
 * Email templates for match notifications.
 */

export type MatchChangeType = 'time' | 'venue' | 'status' | 'details';

export type MatchEmailFacts = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string;
  venueName: string;
  venueAddress?: string;
  venueLat?: number;
  venueLng?: number;
  status: string;
};

export type MatchChangeDetails = {
  oldKickoffAt?: string;
  newKickoffAt?: string;
  oldVenueName?: string;
  newVenueName?: string;
  oldVenueAddress?: string;
  newVenueAddress?: string;
  newStatus?: string;
};

function formatKickoffDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

function mapsDirectionsUrl(opts: {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}): string | null {
  if (
    typeof opts.lat === 'number' &&
    typeof opts.lng === 'number' &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng)
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${opts.lat},${opts.lng}`;
  }
  const query = opts.address?.trim() || opts.name;
  if (!query) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

function subjectSuffix(changeType: MatchChangeType): string {
  if (changeType === 'time') return 'Time Changed';
  if (changeType === 'venue') return 'Venue Changed';
  if (changeType === 'status') return 'Status Update';
  return 'Details Changed';
}

export function matchChangeEmailBody(opts: {
  changeType: MatchChangeType;
  match: MatchEmailFacts;
  changes: MatchChangeDetails;
  recipientType: 'crew' | 'team';
  matchUrl: string;
}): { subject: string; text: string; html: string } {
  const { changeType, match, changes, recipientType, matchUrl } = opts;

  const fixture = `${match.homeTeamName} vs ${match.awayTeamName}`;
  const mapsUrl = mapsDirectionsUrl({
    name: match.venueName,
    address: match.venueAddress,
    lat: match.venueLat,
    lng: match.venueLng,
  });

  const subject = `Match Change: ${fixture} - ${subjectSuffix(changeType)}`;

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

  const currentDetails = [
    `Home: ${match.homeTeamName}`,
    `Away: ${match.awayTeamName}`,
    `When: ${formatKickoffDateTime(match.kickoffAt)}`,
    `Venue: ${match.venueName}`,
  ];
  if (match.venueAddress) {
    currentDetails.push(`Address: ${match.venueAddress}`);
  }
  if (mapsUrl) {
    currentDetails.push(`Maps: ${mapsUrl}`);
  }

  const currentDetailsHtml = `<p>
    <strong>Home:</strong> ${match.homeTeamName}<br/>
    <strong>Away:</strong> ${match.awayTeamName}<br/>
    <strong>When:</strong> ${formatKickoffDateTime(match.kickoffAt)}<br/>
    <strong>Venue:</strong> ${match.venueName}${
      match.venueAddress ? `<br/><strong>Address:</strong> ${match.venueAddress}` : ''
    }${
      mapsUrl
        ? `<br/><strong>Maps:</strong> <a href="${mapsUrl}">Open in Google Maps</a>`
        : ''
    }
  </p>`;

  const ctaText =
    recipientType === 'crew'
      ? 'Please confirm you can still work this match by opening MatchReadyTX and reviewing the updated details.'
      : 'Please confirm your team received this change by opening MatchReadyTX and reviewing the updated details.';

  const text = [
    `Match details have changed for ${fixture}.`,
    '',
    ...changeSummary,
    '',
    'Current match details:',
    ...currentDetails,
    '',
    ctaText,
    '',
    `Open match: ${matchUrl}`,
    '',
    'If you have any questions, please contact the scheduler.',
  ].join('\n');

  const html = `
<h2>Match Details Changed</h2>
<p><strong>${fixture}</strong></p>

${changeSummaryHtml.join('\n')}

<h3>Current Match Details</h3>
${currentDetailsHtml}

<p>${ctaText}</p>

<p>
  <a href="${matchUrl}" style="display:inline-block;background-color:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;margin:16px 0;">
    Open Match in MatchReadyTX
  </a>
</p>

<p style="color:#757575;font-size:13px;">
  If you are not signed in, you will be asked to log in first, then taken to the match.
</p>

<p style="color:#757575;font-size:13px;">
  If you have any questions, please contact the scheduler.
</p>
`;

  return { subject, text, html };
}
