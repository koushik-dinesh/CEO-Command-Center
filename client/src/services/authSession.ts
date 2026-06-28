import { resolveApiUrl } from './apiUrl.js';

export async function clearServerSession(): Promise<void> {
  try {
    await fetch(resolveApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Network errors during session cleanup are non-fatal.
  }
}
