import { Navigate, useLocation } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

/** Old /scheduler/queues/* URLs → /scheduler/schedule/*. */
export function SchedulerQueuesLegacyRedirect() {
  const { pathname, search } = useLocation();
  const logicalPath = pathname
    .replace(/^\/demo/, '')
    .replace('/scheduler/queues', '/scheduler/schedule');
  const href = useAppHref(logicalPath);
  return <Navigate to={`${href}${search}`} replace />;
}
