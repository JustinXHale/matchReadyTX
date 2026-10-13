import {
  Button,
  EmptyState,
  EmptyStateBody,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextArea,
  Title,
} from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { useApp } from '@/app/AppContext';
import { useAppFeedback } from '@/app/feedback/feedbackContext';
import { MatchSummaryCard } from '@/components/MatchSummaryCard';
import {
  compareKickoffAsc,
  divisionFilterOptionsFromMatches,
  matchOnCalendarDate,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import { matchInCompetition } from '@/domain/competitions';
import { applyMatchScope } from '@/domain/visibility';
import { orgTimeZone } from '@/domain/matchTime';
import { ScheduleMatchListWithPast } from '@/ui/ScheduleMatchListLayout';
import { useScheduleListSections } from '@/ui/useScheduleListSections';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import {
  REQUESTABLE_SLOT_SHORT,
  assignmentForUser,
  type Match,
  type MatchGender,
} from '@/domain/types';
import {
  appointmentMySlot,
  isAppointmentPendingAccept,
} from '@/features/referee/appointments/crewLines';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import type { BackNav } from '@/nav/backNav';
import { MatchActionPrompt } from '@/ui/MatchActionPrompt';
import { isFirebaseConfigured } from '@/services/firebase';
import { callMatchSelfService, defaultOrgId } from '@/services/orgData';
import { fulfillRaiseHandsOnAssignmentConfirm } from '@/features/scheduler/queues/raiseHandActions';

const APPOINTMENTS_BACK: BackNav = {
  to: '/referee/appointments',
  label: 'Assigned',
};

function AppointmentRow({
  match,
  userId,
  busy,
  onAccept,
  onDecline,
}: {
  match: Match;
  userId: string;
  busy: boolean;
  onAccept: (match: Match) => void;
  onDecline: (match: Match) => void;
}) {
  const mySlot = appointmentMySlot(match, userId);
  const awaitingResponse = isAppointmentPendingAccept(match, userId);
  return (
    <MatchSummaryCard
      match={match}
      userId={userId}
      statusPresentation={
        awaitingResponse ? { tone: 'declined', label: 'Pending' } : undefined
      }
      hidePrimaryStatus={awaitingResponse}
      topBanner={
        awaitingResponse && mySlot ? (
          <MatchActionPrompt
            message={`Accept appointment as ${REQUESTABLE_SLOT_SHORT[mySlot]}?`}
            primaryLabel="Accept"
            onPrimary={() => onAccept(match)}
            primaryDisabled={busy}
            secondaryLabel="Decline"
            onSecondary={() => onDecline(match)}
            secondaryDisabled={busy}
            tone="attention"
            ariaLabel={`Respond to ${REQUESTABLE_SLOT_SHORT[mySlot]} appointment`}
          />
        ) : undefined
      }
      to={`/matches/${match.id}`}
      showTime
      back={APPOINTMENTS_BACK}
      footer={
        mySlot ? (
          <MatchCrewTrailing
            match={match}
            highlightUserId={userId}
            back={APPOINTMENTS_BACK}
          />
        ) : null
      }
    />
  );
}

export function AppointmentsPage() {
  const { currentUser, state, store, dataMode } = useApp();
  const { notify } = useAppFeedback();
  const timeZone = orgTimeZone(state.org.timezone);
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [declineMatch, setDeclineMatch] = useState<Match | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const persistResponse = async (
    match: Match,
    action: 'confirm' | 'decline',
    reason?: string,
  ): Promise<boolean> => {
    if (!currentUser) return false;
    const found = assignmentForUser(match, currentUser.uid);
    if (!found?.assignment) return false;
    if (dataMode !== 'live' || !isFirebaseConfigured) return true;
    try {
      await callMatchSelfService({
        orgId: defaultOrgId(),
        matchId: match.id,
        action,
        slot: found.slot,
        assignmentId: found.assignment.id,
        reason,
      });
      return true;
    } catch (error) {
      console.error('Failed to save appointment response', error);
      store.releaseLiveSnapshotGuard(`match:${match.id}`);
      notify(
        error instanceof Error
          ? `Updated locally, but save failed: ${error.message}`
          : 'Updated locally, but save failed.',
        'error',
      );
      return false;
    }
  };

  const acceptAppointment = async (match: Match) => {
    if (!currentUser || busyMatchId) return;
    const found = assignmentForUser(match, currentUser.uid);
    if (!found?.assignment) return;
    setBusyMatchId(match.id);
    try {
      store.confirmCrewSlot(match.id, found.slot, found.assignment.id);
      const saved = await persistResponse(match, 'confirm');
      if (!saved) return;
      await fulfillRaiseHandsOnAssignmentConfirm({
        store,
        dataMode,
        matchId: match.id,
        confirmedUserId: currentUser.uid,
      });
      notify('Appointment accepted.', 'success');
    } finally {
      setBusyMatchId(null);
    }
  };

  const openDecline = (match: Match) => {
    setDeclineReason('');
    setDeclineMatch(match);
  };

  const confirmDecline = async () => {
    if (!currentUser || !declineMatch || !declineReason.trim() || busyMatchId) {
      return;
    }
    const found = assignmentForUser(declineMatch, currentUser.uid);
    if (!found?.assignment) return;
    setBusyMatchId(declineMatch.id);
    try {
      store.officialUnavailable(
        declineMatch.id,
        found.slot,
        declineReason.trim(),
        declineMatch.status === 'needs_reconfirmation'
          ? 'unavailable_on_change'
          : 'declined',
        found.assignment.id,
      );
      const saved = await persistResponse(
        declineMatch,
        'decline',
        declineReason.trim(),
      );
      if (!saved) return;
      setDeclineMatch(null);
      setDeclineReason('');
      notify('Appointment declined.', 'success');
    } finally {
      setBusyMatchId(null);
    }
  };

  const pool = useMemo(() => {
    if (!currentUser) return [] as Match[];
    return [
      ...applyMatchScope(state.matches, currentUser, 'mine', 'official'),
    ].sort(compareKickoffAsc);
  }, [currentUser, state.matches]);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(pool, competitionFilter),
    [pool, competitionFilter],
  );

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        pool.filter((m) => {
          if (genderFilter && m.gender !== genderFilter) return false;
          if (levelFilter && m.level !== levelFilter) return false;
          if (!matchInCompetition(m, competitionFilter)) {
            return false;
          }
          return true;
        }),
      ),
    [pool, genderFilter, levelFilter, competitionFilter],
  );

  const list = useMemo(
    () =>
      pool.filter((m) => {
        if (genderFilter && m.gender !== genderFilter) return false;
        if (levelFilter && m.level !== levelFilter) return false;
        if (!matchInCompetition(m, competitionFilter)) {
          return false;
        }
        return matchOnCalendarDate(m, dateFilter);
      }),
    [pool, genderFilter, levelFilter, competitionFilter, dateFilter],
  );

  const pendingAccept = useMemo(() => {
    if (!currentUser) return [] as Match[];
    return list.filter((m) => isAppointmentPendingAccept(m, currentUser.uid));
  }, [list, currentUser]);

  const confirmed = useMemo(() => {
    if (!currentUser) return [] as Match[];
    return list.filter((m) => !isAppointmentPendingAccept(m, currentUser.uid));
  }, [list, currentUser]);

  const { upcomingByMonth, pastByMonth, pastCount, showPastCollapsed } =
    useScheduleListSections(confirmed, timeZone, !dateFilter);

  if (!currentUser) return null;

  const hasFilters =
    genderFilter != null ||
    levelFilter != null ||
    competitionFilter != null ||
    dateFilter != null;

  if (pool.length === 0) {
    return (
      <div className="rs-stack">
        <EmptyState titleText="No appointments" headingLevel="h3">
          <EmptyStateBody>
            Games you are assigned to will show up here.
          </EmptyStateBody>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="rs-stack">
      <GlobalDivisionFilters
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        showDate
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        availableDates={availableDates}
        ariaLabel="Filter assigned matches"
      />

      {list.length === 0 ? (
        <EmptyState titleText="No matching games" headingLevel="h3">
          <EmptyStateBody>
            {hasFilters
              ? 'No games match these filters. Clear competition, date, or chips to widen.'
              : 'Games you are assigned to will show up here.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          {pendingAccept.length > 0 && (
            <ul className="rs-list" aria-label="Pending acceptance">
              {pendingAccept.map((m) => (
                <li key={`pending-${m.id}`}>
                  <AppointmentRow
                    match={m}
                    userId={currentUser.uid}
                    busy={busyMatchId === m.id}
                    onAccept={(match) => void acceptAppointment(match)}
                    onDecline={openDecline}
                  />
                </li>
              ))}
            </ul>
          )}

          <ScheduleMatchListWithPast
            upcomingByMonth={upcomingByMonth}
            pastByMonth={pastByMonth}
            pastCount={pastCount}
            showPastCollapsed={showPastCollapsed}
            renderMatchRow={(m) => (
              <li key={m.id}>
                <AppointmentRow
                  match={m}
                  userId={currentUser.uid}
                  busy={busyMatchId === m.id}
                  onAccept={(match) => void acceptAppointment(match)}
                  onDecline={openDecline}
                />
              </li>
            )}
          />
        </>
      )}

      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(declineMatch)}
        onClose={() => {
          if (!busyMatchId) setDeclineMatch(null);
        }}
        aria-labelledby="decline-appointment-title"
        aria-describedby="decline-appointment-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="decline-appointment-title" size="lg">
            Decline appointment?
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="decline-appointment-desc" className="rs-modal-lede">
            {declineMatch
              ? `Let the assigner know why you can’t work ${declineMatch.homeTeamName} vs ${declineMatch.awayTeamName}.`
              : 'Let the assigner know why you can’t work this game.'}
          </p>
          <FormGroup label="Reason" isRequired fieldId="appointment-decline-reason">
            <TextArea
              id="appointment-decline-reason"
              value={declineReason}
              onChange={(_, value) => setDeclineReason(value)}
              rows={3}
              aria-required
              autoFocus
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="link"
            isDisabled={Boolean(busyMatchId)}
            onClick={() => setDeclineMatch(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            isDisabled={!declineReason.trim() || Boolean(busyMatchId)}
            isLoading={Boolean(busyMatchId)}
            onClick={() => void confirmDecline()}
          >
            Confirm decline
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
