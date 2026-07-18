# SRS Amendments

Log of changes to docs/SRS.docx (or docs/SRS.md) decided after the SRS was
written, each tied to the ADR that made the call.

## 2026-07-13
- NFR-03 (Chapter 5): password hashing changed from bcrypt (12 rounds)
  to argon2id (memoryCost=19456, timeCost=2, parallelism=1) per ADR-0002.

## 2026-07-17
- FR-01 amended — email changed from "required and verified" to optional
  and unverified for registration. Phone number is the primary identifier.
  Rationale: many target users in the Senegal-Gambia corridor do not have
  email. Email verification and KYC are handled in later sprints.

## 2026-07-18
- New NFR (security): login rate limiting (5 attempts/phone, 20/IP per
  15 min, Redis-backed) and refresh token family cascade revocation on
  reuse detection, added to the FR-02 login/session flow.
