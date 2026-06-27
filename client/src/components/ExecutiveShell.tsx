import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import ThemeToggle from './ThemeToggle';

export default function ExecutiveShell({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth();

  return (
    <div className="terminal-page">
      <header className="app-header sticky top-0 z-40 h-[72px] px-5 backdrop-blur-xl lg:px-7">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[0.7rem] font-bold text-[var(--accent)] shadow-[var(--shadow-soft)]">CC</div>
            <div className="min-w-0">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.26em] text-[var(--accent)]">CEO Command Center</p>
              <h1 className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Executive Analytics</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden text-right md:block">
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[var(--text-muted)]">Operator</p>
              <p className="text-xs font-medium text-[var(--text-secondary)]">{user?.name ?? 'CEO'}</p>
            </div>
            <ThemeToggle />
            <button type="button" onClick={() => void logout()} className="piano-button-secondary px-3.5 py-2 text-xs font-semibold">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-5 py-5 lg:px-7">{children}</main>
    </div>
  );
}
