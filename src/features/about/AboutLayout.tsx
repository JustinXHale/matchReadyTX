import { Outlet } from 'react-router-dom';
import './about.css';
import { AboutSubNav } from '@/features/about/AboutSubNav';

export function AboutLayout() {
  return (
    <div className="rs-stack">
      <AboutSubNav />
      <Outlet />
    </div>
  );
}
