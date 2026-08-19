import { Outlet } from 'react-router-dom';
import { Title } from '@patternfly/react-core';
import { MembersSubNav } from '@/features/members/MembersSubNav';

export function MembersLayout() {
  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Members
      </Title>
      <MembersSubNav />
      <Outlet />
    </div>
  );
}
