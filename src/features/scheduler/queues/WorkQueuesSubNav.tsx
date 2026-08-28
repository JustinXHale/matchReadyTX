import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';
import { countSchedulerQueues } from '@/features/scheduler/queues/selectors';

/** Coverage | Changes | Notifications under Work queues. */
export function WorkQueuesSubNav() {
  const { state } = useApp();
  const coverageHref = useAppHref('/scheduler/queues/coverage');
  const changesHref = useAppHref('/scheduler/queues/changes');
  const notificationsHref = useAppHref('/scheduler/queues/notifications');

  const counts = useMemo(() => countSchedulerQueues(state), [state]);
  const coverageTotal = counts.needsOfficials + counts.needsReassignment;

  return (
    <nav
      className="rs-sub-tabs rs-sub-tabs--tertiary"
      aria-label="Work queue type"
    >
      <NavLink
        to={coverageHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          coverageTotal > 0
            ? `Coverage, ${coverageTotal} needing action`
            : 'Coverage'
        }
      >
        Coverage
        {coverageTotal > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(coverageTotal)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={changesHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          counts.proposals > 0
            ? `Changes, ${counts.proposals} awaiting acknowledgment`
            : 'Changes'
        }
      >
        Changes
        {counts.proposals > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(counts.proposals)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={notificationsHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          counts.notifications > 0
            ? `Notifications, ${counts.notifications} items`
            : 'Notifications'
        }
      >
        Notifications
        {counts.notifications > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(counts.notifications)}
          </span>
        )}
      </NavLink>
    </nav>
  );
}
