import { useCallback, useMemo, useState } from 'react';
import {
  divisionFilterOptionsFromFixtureRequests,
  divisionFilterOptionsFromMatches,
  divisionFiltersActive,
  fixtureMatchesDivisionFilters,
  isoOnCalendarDate,
  matchMatchesDivisionFilters,
  matchOnCalendarDate,
  mergeDivisionFilterOptions,
  uniqueIsoCalendarDates,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import type { Match, MatchGender, RequestableSlot } from '@/domain/types';
import {
  pendingFixtureRequests,
  pendingRaiseHandRequests,
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
  callableErrorMessage,
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
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const filterOptions = useMemo(
    () =>
      mergeDivisionFilterOptions(
        divisionFilterOptionsFromMatches(state.matches, competitionFilter),
        divisionFilterOptionsFromFixtureRequests(
          pendingFixtureRequests(state.fixtureRequests),
        ),
      ),
    [state.matches, state.fixtureRequests, competitionFilter],
  );

  const divisionActive = divisionFiltersActive({
    gender: genderFilter,
    level: levelFilter,
    competition: competitionFilter,
  });
  const filtersActive = divisionActive || dateFilter != null;

  const filterFixture = useCallback(
    <T extends Parameters<typeof fixtureMatchesDivisionFilters>[0]>(list: T[]) => {
      if (!filtersActive) return list;
      return list.filter((r) => {
        if (
          !fixtureMatchesDivisionFilters(
            r,
            genderFilter,
            levelFilter,
            competitionFilter,
          )
        ) {
          return false;
        }
        return isoOnCalendarDate(r.kickoffAt, dateFilter);
      });
    },
    [
      filtersActive,
      genderFilter,
      levelFilter,
      competitionFilter,
      dateFilter,
    ],
  );

  const filterRaiseHand = useCallback(
    <T extends { matchId: string }>(list: T[]) => {
      if (!filtersActive) return list;
      return list.filter((r) => {
        const match = state.matches.find((m) => m.id === r.matchId);
        if (match == null) return false;
        if (
          !matchMatchesDivisionFilters(
            match,
            genderFilter,
            levelFilter,
            competitionFilter,
          )
        ) {
          return false;
        }
        return matchOnCalendarDate(match, dateFilter);
      });
    },
    [
      state.matches,
      filtersActive,
      genderFilter,
      levelFilter,
      competitionFilter,
      dateFilter,
    ],
  );

  const availableDatesForFixtures = useMemo(() => {
    const pending = pendingFixtureRequests(state.fixtureRequests).filter((r) =>
      fixtureMatchesDivisionFilters(
        r,
        genderFilter,
        levelFilter,
        competitionFilter,
      ),
    );
    return uniqueIsoCalendarDates(pending.map((r) => r.kickoffAt));
  }, [state.fixtureRequests, genderFilter, levelFilter, competitionFilter]);

  const availableDatesForRaiseHand = useMemo(() => {
    const matches = pendingRaiseHandRequests(state.requests)
      .map((r) => state.matches.find((m) => m.id === r.matchId))
      .filter((m): m is Match => m != null)
      .filter((m) =>
        matchMatchesDivisionFilters(
          m,
          genderFilter,
          levelFilter,
          competitionFilter,
        ),
      );
    return uniqueMatchCalendarDates(matches);
  }, [
    state.requests,
    state.matches,
    genderFilter,
    levelFilter,
    competitionFilter,
  ]);

  return {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    dateFilter,
    setDateFilter,
    filterOptions,
    divisionActive,
    filtersActive,
    filterFixture,
    filterRaiseHand,
    availableDatesForFixtures,
    availableDatesForRaiseHand,
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
        store.markFixtureRequestApprovedOptimistic(id, reviewerId);
        refresh();
        setFixtureBusyId(null);
        await callApproveFixtureRequest({ requestId: id });
      } else {
        store.approveFixtureRequest(id, reviewerId);
        refresh();
      }
    } catch (err) {
      console.error('Approve fixture failed', err);
      refresh();
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
      store.reviewTeamLinkRequest(id, reviewerId, decision, reason);
      refresh();
      setTeamLinkBusyId(null);
      if (dataMode === 'live' && isFirebaseConfigured) {
        await callReviewTeamLinkRequest({
          requestId: id,
          decision,
          denyReason: reason,
        });
      }
    } catch (err) {
      console.error('Team link review failed', err);
      refresh();
      window.alert(
        callableErrorMessage(err, 'Failed to review Team Admin request.'),
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
