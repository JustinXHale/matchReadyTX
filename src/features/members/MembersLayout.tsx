import { Outlet, useLocation } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import './members.css';
import { MembersSubNav } from '@/features/members/MembersSubNav';

export function MembersLayout() {
  const { isFanView } = useApp();
  const location = useLocation();
  const path = location.pathname.replace(/^\/demo/, '') || '/';
  const reportDrilldown = /\/about\/members\/[^/]+\/(cmo|feedback)\//.test(
    path,
  );
  return (
    <div className="rs-stack">
      {!isFanView && !reportDrilldown && <MembersSubNav />}
      <Outlet />
    </div>
  );
}
