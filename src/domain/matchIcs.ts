import type { Match } from '@/domain/types';

/** Default event length — matches do not store duration. */
export const MATCH_ICS_DURATION_MS = 2 * 60 * 60 * 1000;

export function matchHasCalendarTime(match: Pick<Match, 'kickoffAt'>): boolean {
  return !Number.isNaN(new Date(match.kickoffAt).getTime());
}

export function matchIcsSummary(match: Pick<Match, 'title' | 'homeTeamName' | 'awayTeamName'>): string {
  const titled = match.title?.trim();
  if (titled) return titled;
  return `${match.homeTeamName} vs ${match.awayTeamName}`;
}

export function matchIcsFilename(match: Pick<Match, 'id' | 'homeTeamName' | 'awayTeamName'>): string {
  const slug = `${match.homeTeamName}-vs-${match.awayTeamName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${slug || match.id}.ics`;
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function icsFold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

function formatIcsUtc(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function locationLine(
  match: Pick<Match, 'venueName' | 'venueAddress'>,
): string {
  return [match.venueName, match.venueAddress]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

/** RFC 5545 calendar for one match (snapshot — not a live feed). */
export function generateMatchIcs(
  match: Match,
  opts: { url?: string; now?: string } = {},
): string {
  const start = new Date(match.kickoffAt);
  const end = new Date(start.getTime() + MATCH_ICS_DURATION_MS);
  const stamp = opts.now ?? new Date().toISOString();
  const loc = locationLine(match);
  const url = opts.url?.trim() ?? '';
  const descParts = [`${match.homeTeamName} vs ${match.awayTeamName}`];
  if (url) descParts.push(`Open in MatchReadyTX: ${url}`);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MatchReadyTX//Match//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${match.id}@matchreadytx`,
    `DTSTAMP:${formatIcsUtc(stamp)}`,
    `DTSTART:${formatIcsUtc(start.toISOString())}`,
    `DTEND:${formatIcsUtc(end.toISOString())}`,
    icsFold(`SUMMARY:${icsEscape(matchIcsSummary(match))}`),
    ...(loc ? [icsFold(`LOCATION:${icsEscape(loc)}`)] : []),
    icsFold(`DESCRIPTION:${icsEscape(descParts.join('\n'))}`),
    ...(url ? [icsFold(`URL:${url}`)] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadMatchIcs(match: Match, url?: string): void {
  if (typeof document === 'undefined') return;
  const ics = generateMatchIcs(match, { url });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = matchIcsFilename(match);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1500);
}
