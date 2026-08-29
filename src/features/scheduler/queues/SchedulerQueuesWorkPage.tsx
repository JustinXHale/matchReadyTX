import { Navigate } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

/** @deprecated Use SchedulerQueuesCoveragePage — shim for stale imports / HMR. */
export function SchedulerQueuesWorkPage() {
  const changesHref = useAppHref('/scheduler/queues/changes');
  return <Navigate to={changesHref} replace />;
}
