import { Link, useLocation } from 'react-router-dom';
import { activeNavItem, navHref } from '../../config/navigation';
import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const { snapshotKey } = useCommandCenterContext();
  const current = activeNavItem(pathname);

  if (!current) return null;

  return (
    <nav className="exec-breadcrumbs" aria-label="Breadcrumb">
      <Link to={navHref('/', snapshotKey)} className="exec-breadcrumb-link">Overview</Link>
      <span className="exec-breadcrumb-sep">›</span>
      <span className="exec-breadcrumb-current">{current.label}</span>
    </nav>
  );
}

export function useBreadcrumbTitle(): string {
  const { pathname } = useLocation();
  return activeNavItem(pathname)?.label ?? 'Overview';
}
