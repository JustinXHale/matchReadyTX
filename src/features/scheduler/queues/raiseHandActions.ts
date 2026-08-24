import { resolveRaiseHandApprovalSlot } from '@/domain/requests';
import type { RequestableSlot } from '@/domain/types';
import type { AppState } from '@/services/demoStore';
import { isFirebaseConfigured } from '@/services/firebase';
import { persistCrewAssignmentAndEmail } from '@/services/liveAssignment';
import {
  defaultOrgId,
  saveMatchCrewAssignment,
  updateGameRequestInFirestore,
} from '@/services/orgData';

type RaiseHandStore = {
  getState: () => AppState;
  approveRequest: (id: string, slot?: RequestableSlot) => void;
  declineRequest: (id: string, reason?: string) => void;
};

/** Assigner approves a raise-hand request and persists crew + request status in live mode. */
export async function approveRaiseHandRequest(opts: {
  store: RaiseHandStore;
  dataMode: string;
  requestId: string;
  slot?: RequestableSlot;
}): Promise<void> {
  const { store, dataMode, requestId, slot } = opts;
  const before = store.getState().requests.find((r) => r.id === requestId);
  if (!before) return;

  store.approveRequest(requestId, slot);
  // assignCrew / approveRequest already notify demoStore subscribers.

  if (dataMode !== 'live' || !isFirebaseConfigured) return;

  const match = store.getState().matches.find((m) => m.id === before.matchId);
  const chosen =
    slot ?? (match ? resolveRaiseHandApprovalSlot(match, before) : undefined);
  if (!chosen) return;

  if (chosen === 'cmo') {
    const next = store.getState().matches.find((m) => m.id === before.matchId);
    if (next) {
      await saveMatchCrewAssignment(defaultOrgId(), next);
    }
  } else {
    const next = store.getState().matches.find((m) => m.id === before.matchId);
    if (!next) return;
    await persistCrewAssignmentAndEmail({
      match: next,
      slot: chosen,
      userId: before.userId,
    });
  }

  await updateGameRequestInFirestore(
    defaultOrgId(),
    before.matchId,
    requestId,
    { status: 'approved' },
  );
}

/** Assigner declines a raise-hand request and persists status in live mode. */
export async function declineRaiseHandRequest(opts: {
  store: RaiseHandStore;
  dataMode: string;
  requestId: string;
  reason?: string;
}): Promise<void> {
  const { store, dataMode, requestId, reason } = opts;
  const before = store.getState().requests.find((r) => r.id === requestId);
  if (!before) return;

  store.declineRequest(requestId, reason);

  if (dataMode !== 'live' || !isFirebaseConfigured) return;

  await updateGameRequestInFirestore(
    defaultOrgId(),
    before.matchId,
    requestId,
    { status: 'declined', declineReason: reason },
  );
}
