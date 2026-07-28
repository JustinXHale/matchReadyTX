import { Outlet } from 'react-router-dom';
import { GlobalSubNav } from '@/features/global/GlobalSubNav';

export function GlobalLayout() {
  return (
    <div className="rs-stack">
      <GlobalSubNav />
      <Outlet />
    </div>
  );
}
