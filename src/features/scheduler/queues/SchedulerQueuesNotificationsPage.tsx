import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { NotificationsQueue } from '@/features/scheduler/queues/NotificationsQueue';
import { QueueSection } from '@/features/scheduler/queues/QueueSection';
import { countSchedulerQueues } from '@/features/scheduler/queues/selectors';

export function SchedulerQueuesNotificationsPage() {
  const { state } = useApp();
  const notifications = useMemo(
    () => state.notifications.slice(0, 40),
    [state.notifications],
  );
  const count = useMemo(
    () => countSchedulerQueues(state).notifications,
    [state],
  );

  if (notifications.length === 0) {
    return (
      <EmptyState titleText="No notifications" headingLevel="h3">
        <EmptyStateBody>
          Coverage alerts and system notices will appear here when sent.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        Recent coverage alerts and assigner notices (newest first).
      </p>

      <QueueSection
        id="queue-notifications"
        title="Notifications"
        count={count}
      >
        <NotificationsQueue notifications={notifications} />
      </QueueSection>
    </>
  );
}
