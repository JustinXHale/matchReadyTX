import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  FormGroup,
  FormHelperText,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextArea,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { compareKickoffAsc } from '@/domain/divisionFilters';
import type { Match } from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { ProposalQueueList } from '@/features/scheduler/queues/MatchQueueList';
import { QueueSection } from '@/features/scheduler/queues/QueueSection';
import { proposalsAwaitingAck } from '@/features/scheduler/queues/selectors';
import { useWorkDivisionFilters } from '@/features/scheduler/queues/workQueuePagesShared';

function matchForProposal(
  matchId: string,
  matches: Match[],
): Match | undefined {
  return matches.find((m) => m.id === matchId);
}

export function SchedulerQueuesChangesPage() {
  const { state, store, currentUser } = useApp();
  const {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    dateFilter,
    setDateFilter,
    filterOptions,
    filtersActive,
    filterMatch,
    availableDatesFromMatches,
  } = useWorkDivisionFilters(state);

  const [dismissProposalId, setDismissProposalId] = useState<string | null>(
    null,
  );
  const [dismissReason, setDismissReason] = useState('');
  const [dismissRequireReconfirm, setDismissRequireReconfirm] = useState(true);

  const pool = useMemo(
    () => proposalsAwaitingAck(state.proposals),
    [state.proposals],
  );

  const availableDates = useMemo(
    () =>
      availableDatesFromMatches(
        pool
          .map((p) => matchForProposal(p.matchId, state.matches))
          .filter((m): m is Match => m != null),
      ),
    [pool, state.matches, availableDatesFromMatches],
  );

  const proposals = useMemo(() => {
    const filtered = filterMatch(pool, (p) =>
      matchForProposal(p.matchId, state.matches),
    );
    return [...filtered].sort((a, b) => {
      const ma = matchForProposal(a.matchId, state.matches);
      const mb = matchForProposal(b.matchId, state.matches);
      if (!ma && !mb) return 0;
      if (!ma) return 1;
      if (!mb) return -1;
      return compareKickoffAsc(ma, mb);
    });
  }, [pool, state.matches, filterMatch]);

  const dismissTarget = dismissProposalId
    ? state.proposals.find((p) => p.id === dismissProposalId)
    : undefined;

  const openDismiss = (proposalId: string) => {
    const p = state.proposals.find((x) => x.id === proposalId);
    setDismissProposalId(proposalId);
    setDismissReason('');
    setDismissRequireReconfirm(Boolean(p?.kickoffAt));
  };

  const closeDismiss = () => {
    setDismissProposalId(null);
    setDismissReason('');
    setDismissRequireReconfirm(true);
  };

  const confirmDismiss = () => {
    if (!dismissProposalId || !currentUser?.uid || !dismissReason.trim()) {
      return;
    }
    store.dismissProposalAsAssigner(
      dismissProposalId,
      currentUser.uid,
      dismissReason.trim(),
      { requireOfficialsReconfirm: dismissRequireReconfirm },
    );
    closeDismiss();
  };

  if (!filtersActive && proposals.length === 0) {
    return (
      <EmptyState titleText="No pending changes" headingLevel="h3">
        <EmptyStateBody>
          There are no change proposals waiting for your review or apply.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        Change proposals that still need assigner review or apply. Apply updates
        the match and Sheet; deny closes the proposal (use when you already
        handled it offline). Acknowledge only dismisses from your queue without
        closing the proposal.
      </p>

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
        ariaLabel="Filter change proposals by division"
      />
      {filtersActive && proposals.length === 0 && (
        <p className="rs-match-card__meta">
          No change proposals for these filters. Clear competition, date, or
          chips to see everything.
        </p>
      )}

      <QueueSection
        id="queue-proposals"
        title="Proposals to review"
        count={proposals.length}
      >
        {state.org.sheetSyncError && (
          <p className="rs-match-card__meta" role="alert">
            Sheet sync / write-back issue: {state.org.sheetSyncError}. Open
            Upload to fix and sync.
          </p>
        )}
        <ProposalQueueList
          proposals={proposals}
          matches={state.matches}
          emptyText="No change proposals waiting on you."
          onAcknowledge={(id) =>
            store.acknowledgeProposal(id, currentUser?.uid)
          }
          onApply={(id) =>
            store.applyProposalAsAssigner(id, currentUser?.uid)
          }
          onDismiss={openDismiss}
        />
      </QueueSection>

      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(dismissProposalId)}
        onClose={closeDismiss}
        aria-labelledby="dismiss-proposal-title"
        aria-describedby="dismiss-proposal-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="dismiss-proposal-title" size="lg">
            Deny this change?
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="dismiss-proposal-desc" className="rs-modal-lede">
            Use this when you already updated the Sheet offline, or when the
            change should not proceed. A message is required for the proposing
            team
            {dismissTarget?.proposedByName
              ? ` (${dismissTarget.proposedByName})`
              : ''}
            .
          </p>
          <form
            id="dismiss-proposal-form"
            onSubmit={(e) => {
              e.preventDefault();
              confirmDismiss();
            }}
          >
            <FormGroup
              label="Message"
              isRequired
              fieldId="dismiss-proposal-reason"
            >
              <TextArea
                id="dismiss-proposal-reason"
                value={dismissReason}
                onChange={(_e, v) => setDismissReason(v)}
                rows={3}
                isRequired
                aria-required
                placeholder="e.g. Kickoff moved to 7:00 PM — please reconfirm."
              />
            </FormGroup>
            <FormGroup fieldId="dismiss-require-reconfirm">
              <Checkbox
                id="dismiss-require-reconfirm"
                label="Require officials to reconfirm"
                isChecked={dismissRequireReconfirm}
                onChange={(_e, checked) => setDismissRequireReconfirm(checked)}
              />
              <FormHelperText>
                Holds confirmed appointments and sends your message to the
                assigned crew.
              </FormHelperText>
            </FormGroup>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="link" onClick={closeDismiss}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="dismiss-proposal-form"
            variant="danger"
            isDisabled={!dismissReason.trim() || !currentUser?.uid}
          >
            Deny change
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
