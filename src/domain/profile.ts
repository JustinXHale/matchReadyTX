import type { Role, UserProfile } from './types';
import { displayNameFromParts, hasRefereeLensRole } from './types';

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function titleCaseToken(token: string): string {
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Guess first/last from email local-part.
 * `jane.doe@…` / `jane_doe` / `jane-doe` → First + Last.
 * Single token → first only (last left blank).
 */
export function guessNamesFromEmail(email: string): {
  firstName: string;
  lastName: string;
} {
  const local = email.split('@')[0]?.trim() ?? '';
  if (!local) return { firstName: '', lastName: '' };
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: titleCaseToken(parts[0]),
      lastName: titleCaseToken(parts[parts.length - 1]),
    };
  }
  return { firstName: titleCaseToken(parts[0] ?? ''), lastName: '' };
}

/** Split a legacy single display name into first/last. */
export function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = displayName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const i = trimmed.indexOf(' ');
  if (i < 0) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, i).trim(),
    lastName: trimmed.slice(i + 1).trim(),
  };
}

export function hasSelfSelectableRole(roles: Role[]): boolean {
  return (
    roles.includes('official') ||
    roles.includes('teamAdmin') ||
    roles.includes('cmo') ||
    roles.includes('assigner') ||
    roles.includes('fan')
  );
}

/** Working society roles that are mutually exclusive with Fan. */
export function hasWorkingSocietyRole(roles: Role[]): boolean {
  return (
    roles.includes('official') ||
    roles.includes('teamAdmin') ||
    roles.includes('cmo') ||
    roles.includes('assigner') ||
    roles.includes('judicial')
  );
}

/**
 * Fan is read-only browse and cannot combine with Referee / Team Admin / CMO
 * (or assigner) on self-serve onboarding/profile.
 */
export type SelfServeRoleDraft = {
  roleOfficial: boolean;
  roleTeamAdmin: boolean;
  roleCmo: boolean;
  roleFan: boolean;
};

export function applyFanXorRoleToggle(
  draft: SelfServeRoleDraft,
  toggled: 'official' | 'teamAdmin' | 'cmo' | 'fan',
  next: boolean,
): SelfServeRoleDraft {
  if (toggled === 'fan') {
    if (next) {
      return {
        roleOfficial: false,
        roleTeamAdmin: false,
        roleCmo: false,
        roleFan: true,
      };
    }
    return { ...draft, roleFan: false };
  }
  const out = { ...draft, roleFan: next ? false : draft.roleFan };
  if (toggled === 'official') out.roleOfficial = next;
  if (toggled === 'teamAdmin') out.roleTeamAdmin = next;
  if (toggled === 'cmo') out.roleCmo = next;
  return out;
}

export type HomeAddressParts = {
  homeStreet: string;
  homeUnit?: string;
  homeCity: string;
  homeRegion: string;
  homePostalCode: string;
};

/** Compose a single line for geocode / Maps (includes unit when present). */
export function formatHomeAddress(parts: HomeAddressParts): string {
  const street = parts.homeStreet.trim();
  const unit = parts.homeUnit?.trim();
  const city = parts.homeCity.trim();
  const region = parts.homeRegion.trim();
  const postal = parts.homePostalCode.trim();
  const line1 = unit ? `${street}, ${unit}` : street;
  const cityLine = [city, region].filter(Boolean).join(', ');
  const tail = [cityLine, postal].filter(Boolean).join(' ');
  return [line1, tail].filter(Boolean).join(', ');
}

export function hasCompleteHomeAddress(
  user: Partial<HomeAddressParts> & { homeAddress?: string },
): boolean {
  return Boolean(
    user.homeStreet?.trim() &&
      user.homeCity?.trim() &&
      user.homeRegion?.trim() &&
      user.homePostalCode?.trim(),
  );
}

export function isProfileComplete(user: Pick<
  UserProfile,
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'homeStreet'
  | 'homeCity'
  | 'homeRegion'
  | 'homePostalCode'
  | 'homeAddress'
  | 'roles'
  | 'birthday'
  | 'refereeingSince'
  | 'jerseySize'
  | 'shortsSize'
>): boolean {
  if (
    !user.firstName?.trim() ||
    !user.lastName?.trim() ||
    !user.email?.trim() ||
    !(
      hasSelfSelectableRole(user.roles) ||
      user.roles.includes('judicial') ||
      user.roles.includes('reportAnalytics')
    )
  ) {
    return false;
  }

  // Fan-only: name + email + role are enough.
  if (!hasWorkingSocietyRole(user.roles)) {
    return user.roles.includes('fan');
  }

  if (!user.phone?.trim()) {
    return false;
  }

  // Birthday, home address, and kit only for Referee / CMO.
  if (hasRefereeLensRole(user.roles)) {
    if (!user.birthday?.trim()) return false;
    if (!hasCompleteHomeAddress(user)) return false;
    if (
      !user.refereeingSince?.trim() ||
      !user.jerseySize?.trim() ||
      !user.shortsSize?.trim()
    ) {
      return false;
    }
  }
  return true;
}

export function syncHomeAddressLine<
  T extends HomeAddressParts & { homeAddress: string },
>(user: T): T {
  return {
    ...user,
    homeAddress: formatHomeAddress(user),
  };
}

export function syncDisplayName<
  T extends Pick<UserProfile, 'firstName' | 'lastName' | 'displayName'> & {
    preferredName?: string;
  },
>(user: T): T {
  const given = user.preferredName?.trim() || user.firstName;
  return {
    ...user,
    displayName: displayNameFromParts(given, user.lastName),
  };
}

export type PhotoValidation =
  | { ok: true }
  | { ok: false; error: string };

export function validateProfilePhoto(file: File): PhotoValidation {
  if (!PHOTO_MIME.has(file.type)) {
    return { ok: false, error: 'Use a JPEG, PNG, or WebP image.' };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: 'Photo must be under 5 MB.' };
  }
  return { ok: true };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export { displayNameFromParts, hasRefereeLensRole };
