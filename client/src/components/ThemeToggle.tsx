import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button type="button" onClick={toggleTheme} className="exec-theme-toggle piano-button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold" aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
      <span className="relative h-4 w-8 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)]">
        <span className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--accent)] transition duration-200 ${isDark ? 'left-0.5' : 'left-[1.05rem]'}`} />
      </span>
      <span className="exec-theme-label">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
