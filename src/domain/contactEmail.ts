import type { UserProfile } from '@/domain/types';
import { normalizeEmail } from '@/domain/contacts';

/** Email used for assignments, alerts, and Contacts matching (may differ from sign-in). */
export function effectiveContactEmail(
  user: Pick<UserProfile, 'email' | 'contactEmail' | 'contactEmailSameAsSignIn'>,
): string {
  const signIn = user.email?.trim() ?? '';
  if (user.contactEmailSameAsSignIn === false) {
    const contact = user.contactEmail?.trim() ?? '';
    return contact || signIn;
  }
  return signIn;
}

export function isUsableContactEmail(raw: string): boolean {
  const e = normalizeEmail(raw);
  if (!e) return false;
  const at = e.indexOf('@');
  if (at <= 0) return false;
  const domain = e.slice(at + 1);
  return domain.includes('.') && !/\s/.test(e);
}
