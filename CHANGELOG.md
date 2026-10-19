# Changelog

All notable changes to this repository are documented here. The public website may deploy independently of changelog entries when only static assets change.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- Application forms (PT/EN/FR) and the support widget no longer post to `/api/waitlist` and `/api/support` on static hosting, where GitHub Pages answers 404/405. When no Academy API base is configured, forms submit natively to their declared FormSubmit action and the support widget uses the FormSubmit AJAX endpoint. The API path is unchanged when `data-api-base`, `<meta name="biug-api-base">` or `window.BIUG_API_BASE` is set.

### Added

- `robots.txt` and `sitemap.xml`; self-referencing `<link rel="canonical">` on primary pages
- Opt-in analytics loader (Cloudflare Web Analytics or GA4) that stays disabled until a token or measurement ID is configured; no token is committed
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
