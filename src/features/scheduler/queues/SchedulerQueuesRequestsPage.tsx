import { Navigate } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

/** @deprecated Use SchedulerQueuesFixtureRequestsPage — shim for stale imports / HMR. */
export function SchedulerQueuesRequestsPage() {
  const fixturesHref = useAppHref('/scheduler/queues/requests/fixtures');
  return <Navigate to={fixturesHref} replace />;
}
