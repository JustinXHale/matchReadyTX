import { Navigate } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

/** Coverage merged into Schedule — keep old URL working. */
export function SchedulerQueuesCoveragePage() {
  const scheduleHref = useAppHref('/scheduler/schedule');
  return <Navigate to={`${scheduleHref}?needs=1`} replace />;
}
