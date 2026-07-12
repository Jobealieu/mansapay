# SRS Amendments

Log of changes to docs/SRS.docx (or docs/SRS.md) decided after the SRS was
written, each tied to the ADR that made the call.

## 2026-07-13
- NFR-03 (Chapter 5): password hashing changed from bcrypt (12 rounds)
  to argon2id (memoryCost=19456, timeCost=2, parallelism=1) per ADR-0002.
