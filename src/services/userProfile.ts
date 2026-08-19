import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, isFirebaseConfigured } from '@/services/firebase';
import {
  displayNameFromParts,
  type Role,
  type UserProfile,
} from '@/domain/types';
import { isProfileComplete } from '@/domain/profile';

const DEFAULT_ORG =
  import.meta.env.VITE_DEFAULT_ORG_ID?.trim() || 'lonestar';

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore is not configured.');
  }
  return db;
}

function splitDisplayName(name: string | null): {
  firstName: string;
  lastName: string;
} {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export function profileFromAuthUser(
  user: User,
  roles: Role[] = [],
): UserProfile {
  const { firstName, lastName } = splitDisplayName(user.displayName);
  const profile: UserProfile = {
    uid: user.uid,
    firstName,
    lastName,
    displayName:
      user.displayName?.trim() ||
      displayNameFromParts(firstName, lastName) ||
      user.email ||
      'Member',
    email: user.email ?? '',
    phone: '',
    smsOptIn: null,
    homeStreet: '',
    homeCity: '',
    homeRegion: '',
    homePostalCode: '',
    homeAddress: '',
    roles,
    teamIds: [],
    profileComplete: false,
    photoUrl: user.photoURL ?? undefined,
  };
  profile.profileComplete = isProfileComplete(profile);
  return profile;
}

export function profileFromFirestore(
  uid: string,
  data: Record<string, unknown>,
): UserProfile {
  const firstName = String(data.firstName ?? '');
  const lastName = String(data.lastName ?? '');
  const preferredName =
    typeof data.preferredName === 'string' ? data.preferredName : undefined;
  const profile: UserProfile = {
    uid,
    firstName,
    lastName,
    preferredName,
    displayName: String(
      data.displayName ||
        displayNameFromParts(firstName, lastName) ||
        data.email ||
        'Member',
    ),
    email: String(data.email ?? ''),
    phone: String(data.phone ?? ''),
    smsOptIn:
      data.smsOptIn === true || data.smsOptIn === false
        ? (data.smsOptIn as boolean)
        : null,
    homeStreet: String(data.homeStreet ?? ''),
    homeUnit: typeof data.homeUnit === 'string' ? data.homeUnit : undefined,
    homeCity: String(data.homeCity ?? ''),
    homeRegion: String(data.homeRegion ?? ''),
    homePostalCode: String(data.homePostalCode ?? ''),
    homeAddress: String(data.homeAddress ?? ''),
    homeLat: typeof data.homeLat === 'number' ? data.homeLat : undefined,
    homeLng: typeof data.homeLng === 'number' ? data.homeLng : undefined,
    roles: Array.isArray(data.roles) ? (data.roles as Role[]) : [],
    teamIds: Array.isArray(data.teamIds) ? (data.teamIds as string[]) : [],
    fanTeamIds: Array.isArray(data.fanTeamIds)
      ? (data.fanTeamIds as string[])
      : undefined,
    fanTeamOther:
      typeof data.fanTeamOther === 'string' && data.fanTeamOther.trim()
        ? data.fanTeamOther.trim()
        : undefined,
    profileComplete: false,
    refereeLevel:
      typeof data.refereeLevel === 'number' ? data.refereeLevel : undefined,
    assessedLevel:
      typeof data.assessedLevel === 'number' ? data.assessedLevel : undefined,
    competitionAccess: Array.isArray(data.competitionAccess)
      ? (data.competitionAccess as string[])
      : undefined,
    refereeingSince:
      typeof data.refereeingSince === 'string'
        ? data.refereeingSince
        : undefined,
    birthday: typeof data.birthday === 'string' ? data.birthday : undefined,
    jerseySize:
      typeof data.jerseySize === 'string' ? data.jerseySize : undefined,
    shortsSize:
      typeof data.shortsSize === 'string' ? data.shortsSize : undefined,
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
  };
  profile.profileComplete = isProfileComplete(profile);
  return profile;
}

/** Load or create users/{uid}; bootstrap org membership for first society admin. */
export async function ensureFirebaseUser(user: User): Promise<UserProfile> {
  const database = requireDb();
  const userRef = doc(database, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return profileFromFirestore(
      user.uid,
      snap.data() as Record<string, unknown>,
    );
  }

  const roles = await bootstrapOrgMembership(user.uid);
  const profile = profileFromAuthUser(user, roles);

  await setDoc(userRef, {
    ...stripUndefined(profile as unknown as Record<string, unknown>),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return profile;
}

/**
 * Join default org as a normal member. Does not read orgs/{id} (members-only)
 * and never self-grants assigner — schedulers promote people in Members.
 */
async function bootstrapOrgMembership(uid: string): Promise<Role[]> {
  const database = requireDb();
  const orgId = DEFAULT_ORG;
  const memberRef = doc(database, 'orgs', orgId, 'members', uid);

  const memberSnap = await getDoc(memberRef);
  if (memberSnap.exists()) {
    const roles = memberSnap.data()?.roles;
    return Array.isArray(roles) ? (roles as Role[]) : [];
  }

  const roles: Role[] = ['official'];
  await setDoc(memberRef, {
    roles,
    teamIds: [],
    joinedAt: serverTimestamp(),
  });

  return roles;
}

/** Reload profile from Firestore (e.g. after onboarding save). */
export async function loadFirebaseProfile(uid: string): Promise<UserProfile | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, 'users', uid));
  if (!snap.exists()) return null;
  return profileFromFirestore(uid, snap.data() as Record<string, unknown>);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

/** Persist profile fields to users/{uid} and mirror roles onto org membership. */
export async function saveFirebaseProfile(
  profile: UserProfile,
): Promise<UserProfile> {
  const database = requireDb();
  const complete = isProfileComplete(profile);
  const next: UserProfile = { ...profile, profileComplete: complete };

  // Don't write huge data-URL photos to Firestore (1 MiB doc limit).
  const photoUrl =
    next.photoUrl && !next.photoUrl.startsWith('data:')
      ? next.photoUrl
      : undefined;

  const payload = stripUndefined({
    uid: next.uid,
    firstName: next.firstName,
    lastName: next.lastName,
    preferredName: next.preferredName,
    displayName: next.displayName,
    email: next.email,
    phone: next.phone,
    smsOptIn: next.smsOptIn,
    homeStreet: next.homeStreet,
    homeUnit: next.homeUnit,
    homeCity: next.homeCity,
    homeRegion: next.homeRegion,
    homePostalCode: next.homePostalCode,
    homeAddress: next.homeAddress,
    homeLat: next.homeLat,
    homeLng: next.homeLng,
    roles: next.roles,
    teamIds: next.teamIds,
    fanTeamIds: next.fanTeamIds ?? [],
    fanTeamOther: next.fanTeamOther?.trim() || null,
    profileComplete: next.profileComplete,
    refereeLevel: next.refereeLevel,
    assessedLevel: next.assessedLevel,
    competitionAccess: next.competitionAccess,
    refereeingSince: next.refereeingSince,
    birthday: next.birthday,
    jerseySize: next.jerseySize,
    shortsSize: next.shortsSize,
    photoUrl,
    updatedAt: serverTimestamp(),
  } as Record<string, unknown>);

  await setDoc(doc(database, 'users', next.uid), payload, { merge: true });

  await setDoc(
    doc(database, 'orgs', DEFAULT_ORG, 'members', next.uid),
    {
      roles: next.roles,
      teamIds: next.teamIds,
      fanTeamIds: next.fanTeamIds ?? [],
      fanTeamOther: next.fanTeamOther ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { ...next, photoUrl: photoUrl ?? next.photoUrl };
}

export { DEFAULT_ORG as defaultOrgId };
