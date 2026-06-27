import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { PRIMARY_NAV, navHref, type NavItem } from '../../config/navigation';
import ThemeToggle from '../ThemeToggle';

const SYMBOL_SRC = '/branding/biometric-cables-symbol.png';

interface ExecutiveNavDrawerProps {
  open: boolean;
  activeId: string;
  snapshotKey?: string;
  isRefreshing: boolean;
  isLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
}

export default function ExecutiveNavDrawer({
  open,
  activeId,
  snapshotKey,
  isRefreshing,
  isLoading,
  onClose,
  onRefresh,
  onSignOut,
}: ExecutiveNavDrawerProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`exec-nav-panel-root ${open ? 'exec-nav-panel-root-open' : ''}`}
      aria-hidden={!open}
      {...(open ? {} : { inert: true })}
    >
      <button
        type="button"
        className="exec-nav-panel-backdrop"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        id="exec-nav-panel"
        className="exec-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Executive navigation"
      >
        <header className="exec-nav-panel-header">
          <div className="exec-nav-panel-platform">
            <p className="exec-nav-panel-platform-title">CEO Command Center</p>
            <p className="exec-nav-panel-platform-subtitle">Executive Intelligence Platform</p>
          </div>

          <button type="button" className="exec-nav-panel-close" onClick={onClose} aria-label="Close navigation">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="exec-nav-panel-main">
          {PRIMARY_NAV.length > 0 ? (
            <section className="exec-nav-panel-section">
              <p className="exec-nav-panel-section-label">Intelligence Modules</p>
              <nav className="exec-nav-panel-menu" aria-label="Primary navigation">
                {PRIMARY_NAV.map((item: NavItem) => {
                  const isActive = item.id === activeId;
                  return (
                    <Link
                      key={item.id}
                      to={navHref(item.path, snapshotKey)}
                      className={`exec-nav-panel-item ${isActive ? 'exec-nav-panel-item-active' : ''}`}
                      onClick={onClose}
                    >
                      <span className="exec-nav-panel-item-indicator" aria-hidden="true" />
                      <span className="exec-nav-panel-item-copy">
                        <span className="exec-nav-panel-item-title">{item.label}</span>
                        <span className="exec-nav-panel-item-sub">{item.menuSubtitle}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </section>
          ) : null}

          <section className="exec-nav-panel-section exec-nav-panel-section-utilities">
            <p className="exec-nav-panel-section-label">Utilities</p>
            <div className="exec-nav-panel-menu" role="group" aria-label="Utilities">
              <button
                type="button"
                className={`exec-nav-panel-item exec-nav-panel-item-action ${isRefreshing ? 'exec-sync-active' : ''}`}
                onClick={() => void onRefresh()}
                disabled={isRefreshing}
              >
                <span className="exec-nav-panel-item-indicator exec-nav-panel-item-indicator-muted" aria-hidden="true" />
                <span className="exec-nav-panel-item-copy">
                  <span className="exec-nav-panel-item-title">{isRefreshing ? 'Syncing…' : 'Sync Data'}</span>
                </span>
              </button>

              <div className="exec-nav-panel-item exec-nav-panel-item-action exec-nav-panel-item-theme">
                <span className="exec-nav-panel-item-indicator exec-nav-panel-item-indicator-muted" aria-hidden="true" />
                <span className="exec-nav-panel-item-copy">
                  <span className="exec-nav-panel-item-title">Theme</span>
                </span>
                <ThemeToggle />
              </div>

              <button
                type="button"
                className="exec-nav-panel-item exec-nav-panel-item-action"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
              >
                <span className="exec-nav-panel-item-indicator exec-nav-panel-item-indicator-muted" aria-hidden="true" />
                <span className="exec-nav-panel-item-copy">
                  <span className="exec-nav-panel-item-title">Sign Out</span>
                </span>
              </button>
            </div>
          </section>

          <footer className="exec-nav-panel-branding" aria-label="Biometric Cables">
            <img
              src={SYMBOL_SRC}
              alt=""
              aria-hidden="true"
              className="exec-nav-panel-branding-symbol"
              width={101}
              height={139}
              decoding="async"
            />
            <div className="exec-nav-panel-branding-text">
              <p className="exec-nav-panel-branding-name">Biometric Cables</p>
              <p className="exec-nav-panel-branding-tagline">Excellence till Acceptance</p>
            </div>
          </footer>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
