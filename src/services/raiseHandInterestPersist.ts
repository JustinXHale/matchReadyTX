import { syncRaiseHandInterestOnMatch } from '@/domain/raiseHandInterest';
import type { GameRequest, Match } from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import { defaultOrgId, saveMatchRaiseHandInterest } from '@/services/orgData';

type StoreWithMatch = {
  getState: () => { matches: Match[] };
  replaceMatch: (match: Match) => void;
};

export function syncRaiseHandInterestOnStore(
  store: StoreWithMatch,
  matchId: string,
  request: GameRequest,
): Match | null {
  const match = store.getState().matches.find((m) => m.id === matchId);
  if (!match) return null;
  const next = syncRaiseHandInterestOnMatch(match, request);
  store.replaceMatch(next);
  return next;
}

export async function persistRaiseHandInterestIfLive(
  store: StoreWithMatch,
  match: Match,
  dataMode: string,
): Promise<void> {
  store.replaceMatch(match);
  if (dataMode !== 'live' || !isFirebaseConfigured) return;
  await saveMatchRaiseHandInterest(defaultOrgId(), match);
}

export async function syncAndPersistRaiseHandInterest(
  store: StoreWithMatch,
  matchId: string,
  request: GameRequest,
  dataMode: string,
): Promise<Match | null> {
  const next = syncRaiseHandInterestOnStore(store, matchId, request);
  if (!next) return null;
  await persistRaiseHandInterestIfLive(store, next, dataMode);
  return next;
}
