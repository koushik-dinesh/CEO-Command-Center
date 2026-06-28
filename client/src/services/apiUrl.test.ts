import { describe, expect, it, vi } from 'vitest';
import { resolveApiUrl } from './apiUrl.js';

describe('resolveApiUrl', () => {
  it('uses path as-is when base is empty', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(resolveApiUrl('/api/auth/login')).toBe('/api/auth/login');
  });

  it('avoids double /api when base is /api', () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    expect(resolveApiUrl('/api/auth/login')).toBe('/api/auth/login');
  });

  it('prefixes absolute API host', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:4000');
    expect(resolveApiUrl('/api/auth/login')).toBe('http://localhost:4000/api/auth/login');
  });
});
