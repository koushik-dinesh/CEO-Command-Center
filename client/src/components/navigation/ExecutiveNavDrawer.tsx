import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { PRIMARY_NAV, navHref, type NavItem } from '../../config/navigation';
import ThemeToggle from '../ThemeToggle';
import { CloseIcon, NavChevronIcon, SignOutIcon, SyncIcon, ThemeIcon } from './DrawerIcons';

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
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

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
        aria-label="Close navigation panel"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        id="exec-nav-panel"
        className="exec-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation and settings"
      >
        <header className="exec-drawer-header">
          <div className="exec-drawer-header-brand">
            <img
              src={SYMBOL_SRC}
              alt=""
              aria-hidden="true"
              className="exec-drawer-header-logo"
              width={40}
              height={55}
              decoding="async"
            />
            <div className="exec-drawer-header-copy">
              <p className="exec-drawer-header-name">Biometric Cables</p>
              <p className="exec-drawer-header-sub">CEO Command Center</p>
            </div>
          </div>

          <button
            ref={closeRef}
            type="button"
            className="exec-drawer-close"
            onClick={onClose}
            aria-label="Close navigation panel"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="exec-drawer-body">
          {PRIMARY_NAV.length > 0 ? (
            <section className="exec-drawer-section">
              <h2 className="exec-drawer-section-label">Intelligence Modules</h2>
              <nav className="exec-drawer-nav" aria-label="Primary navigation">
                {PRIMARY_NAV.map((item: NavItem) => {
                  const isActive = item.id === activeId;
                  return (
                    <Link
                      key={item.id}
                      to={navHref(item.path, snapshotKey)}
                      className={`exec-drawer-nav-item ${isActive ? 'exec-drawer-nav-item-active' : ''}`}
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="exec-drawer-nav-copy">
                        <span className="exec-drawer-nav-title">{item.label}</span>
                        <span className="exec-drawer-nav-sub">{item.menuSubtitle}</span>
                      </span>
                      <NavChevronIcon className="exec-drawer-nav-chevron" />
                    </Link>
                  );
                })}
              </nav>
            </section>
          ) : null}

          <section className="exec-drawer-section exec-drawer-section-actions" aria-label="Actions">
            <h2 className="exec-drawer-section-label">Actions</h2>

            <div className="exec-drawer-actions">
              <button
                type="button"
                className={`exec-drawer-action exec-drawer-action-primary ${isRefreshing ? 'exec-drawer-action-busy' : ''}`}
                onClick={() => void onRefresh()}
                disabled={isRefreshing || isLoading}
                aria-busy={isRefreshing}
                aria-label={isRefreshing ? 'Syncing and refreshing data' : 'Sync and refresh data from Google Drive'}
              >
                <span className="exec-drawer-action-icon exec-drawer-action-icon-accent" aria-hidden="true">
                  <SyncIcon spinning={isRefreshing} />
                </span>
                <span className="exec-drawer-action-copy">
                  <span className="exec-drawer-action-title">
                    {isRefreshing ? 'Syncing…' : 'Sync & Refresh'}
                  </span>
                  <span className="exec-drawer-action-sub">
                    Fetch the latest data from Google Drive.
                  </span>
                </span>
              </button>

              <div className="exec-drawer-action exec-drawer-action-theme">
                <span className="exec-drawer-action-icon" aria-hidden="true">
                  <ThemeIcon />
                </span>
                <span className="exec-drawer-action-copy">
                  <span className="exec-drawer-action-title">Theme</span>
                </span>
                <ThemeToggle variant="switch" />
              </div>
            </div>
          </section>
        </div>

        <footer className="exec-drawer-footer">
          <button
            type="button"
            className="exec-drawer-signout"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            aria-label="Sign out of CEO Command Center"
          >
            <SignOutIcon className="exec-drawer-signout-icon" />
            <span className="exec-drawer-signout-label">Sign Out</span>
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
