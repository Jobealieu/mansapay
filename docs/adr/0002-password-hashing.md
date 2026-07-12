# ADR 0002: Password Hashing Algorithm

## Status
Accepted

## Context
The SRS (Chapter 5, NFR-03) specifies bcrypt with at least 12 salt rounds.
CLAUDE.md specifies argon2. No auth code exists yet (Sprint 0 is
scaffolding only), so this conflict does not block current work, but it
must be resolved before Sprint 2 implements registration/login.

## Decision
Use argon2id, via the `argon2` npm package (wraps the reference C
implementation), with parameters:

- memoryCost: 19456 (19 MiB)
- timeCost: 2
- parallelism: 1

These are the OWASP 2024 baseline recommendations for argon2id.

## Consequences
- The `argon2` package compiles a native module during `npm install`,
  so the build environment (local, CI, and any container images) needs a
  working native build toolchain.
- SRS Chapter 5 NFR-03 needs a one-line amendment noting argon2id
  replaces bcrypt. Tracked in `docs/SRS-AMENDMENTS.md`.
- If the parameters above change later (e.g. hardware improves and the
  cost factors are raised), login will need rehash-on-login logic:
  verify with the stored hash's embedded parameters, then, on success,
  re-hash with current parameters and update the stored value.

## Rejected Alternatives
- **bcrypt** (the SRS default): rejected because it is not memory-hard,
  which makes GPU-based brute-force attacks cheaper than against
  argon2id.
