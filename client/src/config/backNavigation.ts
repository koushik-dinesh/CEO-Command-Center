export interface BackNavigation {
  to: string;
  label: string;
}

export function resolveBackNavigation(pathname: string): BackNavigation | null {
  if (pathname === '/' || pathname === '/login') return null;

  if (pathname === '/revenue-drilldown') {
    return { to: '/intelligence/revenue', label: 'Back to Revenue Intelligence' };
  }

  if (pathname.startsWith('/intelligence/')) {
    return { to: '/', label: 'Back to Command Center' };
  }

  return null;
}
