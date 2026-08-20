import { Outlet } from 'react-router-dom';
import { RequestsQueuesSubNav } from '@/features/scheduler/queues/RequestsQueuesSubNav';

/** Tertiary tabs under Requests — Fixtures | Team links | Raise-hand. */
export function SchedulerQueuesRequestsLayout() {
  return (
    <>
      <RequestsQueuesSubNav />
      <Outlet />
    </>
  );
}
