import type { ReactNode } from 'react';
import DrilldownBackLink from '../navigation/DrilldownBackLink';

export function ExecutiveSummary({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <section className="cc-summary-panel">
      <p className="eyebrow">Executive Summary</p>
      <h2 className="cc-summary-title">{title}</h2>
      <ul className="cc-summary-list">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  );
}

export default function IntelligenceLayout({
  title,
  subtitle,
  backTo,
  backLabel,
  children,
}: {
  title: string;
  subtitle: string;
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="cc-hero dashboard-panel p-5 md:p-6">
        <DrilldownBackLink to={backTo} label={backLabel} />
        <p className="eyebrow">Intelligence Module</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-primary-theme">{title}</h1>
        <p className="mt-2 text-sm text-secondary-theme">{subtitle}</p>
      </section>
      {children}
    </div>
  );
}
