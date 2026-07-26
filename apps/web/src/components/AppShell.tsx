import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { SiteFooter } from './SiteFooter.js';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const DASHBOARD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M4 11.5L12 4l8 7.5M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SEND_ICON = (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M4.5 12L19.5 5l-5.5 15-2.5-6.5L4.5 12Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HISTORY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M12 7v5l3 2M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: DASHBOARD_ICON },
  { to: '/send', label: 'Send', icon: SEND_ICON },
  { to: '/history', label: 'History', icon: HISTORY_ICON },
];

function navLinkClass(isActive: boolean): string {
  return `transition-colors duration-150 ${isActive ? 'text-accent-gold' : 'text-fg-muted hover:text-fg'}`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
          <span className="bg-gradient-to-br from-accent-gold to-accent-copper bg-clip-text text-lg font-bold tracking-tight text-transparent">
            MansaPay
          </span>

          <nav className="hidden items-center gap-6 text-sm font-medium sm:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => navLinkClass(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-sm font-medium text-fg-muted transition-colors duration-150 hover:text-fg"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col px-4 pb-24 pt-6 sm:px-6 sm:pb-10">
        {children}
        <SiteFooter />
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-4xl items-stretch justify-around">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${navLinkClass(isActive)}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
