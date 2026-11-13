# Release gate report, 2026-11-13

| Field         | Value                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner         | @biu-gholdings                                                                                                                                                            |
| Status        | **Baseline**: G0 not met                                                                                                                                                  |
| Version       | 1.0                                                                                                                                                                       |
| Last reviewed | 2026-11-13                                                                                                                                                                |
| Related       | [register](../governance/pr-reconciliation-register.md), [ADR index](../architecture/decisions/README.md), [credential review](../security/credential-exposure-review.md) |

**Evidence rule:** PASS means a command was executed, on the commit named, with the stated result. "Not executed" is stated explicitly. Local runs used macOS, Node 24.22.1, PostgreSQL 17.7 (Homebrew), and Python 3.15 in a scratch virtualenv. CI runs used GitHub-hosted Ubuntu, Node 22, PostgreSQL 16 and Python 3.12.

## 1. Baseline on `main` @ `7d275d5`

| Check                    | Result                                                                                             | How                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `npm test` (as defined)  | **FAIL**: `node --test test/` errors on Node ≥ 22 ("Cannot find module …/test"); 0 tests ran       | local                                                    |
| Test files run directly  | scoring **5/5 pass**; API suite **5 cancelled** (`ensureSchema is not a function`)                 | local, disposable DB `biug_baseline_disposable_20261113` |
| Migrations `001`–`003`   | **PASS**: applied to an empty DB, `3 applied, 0 pending`                                           | local                                                    |
| `npm audit --omit=dev`   | **FAIL**: 1 critical (`proxy-addr`), 4 high, 1 moderate                                            | local                                                    |
| Prettier 3.5.3 `--check` | **PASS**                                                                                           | local                                                    |
| markdownlint             | **PASS**: 0 errors in 77 files                                                                     | local                                                    |
| Relative Markdown links  | **FAIL**: 1 broken (`docs/community/roles.md` → `moderation-guidelines.md`)                        | local, `scripts/ci/check-md-links.mjs` (PR #12)          |
| Public domain exposure   | **FAIL**: 111 non-site tracked files served with 200; sensitive probes `.env`, `.git/*` not served | `verify-deployed.mjs https://biugacademy.org` (PR #11)   |
| Branch protection        | **FAIL**: not configured (API 404)                                                                 | `gh api …/branches/main/protection`                      |
| CI on PRs                | Docs lint only (path-filtered); no backend, security or secret checks                              | `.github/workflows/`                                     |
| FastAPI tests            | None existed                                                                                       | n/a                                                      |

## 2. Results on the new branches

| PR / commit           | Check                                          | Result                                                                                                                                                                                       | Where              |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| #10 `ca0b9ec`         | `npm test` (disposable PostgreSQL)             | **PASS 21/21**, run twice on the same DB                                                                                                                                                     | local              |
| #10 `ca0b9ec`         | pytest `tests_py`                              | **PASS 13/13**                                                                                                                                                                               | local              |
| #10 `e9f9781`         | Negative controls on `main`'s code             | 3/3 new Node regressions **fail** on `main`'s `server.js`; 10/13 pytest **fail** on `main`'s `fastapi_intake.py`                                                                             | local              |
| #10 `ca0b9ec`         | `npm run audit:gate`                           | **PASS**: 0 critical; `zod` / `openai`-via-`zod` high accepted by an exception expiring 2026-12-31                                                                                           | local + CI         |
| #11 `7ea6754`         | `site-artifact` (13 allowlist tests + build)   | **PASS**: 58-file artifact, 0 violations                                                                                                                                                     | local + CI         |
| #11                   | `deploy`, `verify-live`                        | Not executed (PR event; needs the Pages cutover)                                                                                                                                             | CI: skipped        |
| #12 `6c43515`         | `backend-tests` (PostgreSQL 16 service)        | **PASS**: migrations, 0 pending, idempotent re-run, tests with `REQUIRE_DATABASE_TESTS=1`                                                                                                    | CI run 43466354935 |
| #12                   | `fastapi-security` (Python 3.12)               | **PASS**                                                                                                                                                                                     | CI                 |
| #12                   | `dependency-audit` (npm gate + pip-audit)      | **PASS**                                                                                                                                                                                     | CI                 |
| #12                   | `codeql` (JS/TS, Python, Actions)              | **PASS**: first run raised 1 high (`js/polynomial-redos`, pre-existing regex), fixed in #10 `ca0b9ec`; 0 open alerts                                                                         | CI                 |
| #12                   | `link-check`, `markdownlint`, `prettier-check` | **PASS**                                                                                                                                                                                     | CI                 |
| #12                   | `secret-scan` (gitleaks, full history)         | **FAIL (expected)**: 3 findings, all credential C1 (commits `a3a01b4`, `36d49b3`, `50f5f49`); awaiting founder decision                                                                      | CI                 |
| #7 `7b4a0b4`          | Allowlist build; network calls; forms          | **PASS**: 58 files, 0 violations; 0 network calls in `js/script.js`; no `<form>` on application pages                                                                                        | local              |
| #7 `ecbbc11` (merged) | Live site after Pages build                    | **PASS**: PT/EN/FR application pages closed, 0 forms, `noindex`; `js/script.js` 0 network calls; `AGENTS.md` without password URI                                                            | `biugacademy.org`  |
| #9 `edbf8ac`          | Migration `004` + `npm test`                   | **PASS 33/33**; `004` applied cleanly to a disposable DB                                                                                                                                     | local              |
| #6 `c792493`          | `intake-worker` unit tests                     | **PASS 15/15**                                                                                                                                                                               | local              |
| #6                    | `test:e2e`, `test:browser`                     | **Not executed** (need wrangler/workerd)                                                                                                                                                     | n/a                |
| all                   | gitleaks locally, lychee                       | **Not executed locally**: downloading and running third-party binaries was not permitted in the local session. gitleaks evidence is from CI; lychee was replaced by the in-repo link checker | n/a                |

Disposable local databases created for these runs: `biug_baseline_disposable_20261113`, `biug_pr9_disposable_20261113`. No shared, staging or production database was touched.

## 3. Gate status

### G0: public deployment isolation, security containment, required CI: **NOT MET**

| Criterion                                                          | Status                                          | Evidence / blocker                                                                               | Owner            |
| ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| Only allowlisted files are served by the domain                    | Implemented (#11), **not live**                 | Needs merge + Pages source → GitHub Actions (settings) + `verify-live` green                     | Founder          |
| Intake defects fixed (consent, identifier, auth, webhook, harness) | Implemented (#10), not merged                   | Tests above                                                                                      | Founder (review) |
| Intake closed on the public site                                   | **Done**: #7 merged as `ecbbc11`, live-verified | Application pages show the closure notice, 0 forms, `noindex`; live script makes 0 network calls | Done             |
| Required CI exists                                                 | Implemented (#12), not merged                   | All jobs pass except `secret-scan` (C1 decision)                                                 | Founder          |
| Branch protection with required checks                             | **Not applied**                                 | Settings change; guide in `docs/security/controls/branch-protection.md`                          | Founder          |
| Credential decisions C1–C3                                         | **Pending**                                     | Credential review                                                                                | Founder          |

### G1: canonical backend, migrations, sessions, RBAC, privacy, staging: **NOT STARTED** (designs proposed)

ADR-002 to ADR-006 are proposed. #9 provides the session and role foundation; its hardening and the #6 port have not started. No staging environment exists.

### G2: admissions, enrollment, workflows, PT-AO / EN-US / FR-FR parity: **NOT STARTED**

PR #9 covers PT and EN in the learning slice only, with a word-list guard; French is not supported in the account model. Native-speaker reviews have not happened.

### G3: real learner data and compliance review: **NOT STARTED**

Blocked on the ADR-005 G3 list: counsel opinion, DPIA, privacy notices, retention schedule, #6 approvals A1–A7.

### G4: CubeShackles sandbox, evidence-backed gamification, operational readiness: **NOT STARTED**

CubeShackles is blocked on a readable sandbox contract (ADR-008). #9 has two completion-based badges.

## 4. Decisions required from the founder

| ID      | Decision                                                                                                          | Unblocks                 |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| D-1     | Approve or amend ADR-001 to ADR-010                                                                               | G0–G4 design             |
| D-2     | C1: confirm the local dev DB password is not reused (or rotate), so its 3 historical fingerprints can be recorded | `secret-scan` green, #12 |
| D-3     | C2: purpose and scope of `CROSS_REPO_PAT`; revoke if unused                                                       | Least privilege          |
| D-4     | C3: role of the Cloudflare Workers & Pages app                                                                    | Deployment inventory     |
| D-5     | Approve the merge order in the register, starting with #7                                                         | G0                       |
| D-6     | Authorize the Pages source switch (cutover runbook, #11)                                                          | G0                       |
| D-7     | Authorize branch protection (guide)                                                                               | G0                       |
| D-8     | Approve the dispositions for #4, #5, #6, #8, #9                                                                   | PR reconciliation        |
| D-DOC-1 | Taxonomy home for `vision/`, `whitepaper/`, `community/`                                                          | Doc migration M6         |
