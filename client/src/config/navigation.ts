import type { CommandCenterResponse } from '../types/command-center';

export interface NavPreviewLine {
  label: string;
  value: string;
}

export interface NavItem {
  id: string;
  label: string;
  shortLabel?: string;
  path: string;
  matchPaths: string[];
  description: string;
  menuSubtitle: string;
  preview: (data: CommandCenterResponse | null) => NavPreviewLine[];
}

export const PRIMARY_NAV: NavItem[] = [];

export function activeNavItem(pathname: string): NavItem | null {
  return PRIMARY_NAV.find((item) => item.matchPaths.some((path) => path === pathname || (path !== '/' && pathname.startsWith(path)))) ?? null;
}

export function navHref(path: string, snapshotKey?: string): string {
  if (!snapshotKey) return path;
  return `${path}?snapshot=${encodeURIComponent(snapshotKey)}`;
}
