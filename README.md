# MansaPay

A blockchain remittance platform for affordable cross-border money transfers in West Africa. MansaPay lets people send money across borders in seconds, settled on the Stellar network, for a fraction of a cent instead of the 8 to 9 percent that traditional remittances cost in Sub-Saharan Africa.

**Live app:** https://mansapay-web.onrender.com
**API:** https://mansapay.onrender.com/health

---

## The problem

Sending money to Sub-Saharan Africa is among the most expensive in the world. The average cost of sending 200 US dollars to the region sits around 8.78 percent, against a global average near 6.5 percent and a UN Sustainable Development Goal target of 3 percent. On top of that, a large share of adults in the region are unbanked and rely on cash and mobile money rather than traditional bank accounts or email.

## The solution

MansaPay uses the Stellar blockchain and its near-instant, near-free settlement to move value across borders. The pilot corridor is Senegal to The Gambia. Accounts are keyed on phone numbers rather than email, because many target users do not use email. A transfer settles on-chain in around five seconds and costs a tiny fraction of a cent in network fees, and every transaction is verifiable on the public Stellar block explorer.

---

## Try the live demo

The app is deployed and publicly accessible. You can try the full journey in about a minute:

1. Open https://mansapay-web.onrender.com
2. **Register** with a phone number in international format (for example `+2207012345`), a password of at least 8 characters, and country `GM`.
3. **Verify your phone.** The deployed app runs in demo mode, so the verification code is shown on the screen and fills the boxes for you (there is no real SMS in the demo). Tap **Verify**.
4. **Create your wallet** from the dashboard. This generates a Stellar account and funds it with test XLM.
5. **Send money.** To try a transfer you need a second account with a wallet, so register a second user (in a separate private/incognito window) and create its wallet, then send from the first user to the second user's phone number.
6. Each completed transfer links to its transaction on the **Stellar testnet block explorer**, where you can verify it on the public blockchain.

> Note: the app runs on a free hosting tier that sleeps after inactivity. The first request after a period of inactivity may take up to a minute to wake the server. This is expected.

---

## Tech stack

**Backend**
- Node.js 20+ with Express and TypeScript (strict mode)
- PostgreSQL 15 (via `pg`, plain SQL migrations, no ORM)
- Redis 7 (sessions, rate limiting, one-time codes)
- Stellar SDK (`@stellar/stellar-sdk`) on the Stellar test network
- argon2id password hashing, JWT access tokens with rotating refresh tokens
- zod for validation at every boundary

**Frontend**
- React 18 with Vite and TypeScript
- Tailwind CSS v4, Framer Motion, self-hosted Inter font
- React Router

**Infrastructure**
- Docker Compose for local Postgres and Redis
- Deployed on Render (API and static frontend), Upstash (Redis)

---

## Architecture

MansaPay is a TypeScript monorepo using npm workspaces:

```
mansapay/
├── apps/
│   ├── api/          Express backend (REST API, Stellar integration, migrations)
│   └── web/          React frontend (Vite)
├── packages/
│   └── shared/       Shared TypeScript types and zod schemas used by both api and web
├── infra/
│   └── docker-compose.yml   Local Postgres 15 + Redis 7
├── docs/
│   ├── SRS.docx      Software Requirements Specification (with UML in Appendix B)
│   └── adr/          Architecture Decision Records
├── DEPLOYMENT.md     Full step-by-step deployment guide
└── README.md
```

Full requirements and the UML diagrams (use case, class, sequence, deployment) are in the SRS: [`docs/SRS.docx`](docs/SRS.docx). Key design decisions are recorded in [`docs/adr/`](docs/adr/).

---

## Running the project locally

Follow these steps exactly to get MansaPay running on your machine.

### Prerequisites

- **Node.js 20 or newer** (check with `node --version`)
- **Docker** and **Docker Compose** (for local Postgres and Redis)
- **Git**

### 1. Clone the repository

```bash
git clone https://github.com/Jobealieu/mansapay.git
cd mansapay
```

### 2. Install dependencies

From the repo root (this installs all workspaces at once):

```bash
npm install
```

### 3. Start the database and cache

This starts PostgreSQL 15 and Redis 7 in Docker:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Confirm both are healthy:

```bash
docker compose -f infra/docker-compose.yml ps
```

### 4. Configure the API environment

Copy the example env file and fill in the values:

```bash
cp .env.example apps/api/.env
```

Then open `apps/api/.env` and set each variable. The table below explains every one:

| Variable | What it is | Example / how to generate |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API port (optional locally; defaults to 4000) | `4000` |
| `DATABASE_URL` | Postgres connection string | `postgresql://mansapay:mansapay@localhost:5433/mansapay` (match your docker-compose) |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret for signing access tokens, min 32 chars | generate: `openssl rand -base64 48` |
| `WALLET_ENCRYPTION_KEY` | 64-char hex key (32 bytes) that encrypts wallet secret keys at rest | generate: `openssl rand -hex 32` |
| `AT_API_KEY` | Africa's Talking API key (SMS) | from your Africa's Talking sandbox |
| `AT_USERNAME` | Africa's Talking username | `sandbox` |
| `SMS_DEV_MODE` | Dev only: skips real SMS and logs the code instead | `true` for local development |
| `DEMO_MODE` | Marks a public demo deployment; only needed alongside `SMS_DEV_MODE` in production | `false` locally |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API | `http://localhost:5173` |

> For quick local development you can set `SMS_DEV_MODE=true` and `DEMO_MODE=false`. With `SMS_DEV_MODE=true`, verification codes are printed to the API server console instead of being texted.

### 5. Run the database migrations

This creates all tables (users, wallets, transactions, and so on):

```bash
npm run migrate --workspace apps/api
```

### 6. Start the API

```bash
npm run dev --workspace apps/api
```

The API runs on http://localhost:4000. Check it:

```bash
curl http://localhost:4000/health
```

You should see `{"status":"ok","db":"ok","cache":"ok"}`.

### 7. Configure and start the frontend

In a separate terminal, copy the frontend env file:

```bash
cp apps/web/.env.example apps/web/.env
```

Leave `VITE_API_URL=/api` as-is for local development. The Vite dev server proxies `/api` to the API on port 4000, so the browser makes no cross-origin request.

Start the frontend:

```bash
npm run dev --workspace apps/web
```

The app runs on http://localhost:5173. Open it in your browser and register an account. With `SMS_DEV_MODE=true`, check the API terminal for your verification code.

### 8. Run the tests (optional)

```bash
npm test
```

This runs the full backend test suite (96 tests covering auth, sessions, rate limiting, phone verification, wallets, and transactions).

---

## Deployment

The app is deployed on Render (API as a web service, frontend as a static site) with Upstash for Redis. The complete, step-by-step deployment guide, including creating each service, setting every environment variable, and wiring cross-origin access, is in [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Features

MansaPay implements the core user-facing requirements from the SRS:

- **Account registration** with phone number as the primary identifier, argon2id password hashing, and race-safe duplicate detection.
- **Login and sessions** using short-lived JWT access tokens and server-tracked refresh tokens that rotate on every use, so a stolen token is rejected on reuse.
- **Security hardening**: login rate limiting (per phone and per IP), and cascade revocation that kills an entire session chain if a revoked token is replayed.
- **Phone verification** via a one-time code, with an audit trail of every attempt.
- **Stellar wallets**: each user gets a Stellar account whose secret key is encrypted at rest with AES-256-GCM.
- **Cross-border transfers**: send money by phone number, settled on the Stellar network, with balance checks and a transaction hash returned for each transfer.
- **Transaction history**: a paginated record of sent and received transfers, each linking to the public Stellar block explorer.

---

## Author

**Alieu O. Jobe**
BSc Software Engineering, African Leadership University
