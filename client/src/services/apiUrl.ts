/**
 * Builds the request URL. Paths in this app always start with `/api/...`.
 * If VITE_API_BASE_URL is wrongly set to `/api`, avoids `/api/api/...` double prefix.
 */
export function resolveApiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!base) return normalizedPath;

  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${base}${normalizedPath.slice(4)}`;
  }

  return `${base}${normalizedPath}`;
}
