import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { PRIMARY_NAV, navHref, type NavItem } from '../../config/navigation';
import { useTheme } from '../../hooks/useTheme';
import { CloseIcon, NavChevronIcon, SignOutIcon, SyncIcon, ThemeIcon } from './DrawerIcons';

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

function DrawerThemeControl() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="exec-settings-theme-control">
      <span className="exec-settings-theme-label">{isDark ? 'Dark' : 'Light'}</span>
      <button
        type="button"
        onClick={toggleTheme}
        className="exec-settings-theme-switch"
        role="switch"
        aria-checked={isDark}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        <span className="exec-settings-theme-switch-track">
          <span className={`exec-settings-theme-switch-thumb ${isDark ? 'is-dark' : 'is-light'}`} />
        </span>
      </button>
    </div>
  );
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
      className={`exec-settings-root ${open ? 'exec-settings-root--open' : ''}`}
      aria-hidden={!open}
      {...(open ? {} : { inert: true })}
    >
      <button
        type="button"
        className="exec-settings-backdrop"
        aria-label="Close settings"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        id="exec-nav-panel"
        className="exec-settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <header className="exec-settings-header">
          <h2 className="exec-settings-header__title">Settings</h2>
          <button
            ref={closeRef}
            type="button"
            className="exec-settings-header__close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="exec-settings-body">
          {PRIMARY_NAV.length > 0 ? (
            <section className="exec-settings-section">
              <p className="exec-settings-section__label">Navigation</p>
              <nav className="exec-settings-nav" aria-label="Primary navigation">
                {PRIMARY_NAV.map((item: NavItem) => {
                  const isActive = item.id === activeId;
                  return (
                    <Link
                      key={item.id}
                      to={navHref(item.path, snapshotKey)}
                      className={`exec-settings-card exec-settings-card--nav ${isActive ? 'exec-settings-card--nav-active' : ''}`}
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="exec-settings-card__text">
                        <span className="exec-settings-card__title">{item.label}</span>
                        <span className="exec-settings-card__subtitle">{item.menuSubtitle}</span>
                      </span>
                      <NavChevronIcon className="exec-settings-card__chevron" />
                    </Link>
                  );
                })}
              </nav>
            </section>
          ) : null}

          <section className="exec-settings-section" aria-label="Actions">
            <p className="exec-settings-section__label">Actions</p>

            <div className="exec-settings-cards">
              <div className="exec-settings-card exec-settings-card--sync">
                <div className="exec-settings-card__leading">
                  <span className="exec-settings-card__icon exec-settings-card__icon--accent" aria-hidden="true">
                    <SyncIcon spinning={isRefreshing} className="exec-settings-card__icon-svg" />
                  </span>
                  <div className="exec-settings-card__text">
                    <p className="exec-settings-card__title">Sync &amp; Refresh</p>
                    <p className="exec-settings-card__subtitle">
                      Fetch the latest data from Google Drive.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="exec-settings-card__btn"
                  onClick={() => void onRefresh()}
                  disabled={isRefreshing || isLoading}
                  aria-busy={isRefreshing}
                >
                  {isRefreshing ? (
                    <span className="exec-settings-card__btn-inner">
                      <SyncIcon spinning className="exec-settings-card__btn-spinner" />
                      Syncing
                    </span>
                  ) : (
                    'Sync'
                  )}
                </button>
              </div>

              <div className="exec-settings-card exec-settings-card--theme">
                <div className="exec-settings-card__leading">
                  <span className="exec-settings-card__icon" aria-hidden="true">
                    <ThemeIcon className="exec-settings-card__icon-svg" />
                  </span>
                  <div className="exec-settings-card__text">
                    <p className="exec-settings-card__title">Theme</p>
                  </div>
                </div>
                <DrawerThemeControl />
              </div>
            </div>
          </section>
        </div>

        <footer className="exec-settings-footer">
          <button
            type="button"
            className="exec-settings-signout"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            aria-label="Sign out of CEO Command Center"
          >
            <SignOutIcon className="exec-settings-signout__icon" />
            <span>Sign Out</span>
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
