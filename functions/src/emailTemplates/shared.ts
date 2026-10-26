/**
 * Shared helpers for outbound email copy (Resend via enqueueMail).
 */

export type EmailBody = {
  subject: string;
  text: string;
  html: string;
};

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

export function formatKickoffDateTime(iso: string): string {
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

export function mapsDirectionsUrl(opts: {
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

export function matchFactsText(match: MatchEmailFacts): string {
  const mapsUrl = mapsDirectionsUrl({
    name: match.venueName,
    address: match.venueAddress,
    lat: match.venueLat,
    lng: match.venueLng,
  });
  const lines = [
    `Home: ${match.homeTeamName}`,
    `Away: ${match.awayTeamName}`,
    `When: ${formatKickoffDateTime(match.kickoffAt)}`,
    `Venue: ${match.venueName}`,
  ];
  if (match.venueAddress) lines.push(`Address: ${match.venueAddress}`);
  if (mapsUrl) lines.push(`Maps: ${mapsUrl}`);
  return lines.join('\n');
}

export function matchFactsHtml(match: MatchEmailFacts): string {
  const mapsUrl = mapsDirectionsUrl({
    name: match.venueName,
    address: match.venueAddress,
    lat: match.venueLat,
    lng: match.venueLng,
  });
  return `<p>
    <strong>Home:</strong> ${match.homeTeamName}<br/>
    <strong>Away:</strong> ${match.awayTeamName}<br/>
    <strong>When:</strong> ${formatKickoffDateTime(match.kickoffAt)}<br/>
    <strong>Venue:</strong> ${match.venueName}${
      match.venueAddress
        ? `<br/><strong>Address:</strong> ${match.venueAddress}`
        : ''
    }${
      mapsUrl
        ? `<br/><strong>Maps:</strong> <a href="${mapsUrl}">Open in Google Maps</a>`
        : ''
    }
  </p>`;
}

export function matchLinkHtml(matchUrl: string): string {
  return `<p>
  <a href="${matchUrl}" style="display:inline-block;background-color:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;margin:16px 0;">
    Open Match in MatchReadyTX
  </a>
</p>
<p style="color:#757575;font-size:13px;">
  If you are not signed in, you will be asked to log in first, then taken to the match.
</p>`;
}
