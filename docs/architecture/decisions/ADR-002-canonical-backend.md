# ADR-002: Canonical backend: one Express + PostgreSQL application

| Field   | Value                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner   | @biu-gholdings                                                                                                                                                |
| Status  | **Proposed**                                                                                                                                                  |
| Version | 1.0                                                                                                                                                           |
| Date    | 2026-11-13                                                                                                                                                    |
| Related | ADR-001, [ADR-003](ADR-003-identity-sessions-recovery.md), [ADR-005](ADR-005-privacy-controls.md), [register](../../governance/pr-reconciliation-register.md) |

## Context

On 2026-11-13 the repository and its open PRs contain four separate data models:

| Stack                           | Where                       | Tables                                                      |
| ------------------------------- | --------------------------- | ----------------------------------------------------------- |
| Express + PostgreSQL            | `backend/server.js`         | `waitlist_applications`, `support_requests`, `email_outbox` |
| FastAPI + SQLite (experiment)   | `backend/fastapi_intake.py` | `applicants`, `message_logs`, `cohort_events`               |
| Cloudflare Worker + D1          | PR #6 `intake-worker/`      | encrypted applications, privacy requests, audit             |
| Express + PostgreSQL (learning) | PR #9 migration `004`       | `academy_accounts`, sessions, cohorts, progress, badges     |

Several stacks mean several sets of authentication, migrations, backups, retention jobs and incident surfaces.

## Decision

1. **One application backend:** Node 22 + Express + PostgreSQL, in `backend/`.
2. **One migration history:** numbered forward-only SQL in `backend/migrations/` (`001`…), with down scripts in `backend/rollback/` (PR #9's pattern), applied by `scripts/migrate.js`. CI applies them to an empty database and requires `0 pending` (PR #12).
3. **PR #9's learning slice is the starting point** for identity, cohorts and progress. It is rebased and hardened per ADR-003 and ADR-004.
4. **PR #6's privacy and intake controls are ported into Express** per ADR-005. The Worker and D1 are not adopted as a second production stack.
5. **The FastAPI experiment and the Apps Script are retired.** They are frozen now (security fixes only, PR #10), removed once their useful parts (deterministic scorer, coach prompt, WhatsApp check-in flow) are re-specified under ADR-007. The pre-closure tree remains on `archive/academy-forms-before-closure-2026-10-28`.
6. **API boundary:** the public site is static (ADR-001). The API is served from its own origin (for example `api.biugacademy.org`, same-site with the site so `SameSite=Lax` cookies work). Routes are versioned under `/api/v1/` when the learning API is rebased; existing `/api/*` routes keep working until the client moves.

## Consequences

- One place to enforce sessions, permissions, audit, consent and retention.
- PR #6's Cloudflare-specific pieces (Turnstile siteverify, D1 queries, cron purge) must be re-implemented. The crypto and validation logic can be ported nearly as-is.
- Hosting for the Express API still has to be chosen and provisioned (G1). Nothing in this ADR deploys anything.

## Alternatives considered

| Option                                               | Why not chosen                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Keep PR #6's Worker for intake, Express for learning | Two data stores holding personal data, two auth models, cross-store joins for admissions → enrollment   |
| Move everything to Workers + D1                      | Discards PR #9 and the PostgreSQL work; D1's relational and transactional limits for the learning model |
| Keep FastAPI                                         | Duplicates Express; its routes were unauthenticated and it is not deployed                              |
