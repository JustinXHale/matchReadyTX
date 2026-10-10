import { Title } from '@patternfly/react-core';
import { Outlet, useLocation } from 'react-router-dom';
import { stripDemoPrefix } from '@/app/demoPaths';
import { AppointmentsSubNav } from '@/features/referee/appointments/AppointmentsSubNav';

function appointmentsPageTitle(pathname: string): string {
  const path = stripDemoPrefix(pathname);
  if (path.endsWith('/requested')) return 'Requested matches';
  if (path.endsWith('/open')) return 'Available matches';
  return 'Assigned matches';
}

export function RefereeAppointmentsLayout() {
  const { pathname } = useLocation();
  const title = appointmentsPageTitle(pathname);

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        {title}
      </Title>
      <AppointmentsSubNav />
      <Outlet />
    </div>
  );
}
