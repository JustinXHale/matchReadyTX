import type { ComplianceHold, Match, UserProfile } from '@/domain/types';

export type { ComplianceHold };

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

/** Email / phone line for overlay copy. */
export function complianceHoldContactLine(
  hold: Pick<ComplianceHold, 'lockedByEmail' | 'lockedByPhone'>,
): string | null {
  const parts = [hold.lockedByEmail?.trim(), hold.lockedByPhone?.trim()].filter(
    Boolean,
  ) as string[];
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function defaultComplianceHoldMessage(
  user: Pick<UserProfile, 'displayName' | 'email' | 'phone'>,
): string {
  const name = user.displayName.trim() || 'Scheduler';
  const email = user.email.trim();
  const phone = user.phone.trim();
  const contactParts = [email, phone].filter(Boolean);
  const contact =
    contactParts.length > 0 ? contactParts.join(' or ') : 'the assigner';
  return `${name} has put this game on hold until all teams are compliant. Reach out to ${name} at ${contact} to remove the lock.`;
}

export function applyComplianceHold(
  match: Match,
  assigner: Pick<UserProfile, 'uid' | 'displayName' | 'email' | 'phone'>,
  message: string,
  at = new Date().toISOString(),
): Match {
  const trimmed = message.trim();
  return {
    ...match,
    complianceHold: {
      lockedAt: at,
      lockedByUid: assigner.uid,
      lockedByName: assigner.displayName.trim() || 'Assigner',
      lockedByEmail: assigner.email.trim() || undefined,
      lockedByPhone: assigner.phone.trim() || undefined,
      message: trimmed || defaultComplianceHoldMessage(assigner),
    },
  };
}

export function clearComplianceHold(match: Match): Match {
  if (!match.complianceHold) return match;
  const next = { ...match };
  delete next.complianceHold;
  return next;
}
