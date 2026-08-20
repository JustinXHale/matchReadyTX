import { Navigate } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

/** @deprecated Use SchedulerQueuesRaiseHandRequestsPage — shim for stale imports / HMR. */
export function SchedulerQueuesRequestsPage() {
  const fixturesHref = useAppHref('/scheduler/queues/requests/raise-hand');
  return <Navigate to={fixturesHref} replace />;
}
