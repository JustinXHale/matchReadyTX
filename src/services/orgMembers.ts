import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, isFirebaseConfigured } from '@/services/firebase';
import {
  profileFromFirestore,
  saveFirebaseProfile,
} from '@/services/userProfile';
import type { Role, UserProfile } from '@/domain/types';
import { defaultOrgId } from '@/services/orgData';

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore is not configured.');
  }
  return db;
}

function requireFunctions() {
  if (!isFirebaseConfigured || !functions) {
    throw new Error('Cloud Functions are not configured.');
  }
  return functions;
}

export type OrgMemberMeta = {
  uid: string;
  roles: Role[];
  teamIds: string[];
  fanTeamIds: string[];
  joinedAt?: string;
};

/** Coerce Firestore Timestamp | string | Date into ISO, else undefined. */
function coerceJoinedAt(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim()) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    const d = (value as { toDate: () => Date }).toDate();
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

function withMemberMeta(
  profile: UserProfile,
  meta: OrgMemberMeta,
): UserProfile {
  return {
    ...profile,
    roles: meta.roles.length ? meta.roles : profile.roles,
    teamIds: meta.teamIds.length ? meta.teamIds : profile.teamIds,
    fanTeamIds:
      meta.fanTeamIds.length > 0 ? meta.fanTeamIds : profile.fanTeamIds,
    joinedAt: meta.joinedAt ?? profile.joinedAt,
  };
}

function pendingMemberStub(meta: OrgMemberMeta): UserProfile {
  return {
    uid: meta.uid,
    firstName: '',
    lastName: '',
    displayName: 'Pending profile',
    email: '',
    phone: '',
    smsOptIn: null,
    homeStreet: '',
    homeCity: '',
    homeRegion: '',
    homePostalCode: '',
    homeAddress: '',
    roles: meta.roles,
    teamIds: meta.teamIds,
    fanTeamIds: meta.fanTeamIds,
    profileComplete: false,
    joinedAt: meta.joinedAt,
  };
}

/**
 * Subscribe to org membership, then load each users/{uid} profile.
 * Calls onUsers whenever the combined roster changes.
 */
export function subscribeOrgRoster(
  orgId: string,
  onUsers: (users: UserProfile[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const database = requireDb();
  let memberMeta = new Map<string, OrgMemberMeta>();
  let profiles = new Map<string, UserProfile>();
  let cancelled = false;
  const unsubs: Unsubscribe[] = [];

  const emit = () => {
    const list: UserProfile[] = [];
    for (const [uid, meta] of memberMeta) {
      const profile = profiles.get(uid);
      if (profile) {
        list.push(withMemberMeta(profile, meta));
      } else {
        // Member without a user doc yet — stub so assigners still see them.
        list.push(pendingMemberStub(meta));
      }
    }
    list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    onUsers(list);
  };

  const loadProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(database, 'users', uid));
      if (cancelled) return;
      if (snap.exists()) {
        profiles.set(
          uid,
          profileFromFirestore(uid, snap.data() as Record<string, unknown>),
        );
      } else {
        profiles.delete(uid);
      }
      emit();
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  unsubs.push(
    onSnapshot(
      collection(database, 'orgs', orgId, 'members'),
      (snap) => {
        const next = new Map<string, OrgMemberMeta>();
        for (const d of snap.docs) {
          const data = d.data();
          next.set(d.id, {
            uid: d.id,
            roles: Array.isArray(data.roles) ? (data.roles as Role[]) : [],
            teamIds: Array.isArray(data.teamIds)
              ? (data.teamIds as string[])
              : [],
            fanTeamIds: Array.isArray(data.fanTeamIds)
              ? (data.fanTeamIds as string[])
              : [],
            joinedAt: coerceJoinedAt(data.joinedAt),
          });
        }
        memberMeta = next;
        // Drop profiles for removed members
        for (const uid of [...profiles.keys()]) {
          if (!memberMeta.has(uid)) profiles.delete(uid);
        }
        emit();
        for (const uid of memberMeta.keys()) {
          void loadProfile(uid);
        }
      },
      (err) => onError?.(err),
    ),
  );

  return () => {
    cancelled = true;
    for (const u of unsubs) u();
  };
}

/** One-shot roster load (optional). */
export async function fetchOrgRoster(orgId: string): Promise<UserProfile[]> {
  const database = requireDb();
  const members = await getDocs(collection(database, 'orgs', orgId, 'members'));
  const users: UserProfile[] = [];
  for (const m of members.docs) {
    const data = m.data();
    const memberMeta: OrgMemberMeta = {
      uid: m.id,
      roles: Array.isArray(data.roles) ? (data.roles as Role[]) : [],
      teamIds: Array.isArray(data.teamIds) ? (data.teamIds as string[]) : [],
      fanTeamIds: Array.isArray(data.fanTeamIds)
        ? (data.fanTeamIds as string[])
        : [],
      joinedAt: coerceJoinedAt(data.joinedAt),
    };
    const userSnap = await getDoc(doc(database, 'users', m.id));
    if (userSnap.exists()) {
      users.push(
        withMemberMeta(
          profileFromFirestore(
            m.id,
            userSnap.data() as Record<string, unknown>,
          ),
          memberMeta,
        ),
      );
    } else {
      users.push(pendingMemberStub(memberMeta));
    }
  }
  return users.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function saveAssessedLevel(
  uid: string,
  assessedLevel: number | undefined,
): Promise<void> {
  const database = requireDb();
  await setDoc(
    doc(database, 'users', uid),
    {
      assessedLevel: assessedLevel ?? null,
      requestedAssessedLevel: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function saveAssessedLevelRequest(
  uid: string,
  requestedLevel: number | null,
): Promise<void> {
  const database = requireDb();
  await setDoc(
    doc(database, 'users', uid),
    {
      requestedAssessedLevel: requestedLevel,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function dismissAssessedLevelRequest(uid: string): Promise<void> {
  return saveAssessedLevelRequest(uid, null);
}

/**
 * Assigner saves another member’s profile + mirrors roles/teamIds onto org membership.
 */
export async function saveAssignerMemberProfile(
  orgId: string,
  profile: UserProfile,
): Promise<UserProfile> {
  const saved = await saveFirebaseProfile(profile, { includeAssessedLevel: true });
  const database = requireDb();
  await setDoc(
    doc(database, 'orgs', orgId, 'members', profile.uid),
    {
      roles: saved.roles,
      teamIds: saved.teamIds,
      fanTeamIds: saved.fanTeamIds ?? [],
      fanTeamOther: saved.fanTeamOther ?? null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  return saved;
}

/** Remove someone from the org (membership only — Auth account remains). */
export async function removeOrgMember(
  orgId: string,
  uid: string,
): Promise<void> {
  const database = requireDb();
  if (uid.startsWith('u_')) {
    throw new Error('Demo users cannot be removed from Firebase.');
  }
  await deleteDoc(doc(database, 'orgs', orgId, 'members', uid));
}

/**
 * Assigner deletes member from society + Firestore user doc + Firebase Auth.
 */
export async function deleteOrgMemberAccount(
  orgId: string,
  uid: string,
): Promise<void> {
  if (uid.startsWith('u_')) {
    throw new Error('Demo users cannot be deleted from Firebase.');
  }
  const fn = httpsCallable(requireFunctions(), 'deleteOrgMemberAccount');
  await fn({ orgId, uid });
}

export { defaultOrgId };
