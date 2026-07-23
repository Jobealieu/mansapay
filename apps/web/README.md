# MansaPay Web

React 18 + Vite + TypeScript frontend. Tailwind CSS v4 for styling, React
Router for routing, Framer Motion for the handful of animated moments,
React Context for the small amount of shared state (no external state
management library).

## Demo setup

Bring the whole stack up in this order:

```bash
# 1. Postgres + Redis
docker compose -f infra/docker-compose.yml up -d

# 2. API (terminal 2, leave running) - applies migrations once, then serves
cd apps/api
npm run migrate
npm run dev            # http://localhost:4000

# 3. Web (terminal 3, leave running)
cd apps/web
npm run dev            # http://localhost:5173 (or next free port)
```

Open the web URL Vite prints and start at `/register`. The API has no
CORS headers configured, so the browser can only reach it through the Vite
dev proxy - always go through the web app's own URL, never call
`localhost:4000` directly from a browser tab.

Shut down with `docker compose -f infra/docker-compose.yml down`.

If `apps/web/.env` doesn't exist yet, copy `.env.example` - the default
(`VITE_API_URL=/api`) is correct for the setup above and shouldn't need
changing.

## Design system

Tokens live in `src/index.css` as a Tailwind v4 `@theme` block - this is
v4's CSS-first config mechanism, so there's no separate `tailwind.config.js`.

- **Color**: near-black background (`--color-bg`, not pure black), two
  glass/elevated surface tones, a single gold-to-copper accent gradient
  (`--color-accent-gold` / `--color-accent-copper`) used sparingly on
  primary buttons, focus states, and the logotype, plus semantic
  danger/success colors.
- **Radius**: `--radius-card` (large, for cards) and `--radius-control`
  (buttons/inputs).
- **Shadow**: `--shadow-glass` (ambient card elevation) and
  `--shadow-glow` (soft accent-colored glow on primary actions).
- **Font**: self-hosted variable Inter (`@fontsource-variable/inter`),
  bundled rather than loaded from a CDN so the demo never depends on
  network access for its own fonts.
- **Spacing**: Tailwind's default 4px scale, unmodified.

### Base components (`src/components/ui/`)

- `Button` - primary (gradient)/secondary/ghost variants, `isLoading`
  (spinner overlay, no layout shift) and `disabled` states, press feedback.
- `Input` / `Select` - labelled, with inline error and helper text, sharing
  a `FieldShell` wrapper for consistent spacing and `aria-describedby`
  wiring.
- `Card` - the glass container (border + backdrop blur + soft shadow).
- `Toast` - rendered by `ToastContext`'s `useToast()` hook; auto-dismisses.
- `OtpInput` - six-digit code entry with auto-advance, backspace-to-prev,
  arrow-key navigation, and paste support.

### Motion

Framer Motion drives entrance fades, toast enter/exit, and the OTP
shake-on-error. Every animated component reads `useReducedMotion()` and
drops to a near-instant fade when the user has `prefers-reduced-motion`
set. A matching global CSS rule in `src/index.css` shortens any remaining
CSS transitions to ~0 for the same users, with one deliberate exception:
loading spinners keep spinning under reduced motion, since that motion
communicates "still working" rather than decoration.

## Architecture

- `src/lib/api.ts` - the only place that calls `fetch`. Typed request/response
  shapes (reusing `@mansapay/shared` zod-inferred types where they exist),
  a single `ApiError` type carrying the backend's error code and, for 429s,
  `retryAfterSeconds`. On a 401 from any authenticated call it attempts one
  token refresh via a handler registered by `AuthContext`, retries once, and
  otherwise triggers a session-expired redirect.
- `src/lib/error-messages.ts` - maps backend error codes to human sentences
  (`invalid_credentials` → "Incorrect phone number or password.", etc).
  Nothing raw ever reaches the UI.
- `src/context/AuthContext.tsx` - access token in React state only (never
  persisted); refresh token in `sessionStorage`. See the tradeoff comment
  in that file for why.
- `src/context/ToastContext.tsx` - `useToast().showToast(message, variant)`.
- `src/components/ProtectedRoute.tsx` - redirects to `/login` if there's no
  access token (after a one-time silent refresh attempt on load).

## Scope of this pass

Register, Login, and Verify Phone (OTP) screens only, plus the design
system and API/auth foundations they sit on. No dashboard, wallet, or
transaction history yet - those land in Pass 2, wired into the same
`ProtectedRoute` / `AuthContext` / `Button`/`Input`/`Card` foundation
built here.
