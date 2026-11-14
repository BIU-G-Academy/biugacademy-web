# Changelog

All notable changes to this repository are documented here. The public website may deploy independently of changelog entries when only static assets change.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Security

- Backend intake no longer fabricates consent or contact data for the legacy simplified payload; consent must be explicitly `true`, and email-only applicants no longer share a placeholder phone number (which also caused false duplicate rejections)
- `POST /api/waitlist` duplicate responses no longer disclose the existing applicant identifier
- Email shape check no longer uses a polynomial-backtracking regular expression on untrusted input (CodeQL `js/polynomial-redos`)
- Legacy FastAPI service: `/ai/*` routes require `X-Service-Token` (fails closed when `AI_SERVICE_TOKEN` is unset); WhatsApp webhook verifies `X-Hub-Signature-256`; secret comparisons are constant-time; inbound WhatsApp messages no longer set broadcast opt-in
- Dependency audit: non-breaking fixes applied (critical `proxy-addr` resolved), `qs` pinned through `overrides`, remaining `zod` advisory covered by a reviewed, expiring exception enforced by `npm run audit:gate`

### Fixed

- Public pages no longer scroll horizontally on small phones: the header (brand, PT/EN/FR switcher, menu) overflowed at 360px and 320px on every page
- Backend test harness: API suite applies the real migrations instead of the missing `ensureSchema`, skips explicitly without `DATABASE_URL` (fails when `REQUIRE_DATABASE_TESTS=1`), and no longer embeds a fallback database connection string; `npm test` works on Node 22+

### Added

- First-party intake (D-015): `intake-worker/` Cloudflare Worker + D1 + Turnstile with encrypted contact fields, retention cron, deletion-request path and token/Access-protected admin export; tests in `intake-worker/test/`
- Privacy contact pages in PT/EN/FR (`/pt/privacidade/`, `/en/privacy/`, `/fr/confidentialite/`), with no data-entry forms or claims of deployed intake processing
- `docs/operations/intake-first-party.md` runbook

- Institutional documentation taxonomy: partnerships, governance, metrics, branding, i18n
- Root `ARCHITECTURE.md` with system overview and Mermaid diagrams
- `docs/operations/deployment-guide.md` and `docs/operations/pdf-export-pipeline.md`
- `docs/governance/transparency-policy.md` and `docs/metrics/outcomes-framework.md`
- `docs/partnerships/partnership-framework.md`
- `docs/branding/brand-guidelines.md` (canonical)
- `docs/REPOSITORY_MATURITY.md` checklist
- Repository hygiene: `.editorconfig`, Prettier, markdownlint, CODEOWNERS, GitHub templates, docs-lint CI
- Transactional application engine: PostgreSQL persistence with atomic `email_outbox` intents (`backend/email_outbox.js`, `backend/migrations/003_create_email_outbox.sql`)
- `POST /api/support` and `/health/email` endpoints
- Role portal foundation: admin, student, teacher, moderator shells under `portal/`
- `docs/operations/backend-deployment.md` — API production deployment guide

### Changed

- PR #6 reconciled with the merged #7 baseline: applications remain closed and the navigation-only script does not collect or submit form data; the Worker remains an undeployed implementation candidate
- Intake Worker tests: browser suite rewritten for the closed public site (headless Chrome, 7 checks); original form-flow suite preserved under `intake-worker/test/legacy/`; `npm test` now includes the closed-site guard; new `Intake worker` CI workflow (audit, unit, closed-site, e2e, browser)
- Intake Worker dev dependencies: `wrangler` 4.156.0, `puppeteer-core` 25.16.0 (npm audit 12 findings → 0)

- `README.md`, `ROADMAP.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md` — institutional upgrade
- Roadmap rephased to Phases 0–6 (website → partnerships)
- `docs/design/brand-guidelines.md` redirects to `docs/branding/`

### Added (prior unreleased)

- Strategic white paper v1.0: `docs/whitepaper/biug-academy-whitepaper-v1.md`

## [0.1.0] - 2026-05-26

### Added

- Institutional documentation foundation under `docs/`
- Root governance files: `CONTRIBUTING.md`, `GOVERNANCE.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `ROADMAP.md`, `LICENSE`, `CHANGELOG.md`
- Expanded `README.md` with mission, routes, status, and regulatory disclosure
- Vision, architecture, curriculum, regulatory, operations, design, community, and deployment documentation

### Notes

- Phase 0 (public presence and intake foundation) marked active in `ROADMAP.md`
- No change to public homepage visual design or product features in this release
