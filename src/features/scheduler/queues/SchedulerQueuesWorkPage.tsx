import { Navigate } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

/** @deprecated Use SchedulerQueuesCoveragePage — shim for stale imports / HMR. */
export function SchedulerQueuesWorkPage() {
  const coverageHref = useAppHref('/scheduler/queues/coverage');
  return <Navigate to={coverageHref} replace />;
}
