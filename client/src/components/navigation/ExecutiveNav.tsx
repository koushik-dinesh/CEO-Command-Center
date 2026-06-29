import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PRIMARY_NAV, activeNavItem, navHref } from '../../config/navigation';
import { resolveBackNavigation } from '../../config/backNavigation';
import { useCommandCenterContext } from '../../context/CommandCenterContext';
import { useAuth } from '../../hooks/useAuth';
import ThemeToggle from '../ThemeToggle';
import CompanyBranding from './CompanyBranding';
import ExecutiveNavDrawer from './ExecutiveNavDrawer';
import NavBackButton from './DrilldownBackLink';
import { formatRelativeDateTime } from '../../utils/formatters';

function NavPreviewCard({ lines }: { lines: Array<{ label: string; value: string }> }) {
  return (
    <div className="exec-nav-preview">
      {lines.map((line) => (
        <div key={line.label} className="exec-nav-preview-row">
          <span className="exec-nav-preview-label">{line.label}</span>
          <span className="exec-nav-preview-value">{line.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ExecutiveNav() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const { data, snapshotKey, refresh, isRefreshing, isLoading } = useCommandCenterContext();
  const [panelOpen, setPanelOpen] = useState(false);
  const active = activeNavItem(pathname);
  const backNavigation = resolveBackNavigation(pathname);

  useEffect(() => {
    setPanelOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!panelOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [panelOpen]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1400) setPanelOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanelOpen(false);
    }
    if (panelOpen) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelOpen]);

  return (
    <>
      <header className="exec-header sticky top-0 z-50">
      <div className="exec-header-row">
        <div className="exec-header-left">
          <div className="exec-brand-cluster">
            {backNavigation ? (
              <NavBackButton
                to={backNavigation.to}
                label={backNavigation.label}
                snapshotKey={snapshotKey}
              />
            ) : null}
            <Link to={navHref('/', snapshotKey)} className="exec-brand">
              <span className="exec-brand-mark">CC</span>
              <span className="exec-brand-text">
                <span className="exec-brand-eyebrow">Command Center</span>
                <span className="exec-brand-title">CEO Intelligence</span>
              </span>
            </Link>
          </div>
        </div>

        {PRIMARY_NAV.length > 0 ? (
          <nav className="exec-header-center exec-header-center-desktop" aria-label="Primary">
            {PRIMARY_NAV.map((item) => {
              const isActive = item.id === active?.id;
              const preview = item.preview(data);
              return (
                <div key={item.id} className="exec-nav-item-wrap">
                  <Link
                    to={navHref(item.path, snapshotKey)}
                    className={`exec-nav-link ${isActive ? 'exec-nav-link-active' : ''}`}
                    title={item.description}
                  >
                    {item.label}
                  </Link>
                  <NavPreviewCard lines={preview} />
                </div>
              );
            })}
          </nav>
        ) : null}

        <div className="exec-header-right">
          <div className="exec-header-utilities">
            <button
              type="button"
              className={`exec-sync-btn ${isRefreshing ? 'exec-sync-active' : ''}`}
              onClick={() => void refresh()}
              disabled={isRefreshing}
              title="Sync and refresh data"
              aria-label={isRefreshing ? 'Syncing data' : 'Sync data'}
            >
              {isRefreshing ? 'Syncing…' : 'Sync'}
            </button>

            <ThemeToggle />

            <button
              type="button"
              onClick={() => void logout()}
              className="piano-button-secondary exec-signout-btn"
              aria-label="Sign out"
            >
              Sign out
            </button>

            <button
              type="button"
              className={`exec-panel-toggle ${panelOpen ? 'exec-panel-toggle-open' : ''}`}
              onClick={() => setPanelOpen((open) => !open)}
              aria-label={panelOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={panelOpen}
              aria-controls="exec-nav-panel"
            >
              <span className="exec-panel-toggle-icon" aria-hidden="true" />
            </button>
          </div>

          <CompanyBranding />
        </div>
      </div>

      <div className="exec-header-sub">
        <div className="exec-header-sub-inner">
          <span className="exec-sync-status">
            {isRefreshing ? 'Syncing from Google Drive…' : data ? `Synced ${formatRelativeDateTime(data.syncedAt)}` : 'Loading snapshot context…'}
          </span>
        </div>
      </div>
      </header>

      <ExecutiveNavDrawer
        open={panelOpen}
        activeId={active?.id ?? ''}
        snapshotKey={snapshotKey}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
        onClose={() => setPanelOpen(false)}
        onRefresh={() => void refresh()}
        onSignOut={() => void logout()}
      />
    </>
  );
}
