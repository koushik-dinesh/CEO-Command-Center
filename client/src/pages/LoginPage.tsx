import { FormEvent, useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('ceo@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="terminal-page px-6 py-8">
      <div className="mx-auto flex max-w-6xl justify-end">
        <ThemeToggle />
      </div>
      <section className="mx-auto mt-16 grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[var(--accent)]">CEO Command Center</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-[var(--text-primary)] sm:text-5xl">Executive visibility, without operational noise.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">A premium command center designed for daily CEO review, boardroom conversations, and decisive strategic monitoring.</p>
        </div>

        <div className="piano-card rounded-2xl p-7">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">Secure Access</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Sign in</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Open the Phase 1 executive KPI dashboard.</p>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              Email
              <input className="mt-2 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3.5 text-[var(--text-primary)] outline-none transition duration-300 placeholder:text-[var(--text-muted)] focus:border-[var(--accent-muted)]" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
            </label>
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              Password
              <input className="mt-2 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3.5 text-[var(--text-primary)] outline-none transition duration-300 placeholder:text-[var(--text-muted)] focus:border-[var(--accent-muted)]" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
            </label>
            {error ? <p className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}
            {import.meta.env.DEV ? (
              <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-xs leading-6 text-[var(--text-secondary)]">
                Dev login: <span className="font-medium text-[var(--text-primary)]">ceo@example.com</span> /{' '}
                <span className="font-medium text-[var(--text-primary)]">ChangeMe123!</span>{' '}
                (from <code className="text-[var(--text-muted)]">CEO_EMAIL</code> / <code className="text-[var(--text-muted)]">CEO_PASSWORD</code> in <code className="text-[var(--text-muted)]">.env</code>)
              </p>
            ) : null}
            <button type="submit" disabled={isSubmitting} className="piano-button w-full px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Signing in...' : 'Open dashboard'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
