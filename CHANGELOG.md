# Changelog

All notable changes to this repository are documented here. The public website may deploy independently of changelog entries when only static assets change.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Learning MVP under development, not operational: server sessions, learner/instructor/admin authorization, cohorts, assignments, progress, two earned badges, and cohort insight (`backend/learning/`, `portal/learn/`)
- CubeShackles adapter inventory that stays non-callable (`backend/cubeshackles/adapters.js`, `docs/operations/learning-mvp.md`)
- Forward migration `backend/migrations/004_academy_learning.sql` and an unapplied rollback script in `backend/rollback/`
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

- `POST /api/waitlist` and `POST /api/support` fail closed and do not persist personal data. Public copy remains "As candidaturas ainda não estão abertas." / "Applications are not open yet."
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
