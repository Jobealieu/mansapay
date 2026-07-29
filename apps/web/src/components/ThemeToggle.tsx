import type { ReactNode } from 'react';
import type { ThemePreference } from '../context/ThemeContext.js';
import { useTheme } from '../context/ThemeContext.js';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: ReactNode;
}

const SUN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const MOON_ICON = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path
      d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SYSTEM_ICON = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    <path d="M8.5 20h7M12 16.5V20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: SUN_ICON },
  { value: 'dark', label: 'Dark', icon: MOON_ICON },
  { value: 'system', label: 'System', icon: SYSTEM_ICON },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-0.5 rounded-control border border-border bg-surface-2 p-0.5">
      {THEME_OPTIONS.map((option) => {
        const isActive = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            aria-label={option.label}
            title={option.label}
            onClick={() => setPreference(option.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-[calc(var(--radius-control)-0.25rem)] transition-colors duration-150 ${
              isActive ? 'bg-surface text-accent-gold shadow-glass' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
