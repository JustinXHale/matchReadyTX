import { useCallback, useMemo, useState } from 'react';
import {
  divisionFilterOptionsFromFixtureRequests,
  divisionFilterOptionsFromMatches,
  divisionFiltersActive,
  mergeDivisionFilterOptions,
} from '@/domain/divisionFilters';
import type { MatchGender, RequestableSlot } from '@/domain/types';
import {
  fixtureMatchesDivisionFilters,
  matchMatchesDivisionFilters,
  pendingFixtureRequests,
} from '@/features/scheduler/queues/selectors';
import {
  approveRaiseHandRequest,
  declineRaiseHandRequest,
} from '@/features/scheduler/queues/raiseHandActions';
import { useApp } from '@/app/AppContext';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  callApproveFixtureRequest,
  callReviewTeamLinkRequest,
  declineFixtureRequestInFirestore,
  defaultOrgId,
} from '@/services/orgData';
import type { AppState } from '@/services/demoStore';

export const REQUESTS_QUEUES_BACK = {
  to: '/scheduler/queues/requests/fixtures',
  label: 'Requests',
} as const;

export function useRequestDivisionFilters(state: AppState) {
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );

  const filterOptions = useMemo(
    () =>
      mergeDivisionFilterOptions(
        divisionFilterOptionsFromMatches(state.matches),
        divisionFilterOptionsFromFixtureRequests(
          pendingFixtureRequests(state.fixtureRequests),
        ),
      ),
    [state.matches, state.fixtureRequests],
  );

  const divisionActive = divisionFiltersActive({
    gender: genderFilter,
    level: levelFilter,
    competition: competitionFilter,
  });

  const filterFixture = useCallback(
    <T extends Parameters<typeof fixtureMatchesDivisionFilters>[0]>(list: T[]) => {
      if (!divisionActive) return list;
      return list.filter((r) =>
        fixtureMatchesDivisionFilters(
          r,
          genderFilter,
          levelFilter,
          competitionFilter,
        ),
      );
    },
    [divisionActive, genderFilter, levelFilter, competitionFilter],
  );

  const filterRaiseHand = useCallback(
    <T extends { matchId: string }>(list: T[]) => {
      if (!divisionActive) return list;
      return list.filter((r) => {
        const match = state.matches.find((m) => m.id === r.matchId);
        return (
          match != null &&
          matchMatchesDivisionFilters(
            match,
            genderFilter,
            levelFilter,
            competitionFilter,
          )
        );
      });
    },
    [
      state.matches,
      divisionActive,
      genderFilter,
      levelFilter,
      competitionFilter,
    ],
  );

  return {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    filterOptions,
    divisionActive,
    filterFixture,
    filterRaiseHand,
  };
}

export function useSchedulerRequestActions() {
  const { store, dataMode, refresh, currentUser } = useApp();
  const [fixtureBusyId, setFixtureBusyId] = useState<string | null>(null);
  const [teamLinkBusyId, setTeamLinkBusyId] = useState<string | null>(null);

  const onApproveRaiseHand = (id: string, slot?: RequestableSlot) => {
    void approveRaiseHandRequest({
      store,
      dataMode,
      requestId: id,
      slot,
    }).catch((err) => {
      console.error('Failed to save/email raise-hand approve', err);
      window.alert(
        err instanceof Error
          ? `Approved locally, but save failed: ${err.message}`
          : 'Approved locally, but save failed.',
      );
    });
  };

  const onDeclineRaiseHand = (id: string, reason?: string) => {
    void declineRaiseHandRequest({
      store,
      dataMode,
      requestId: id,
      reason,
    }).catch((err) => console.error('Decline raise-hand failed', err));
  };

  const onApproveFixture = async (id: string) => {
    const reviewerId = currentUser?.uid;
    if (!reviewerId) return;
    setFixtureBusyId(id);
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await callApproveFixtureRequest({ requestId: id });
        refresh();
      } else {
        store.approveFixtureRequest(id, reviewerId);
        refresh();
      }
    } catch (err) {
      console.error('Approve fixture failed', err);
      window.alert(
        err instanceof Error
          ? err.message
          : 'Failed to approve fixture request.',
      );
    } finally {
      setFixtureBusyId(null);
    }
  };

  const onDeclineFixture = async (id: string, reason?: string) => {
    const reviewerId = currentUser?.uid;
    if (!reviewerId) return;
    store.declineFixtureRequest(id, reviewerId, reason);
    refresh();
    if (dataMode === 'live' && isFirebaseConfigured) {
      try {
        await declineFixtureRequestInFirestore(
          defaultOrgId(),
          id,
          reviewerId,
          reason,
        );
      } catch (err) {
        console.error('Decline fixture failed', err);
        window.alert(
          err instanceof Error
            ? err.message
            : 'Failed to save decline to Firestore.',
        );
      }
    }
  };

  const onReviewTeamLink = async (
    id: string,
    decision: 'approve' | 'deny',
    reason?: string,
  ) => {
    const reviewerId = currentUser?.uid;
    if (!reviewerId) return;
    setTeamLinkBusyId(id);
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await callReviewTeamLinkRequest({
          requestId: id,
          decision,
          denyReason: reason,
        });
        refresh();
      } else {
        store.reviewTeamLinkRequest(id, reviewerId, decision, reason);
        refresh();
      }
    } catch (err) {
      console.error('Team link review failed', err);
      window.alert(
        err instanceof Error
          ? err.message
          : 'Failed to review Team Admin request.',
      );
    } finally {
      setTeamLinkBusyId(null);
    }
  };

  return {
    fixtureBusyId,
    teamLinkBusyId,
    onApproveFixture,
    onDeclineFixture,
    onReviewTeamLink,
    onApproveRaiseHand,
    onDeclineRaiseHand,
  };
}
