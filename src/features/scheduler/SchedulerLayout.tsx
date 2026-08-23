import { useMemo } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import './scheduler.css';
import { ROLE_HOME, useApp, useAppHref } from '@/app/AppContext';
import { countSchedulerQueues } from '@/features/scheduler/queues/selectors';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';

/** Top tabs for Scheduler (assigner) lens — shell only. */
export function SchedulerLayout() {
  const { hasAssignerRole, isAssignerView, roleView, state } = useApp();
  const queuesHref = useAppHref('/scheduler/queues');
  const scheduleHref = useAppHref('/scheduler/schedule');
  const feedbackHref = useAppHref('/scheduler/feedback');
  const uploadHref = useAppHref('/scheduler/upload');
  const roleHome = useAppHref(ROLE_HOME[roleView]);

  const queueTotal = useMemo(
    () => countSchedulerQueues(state).totalActionable,
    [state],
  );

  if (!hasAssignerRole) {
    return (
      <p className="rs-match-card__meta">
        Scheduler tools require an assigner role. Switch user or contact your
        society admin.
      </p>
    );
  }

  // Wrong lens on a /scheduler URL — send them to their active home instead of
  // an empty "switch role" stub (common after login with a stored Referee lens).
  if (!isAssignerView) {
    return <Navigate to={roleHome} replace />;
  }

  return (
    <div className="rs-stack">
      <nav className="rs-top-tabs" aria-label="Scheduler">
        <NavLink
          to={queuesHref}
          className={({ isActive }) =>
            `rs-nav-with-badge${isActive ? ' active' : ''}`
          }
          aria-label={
            queueTotal > 0
              ? `Queues, ${queueTotal} needing action`
              : 'Queues'
          }
        >
          Queues
          {queueTotal > 0 && (
            <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
              {formatDueBadge(queueTotal)}
            </span>
          )}
        </NavLink>
        <NavLink
          to={scheduleHref}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Schedule
        </NavLink>
        <NavLink
          to={feedbackHref}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Feedback
        </NavLink>
        <NavLink
          to={uploadHref}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Upload
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

export function SchedulerIndexRedirect() {
  const coverageHref = useAppHref('/scheduler/queues/coverage');
  return <Navigate to={coverageHref} replace />;
}
