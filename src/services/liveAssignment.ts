import {
  CREW_SLOT_LABELS,
  REQUESTABLE_SLOT_LABELS,
  type CrewSlot,
  type Match,
  type RequestableSlot,
} from '@/domain/types';
import { allActiveAssignments } from '@/domain/crew';
import { defaultOrgId, saveMatchCrewAssignment } from '@/services/orgData';
import { callNotifyUser } from '@/services/notify';
import { isFirebaseConfigured } from '@/services/firebase';
import { mapsDirectionsUrl } from '@/services/maps';
import { matchAppUrl } from '@/services/appLinks';

function formatKickoffDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatKickoffTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function roleLabel(slot: RequestableSlot): string {
  return slot === 'cmo'
    ? REQUESTABLE_SLOT_LABELS.cmo
    : CREW_SLOT_LABELS[slot];
}

function fixtureLine(match: Match): string {
  return `${match.homeTeamName} vs ${match.awayTeamName}`;
}

/** e.g. Assigned: Home vs Away on Sat, Sep 5 at 11:00 AM */
function subjectWithWhen(prefix: 'Assigned' | 'Unassigned', match: Match): string {
  const fixture = fixtureLine(match);
  const date = formatKickoffDate(match.kickoffAt);
  const time = formatKickoffTime(match.kickoffAt);
  if (time) return `${prefix}: ${fixture} on ${date} at ${time}`;
  return `${prefix}: ${fixture} on ${date}`;
}

function fullAddressLine(match: Match): string {
  return match.venueAddress?.trim() || '';
}

function mapsUrlForMatch(match: Match): string | null {
  return mapsDirectionsUrl({
    name: match.venueName,
    address: match.venueAddress?.trim() || undefined,
    lat: match.venueLat,
    lng: match.venueLng,
  });
}

/** Other named crew (excluding the email recipient). */
function otherAssignees(
  match: Match,
  excludeUserId: string,
): { role: string; name: string }[] {
  const out: { role: string; name: string }[] = [];
  for (const { slot, assignment } of allActiveAssignments(match)) {
    if (!assignment.userId || assignment.userId === excludeUserId) continue;
    if (!assignment.userName?.trim()) continue;
    out.push({ role: CREW_SLOT_LABELS[slot], name: assignment.userName.trim() });
  }
  for (const c of match.cmo ?? []) {
    if (!c.userId || c.userId === excludeUserId) continue;
    if (!c.userName?.trim()) continue;
    out.push({ role: REQUESTABLE_SLOT_LABELS.cmo, name: c.userName.trim() });
  }
  return out;
}

function matchFactsText(match: Match): string {
  const date = formatKickoffDate(match.kickoffAt);
  const time = formatKickoffTime(match.kickoffAt);
  const address = fullAddressLine(match);
  const maps = mapsUrlForMatch(match);
  return [
    `Home: ${match.homeTeamName}`,
    `Away: ${match.awayTeamName}`,
    `When: ${date}${time ? ` at ${time}` : ''}`,
    `Venue: ${match.venueName}`,
    address ? `Address: ${address}` : '',
    maps ? `Maps: ${maps}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function matchFactsHtml(match: Match): string {
  const date = formatKickoffDate(match.kickoffAt);
  const time = formatKickoffTime(match.kickoffAt);
  const address = fullAddressLine(match);
  const maps = mapsUrlForMatch(match);
  const mapsLine = maps
    ? `<br/><strong>Maps:</strong> <a href="${maps}">Open in Google Maps</a>`
    : '';
  return `<p><strong>Home:</strong> ${match.homeTeamName}<br/>
<strong>Away:</strong> ${match.awayTeamName}<br/>
<strong>When:</strong> ${date}${time ? ` at ${time}` : ''}<br/>
<strong>Venue:</strong> ${match.venueName}${
    address ? `<br/><strong>Address:</strong> ${address}` : ''
  }${mapsLine}</p>`;
}

function crewOthersText(
  others: { role: string; name: string }[],
): string {
  if (others.length === 0) return '';
  return [
    `Also assigned:`,
    ...others.map((o) => `· ${o.role}: ${o.name}`),
  ].join('\n');
}

function crewOthersHtml(
  others: { role: string; name: string }[],
): string {
  if (others.length === 0) return '';
  const items = others
    .map((o) => `<li><strong>${o.role}:</strong> ${o.name}</li>`)
    .join('');
  return `<p><strong>Also assigned:</strong></p><ul>${items}</ul>`;
}

function matchLinkText(match: Match): string {
  const url = matchAppUrl(match.id);
  return `Open in MatchReadyTX: ${url}`;
}

function matchLinkHtml(match: Match): string {
  const url = matchAppUrl(match.id);
  return `<p><a href="${url}">Open this match in MatchReadyTX</a></p>
<p style="color:#666;font-size:13px;">If you are not signed in, you will be asked to log in first, then taken to the match.</p>`;
}
function canNotify(userId: string): boolean {
  return isFirebaseConfigured && !userId.startsWith('u_');
}

/** Send (or resend) the assignment confirmation email — no Firestore write. */
export async function sendCrewAssignmentEmail(opts: {
  match: Match;
  slot: RequestableSlot;
  userId: string;
  /** Tag for mail audit; default assignment / assignment_resend. */
  event?: string;
}): Promise<void> {
  const { match, slot, userId } = opts;
  if (!canNotify(userId)) return;

  const role = roleLabel(slot);
  const fixture = fixtureLine(match);
  const subject = subjectWithWhen('Assigned', match);
  const others = otherAssignees(match, userId);
  const othersText = crewOthersText(others);
  const body = [
    `You've been assigned as ${role} for ${fixture}.`,
    ``,
    matchFactsText(match),
    othersText ? `` : null,
    othersText || null,
    ``,
    matchLinkText(match),
    ``,
    `Open MatchReadyTX to review and confirm your assignment.`,
  ]
    .filter((line) => line != null)
    .join('\n');

  await callNotifyUser({
    uid: userId,
    subject,
    body,
    event: opts.event ?? 'assignment',
    html: `<p>You've been assigned as <strong>${role}</strong> for <strong>${fixture}</strong>.</p>
${matchFactsHtml(match)}
${crewOthersHtml(others)}
${matchLinkHtml(match)}
<p>Open MatchReadyTX to review and confirm your assignment.</p>`,
  });
}

/** After local assignCrew: persist to Firestore and email the official (live only). */
export async function persistCrewAssignmentAndEmail(opts: {
  match: Match;
  slot: CrewSlot;
  userId: string;
}): Promise<void> {
  if (!isFirebaseConfigured) return;

  const { match, slot, userId } = opts;
  await saveMatchCrewAssignment(defaultOrgId(), match);
  await sendCrewAssignmentEmail({ match, slot, userId, event: 'assignment' });
}

/** Resend assignment confirmation only (Scheduler). */
export async function resendCrewAssignmentEmail(opts: {
  match: Match;
  slot: RequestableSlot;
  userId: string;
}): Promise<void> {
  if (!isFirebaseConfigured) return;
  await sendCrewAssignmentEmail({
    ...opts,
    event: 'assignment_resend',
  });
}

/**
 * Persist crew after clear/unassign and email the person who was removed (live only).
 * Pass userId/slot from *before* the local clear.
 */
export async function persistCrewUnassignmentAndEmail(opts: {
  match: Match;
  slot: RequestableSlot;
  userId: string;
}): Promise<void> {
  if (!isFirebaseConfigured) return;

  const { match, slot, userId } = opts;
  await saveMatchCrewAssignment(defaultOrgId(), match);
  if (!canNotify(userId)) return;

  const role = roleLabel(slot);
  const fixture = fixtureLine(match);
  const subject = subjectWithWhen('Unassigned', match);
  const body = [
    `You've been removed as ${role} for ${fixture}.`,
    ``,
    matchFactsText(match),
    ``,
    matchLinkText(match),
    ``,
    `You no longer need to work this match. Open MatchReadyTX if you have questions.`,
  ]
    .filter(Boolean)
    .join('\n');

  await callNotifyUser({
    uid: userId,
    subject,
    body,
    event: 'unassignment',
    html: `<p>You've been removed as <strong>${role}</strong> for <strong>${fixture}</strong>.</p>
${matchFactsHtml(match)}
${matchLinkHtml(match)}
<p>You no longer need to work this match. Open MatchReadyTX if you have questions.</p>`,
  });
}
