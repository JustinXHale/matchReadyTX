import { isOutsideAppointmentUserId } from '@/domain/placeholderAssignment';
import { CREW_SLOTS, crewPeople, type Match, type UserProfile } from '@/domain/types';
import { formatMatchKickoff, orgTimeZone } from '@/domain/matchTime';
import { callNotifyUser } from '@/services/notify';
import { isFirebaseConfigured } from '@/services/firebase';

function fixtureLine(match: Match): string {
  return `${match.homeTeamName} vs ${match.awayTeamName}`;
}

function notifyUidsForMatch(match: Match, users: UserProfile[]): string[] {
  const uids = new Set<string>();
  for (const slot of CREW_SLOTS) {
    for (const a of crewPeople(match.crew[slot])) {
      if (a.userId && !isOutsideAppointmentUserId(a.userId)) {
        uids.add(a.userId);
      }
    }
  }
  for (const c of match.cmo ?? []) {
    if (c.userId && !isOutsideAppointmentUserId(c.userId)) {
      uids.add(c.userId);
    }
  }
  for (const user of users) {
    if (!user.roles.includes('teamAdmin')) continue;
    if (
      user.teamIds.includes(match.homeTeamId) ||
      user.teamIds.includes(match.awayTeamId)
    ) {
      uids.add(user.uid);
    }
  }
  return [...uids];
}

export async function notifyComplianceHoldChange(opts: {
  match: Match;
  users: UserProfile[];
  timeZone: string;
  locked: boolean;
  message: string;
}): Promise<void> {
  if (!isFirebaseConfigured) return;

  const { match, users, timeZone, locked, message } = opts;
  const when = formatMatchKickoff(match.kickoffAt, timeZone);
  const fixture = fixtureLine(match);
  const subject = locked
    ? `Match on hold: ${fixture}`
    : `Match hold removed: ${fixture}`;
  const body = locked
    ? `This match (${when} at ${match.venueName}) has been placed on hold until teams are compliant.\n\n${message}`
    : `The compliance hold has been removed for ${fixture} (${when} at ${match.venueName}).`;

  const uids = notifyUidsForMatch(match, users);
  for (const uid of uids) {
    await callNotifyUser({
      uid,
      subject,
      body,
      event: locked ? 'compliance_hold' : 'compliance_hold_cleared',
      html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
    });
  }
}
