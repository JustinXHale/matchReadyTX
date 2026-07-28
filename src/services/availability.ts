import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/services/firebase';
import type { AvailabilityRange } from '@/domain/types';
import { defaultOrgId } from '@/services/orgData';

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore is not configured.');
  }
  return db;
}

function rangesCol(orgId: string, uid: string) {
  return collection(requireDb(), 'orgs', orgId, 'availability', uid, 'ranges');
}

export function rangeFromFirestore(
  id: string,
  data: Record<string, unknown>,
  fallbackUserId: string,
): AvailabilityRange {
  return {
    id,
    userId: String(data.userId ?? fallbackUserId),
    startAt: String(data.startAt ?? ''),
    endAt: String(data.endAt ?? ''),
    kind: data.kind === 'blocked' ? 'blocked' : 'available',
  };
}

/** Live ranges for one official. */
export function subscribeUserAvailability(
  orgId: string,
  uid: string,
  onRanges: (ranges: AvailabilityRange[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    rangesCol(orgId, uid),
    (snap) => {
      const ranges = snap.docs.map((d) =>
        rangeFromFirestore(d.id, d.data() as Record<string, unknown>, uid),
      );
      onRanges(ranges);
    },
    (err) => onError?.(err),
  );
}

/**
 * Subscribe many users' availability (assigner roster).
 * Calls onRanges with the merged set whenever any user updates.
 */
export function subscribeUsersAvailability(
  orgId: string,
  uids: string[],
  onRanges: (ranges: AvailabilityRange[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const byUser = new Map<string, AvailabilityRange[]>();
  const unsubs: Unsubscribe[] = [];
  let cancelled = false;

  const emit = () => {
    const all: AvailabilityRange[] = [];
    for (const list of byUser.values()) all.push(...list);
    onRanges(all);
  };

  const liveUids = [...new Set(uids.filter((u) => u && !u.startsWith('u_')))];
  if (liveUids.length === 0) {
    onRanges([]);
    return () => undefined;
  }

  for (const uid of liveUids) {
    unsubs.push(
      subscribeUserAvailability(
        orgId,
        uid,
        (ranges) => {
          if (cancelled) return;
          byUser.set(uid, ranges);
          emit();
        },
        onError,
      ),
    );
  }

  return () => {
    cancelled = true;
    for (const u of unsubs) u();
  };
}

/**
 * Replace all range docs for a user with `ranges` (must all belong to userId).
 */
export async function syncUserAvailabilityRanges(
  orgId: string,
  userId: string,
  ranges: AvailabilityRange[],
): Promise<void> {
  const database = requireDb();
  const col = rangesCol(orgId, userId);
  const existing = await getDocs(col);
  const nextIds = new Set(
    ranges.filter((r) => r.userId === userId).map((r) => r.id),
  );

  type Op = { kind: 'delete'; id: string } | { kind: 'set'; range: AvailabilityRange };
  const ops: Op[] = [];
  for (const d of existing.docs) {
    if (!nextIds.has(d.id)) ops.push({ kind: 'delete', id: d.id });
  }
  for (const r of ranges) {
    if (r.userId === userId) ops.push({ kind: 'set', range: r });
  }

  for (let i = 0; i < ops.length; i += 400) {
    const chunk = ops.slice(i, i + 400);
    const batch = writeBatch(database);
    for (const op of chunk) {
      if (op.kind === 'delete') {
        batch.delete(doc(col, op.id));
      } else {
        batch.set(doc(col, op.range.id), {
          userId: op.range.userId,
          startAt: op.range.startAt,
          endAt: op.range.endAt,
          kind: op.range.kind,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    await batch.commit();
  }
}

export { defaultOrgId };
