import { useMemo } from 'react';
import { Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { pendingCardReportReopenRequests } from '@/domain/cardReportReopen';
import { CardReportReopenQueue } from '@/features/scheduler/queues/CardReportReopenQueue';
import { useSchedulerRequestActions } from '@/features/scheduler/queues/requestQueuePagesShared';

export function SchedulerQueuesCardReportReopenPage() {
  const { state } = useApp();
  const { cardReopenBusyId, onReviewCardReopen } = useSchedulerRequestActions();
  const pending = useMemo(
    () => pendingCardReportReopenRequests(state.cardReportReopenRequests),
    [state.cardReportReopenRequests],
  );

  return (
    <div className="rs-stack">
      <Title headingLevel="h2" size="md">
        Card report reopen
      </Title>
      <p className="rs-match-card__meta">
        Approve to unlock the submitted report for editing. Deny requires a
        reason shown to the Match Official.
      </p>
      <CardReportReopenQueue
        requests={pending}
        busyId={cardReopenBusyId}
        onApprove={(id) => void onReviewCardReopen(id, 'approve')}
        onDeny={(id, reason) => void onReviewCardReopen(id, 'deny', reason)}
      />
    </div>
  );
}
