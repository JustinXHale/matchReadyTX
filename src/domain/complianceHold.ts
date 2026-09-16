import { orgTimeZone } from '@/domain/matchTime';
import type { ComplianceHold, Match, UserProfile } from '@/domain/types';

export type { ComplianceHold };

/** Society name for compliance-hold messaging. */
export const COMPLIANCE_HOLD_SOCIETY_NAME =
  'Texas Rugby Referee Society (TRRA)';

/** Default assigner-of-record contact on compliance holds. */
export const COMPLIANCE_HOLD_CONTACT = {
  name: 'Justin X. Hale',
  email: 'justinxhale@gmail.com',
  phone: '(979) 703-0894',
  channels: 'WhatsApp or GroupMe',
} as const;

export function isComplianceHeld(
  match: Pick<Match, 'complianceHold'>,
): boolean {
  return Boolean(match.complianceHold?.lockedAt);
}

/** Schedule/detail lock UI — team admin, referee, and fan lenses only. */
export function shouldShowComplianceHoldUi(
  roleView: 'referee' | 'teamAdmin' | 'fan' | 'scheduler' | 'judicial' | 'finance',
): boolean {
  return (
    roleView === 'teamAdmin' ||
    roleView === 'referee' ||
    roleView === 'fan'
  );
}

/** Short assertive label for schedule cards. */
export function complianceHoldCardLabel(): string {
  return 'Locked by assigner · On hold until teams are compliant';
}

/** Card overlay footer — e.g. Saturday, Sept. 16, 2027 Home v Away */
export function complianceHoldFixtureLine(
  match: Pick<Match, 'kickoffAt' | 'homeTeamName' | 'awayTeamName'>,
  timeZone?: string | null,
  labels?: { home?: string; away?: string },
): string {
  const d = new Date(match.kickoffAt);
  if (Number.isNaN(d.getTime())) {
    const home = labels?.home?.trim() || match.homeTeamName.trim();
    const away = labels?.away?.trim() || match.awayTeamName.trim();
    return `${home} v ${away}`;
  }
  const tz = orgTimeZone(timeZone);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: tz });
  const monthLabel = month.endsWith('.') ? month : `${month}.`;
  const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: tz });
  const year = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: tz });
  const home = labels?.home?.trim() || match.homeTeamName.trim();
  const away = labels?.away?.trim() || match.awayTeamName.trim();
  return `${weekday}, ${monthLabel} ${day}, ${year} ${home} v ${away}`;
}

/** Email / phone / messaging line for overlay copy. */
export function complianceHoldContactLine(
  hold: Pick<
    ComplianceHold,
    'lockedByEmail' | 'lockedByPhone' | 'lockedByContactChannels'
  >,
): string | null {
  const parts = [
    hold.lockedByEmail?.trim(),
    hold.lockedByPhone?.trim(),
    hold.lockedByContactChannels?.trim(),
  ].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function complianceHoldContactSentence(): string {
  const { name, email, phone, channels } = COMPLIANCE_HOLD_CONTACT;
  return `contact ${name} at ${email}, ${phone}, on ${channels} as well`;
}

export function defaultComplianceHoldMessage(
  match: Pick<Match, 'homeTeamName' | 'awayTeamName' | 'venueName'>,
  assigner: Pick<UserProfile, 'displayName'>,
): string {
  const assignerName = assigner.displayName.trim() || 'Assigner';
  const home = match.homeTeamName.trim();
  const away = match.awayTeamName.trim();
  const venue = match.venueName?.trim() || 'TBD';
  const contact = complianceHoldContactSentence();

  return `MATCH ON HOLD — COMPLIANCE REQUIRED

Fixture: ${home} vs ${away}
Venue: ${venue}

This match has been placed on hold by ${assignerName}, ${COMPLIANCE_HOLD_SOCIETY_NAME}, until both teams are in compliance.

HOME — ${home}
Status: Non-compliant
Outstanding: [describe what is missing]

AWAY — ${away}
Status: Non-compliant
Outstanding: [describe what is missing]

OFFICIAL NOTICE
To all match officials and assistant referees assigned to this fixture: you are hereby directed not to work this match until this hold is removed by the assigner. Crew assignments remain on the schedule for planning purposes only; this is not authorization to referee.

Teams may not confirm match details while this hold is active.

To request removal of this hold, ${contact}.

— ${assignerName}
${COMPLIANCE_HOLD_SOCIETY_NAME}`;
}

export function applyComplianceHold(
  match: Match,
  assigner: Pick<UserProfile, 'uid' | 'displayName' | 'email' | 'phone'>,
  message: string,
  at = new Date().toISOString(),
): Match {
  const trimmed = message.trim();
  const contact = COMPLIANCE_HOLD_CONTACT;
  return {
    ...match,
    complianceHold: {
      lockedAt: at,
      lockedByUid: assigner.uid,
      lockedByName: contact.name,
      lockedByEmail: contact.email,
      lockedByPhone: contact.phone,
      lockedByContactChannels: contact.channels,
      message:
        trimmed ||
        defaultComplianceHoldMessage(match, assigner),
    },
  };
}

export function clearComplianceHold(match: Match): Match {
  if (!match.complianceHold) return match;
  const next = { ...match };
  delete next.complianceHold;
  return next;
}
