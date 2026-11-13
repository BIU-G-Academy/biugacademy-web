# AGENTS.md

Instructions for coding agents (Cursor, Claude Code and others) working in this repository.

## Rules that override everything else

- **Merging to `main` deploys the public site.** GitHub Pages serves `main`. Never merge, close PRs, change repository or Pages settings, or touch production data without explicit founder authorization.
- **Every open PR has a recorded disposition** in [docs/governance/pr-reconciliation-register.md](docs/governance/pr-reconciliation-register.md). Read it before touching files those PRs edit. Do not overwrite other PRs' work; follow [ADR-010](docs/architecture/decisions/ADR-010-pr-reconciliation-and-provenance.md) for provenance.
- **Personal-data intake is closed** (founder directive, PR #7, merged 2026-11-13). Do not reopen forms or add data collection. Reopening is gate G3 in [ADR-005](docs/architecture/decisions/ADR-005-privacy-controls.md).
- **Never commit credentials**, including local development passwords. Use `backend/.env` (git-ignored) and placeholders such as `postgresql://<user>:<password>@127.0.0.1:5432/<db>` in documentation.
- **Evidence:** report a test as passing only if you ran it. Say which tests you did not run.
- Follow the PR checklist in [CONTRIBUTING.md](CONTRIBUTING.md): labels, milestone, CHANGELOG, and docs registered in [docs/README.md](docs/README.md).

## Project overview

BIU.G Academy is an Angola-first technical education initiative (under development). The repository contains:

- **Static site** (repository root: `pt/`, `en/`, `fr/`, `css/`, `js/`, `portal/` …), multilingual, served by GitHub Pages.
- **Express + PostgreSQL backend** (`backend/server.js`): `POST /api/waitlist`, `POST /api/support`, health endpoints, and a transactional email outbox. This is the proposed canonical backend ([ADR-002](docs/architecture/decisions/ADR-002-canonical-backend.md)). It is not deployed by Pages.
- **FastAPI experiment** (`backend/fastapi_intake.py`): legacy intake, coach and WhatsApp endpoints on SQLite. Frozen, and to be retired under ADR-002.
- **Google Apps Script** (`google-apps-script/`): legacy intake bridge, to be retired.

Architecture decisions: [docs/architecture/decisions/](docs/architecture/decisions/README.md).

## Running locally

**Static site** (port 8080): `python3 -m http.server 8080`, then open `/pt/`.

**Express backend** (port 3000) needs PostgreSQL and a database you create locally:

```bash
cd backend
cp .env.example .env            # set DATABASE_URL to your own local database
npm ci
npm run migrate && npm run migrate:status
npm run dev
```

**FastAPI experiment** (port 8000): `cd backend && uvicorn fastapi_intake:app --port 8000 --reload`. `config_loader.py` refuses to start unless `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `OPENAI_API_KEY` and `DATABASE_URL` are all set (placeholders are fine locally). Default storage is SQLite.

## Tests and checks

| Command (from `backend/`)   | Notes                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                  | Node 22+. The API suite needs `DATABASE_URL` pointing at a **disposable** database. On `main` the API suite was removed by PR #7 (it embedded a database password); PR #10 restores it without one. Until PR #10, `npm test` errors on Node ≥ 22 |
| `npm run audit:gate`        | After PR #10: fails on unreviewed high/critical advisories (`audit-exceptions.json`)                                                                                                                                                             |
| `python -m pytest tests_py` | After PR #10: FastAPI security regressions (`pip install -r requirements.txt -r requirements-dev.txt`)                                                                                                                                           |

Repository-wide checks: `npx prettier@3.5.3 --check "**/*.{md,html,css,js,yml,yaml}" --ignore-path .prettierignore` and markdownlint. PR #12 adds CI for all of the above, plus gitleaks, CodeQL and a link check. PR #11 adds `node --test "scripts/site/test/*.test.mjs"`.

## Known gotchas

- **`npm test` on Node ≥ 22:** `node --test test/` treats the directory as a module. Use a glob (fixed in PR #10).
- **The whole repository root is publicly served** until the Pages allowlist cutover (ADR-001, PR #11). Anything you commit appears on `biugacademy.org`.
- **`AI_SERVICE_TOKEN`** (after PR #10): the FastAPI `/ai/*` routes return 503 unless it is set to at least 32 characters, and 401 without a matching `X-Service-Token` header.
- **`backend/ai.js`** (OpenAI classifier) is not imported by anything. The Express intake does not call OpenAI.

## Environment variables

Copy `backend/.env.example` to `backend/.env`. See `backend/README.md`. Credential handling: [docs/security/credential-exposure-review.md](docs/security/credential-exposure-review.md).
