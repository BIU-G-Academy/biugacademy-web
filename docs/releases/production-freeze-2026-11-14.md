# Production freeze, 2026-11-14

| Field         | Value                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner         | @biu-gholdings                                                                                                                                                                       |
| Status        | **Active**: freeze declared; merge train awaiting founder approval                                                                                                                   |
| Version       | 1.0                                                                                                                                                                                  |
| Last reviewed | 2026-11-14                                                                                                                                                                           |
| Related       | [PR register](../governance/pr-reconciliation-register.md), [release gate report](release-gate-report-2026-11-13.md), [branch protection](../security/controls/branch-protection.md) |

## What the freeze means

From 2026-11-14 until the exit criteria below are met:

1. **Only the merge train lands on `main`**, in order. No other feature, content or dependency change merges.
2. **Exception:** a security fix, approved by the founder, recorded in the register with its reason.
3. **No production setting changes** except the two scheduled in the train (the Pages source switch and branch protection), each with founder authorization.
4. **No data collection reopens.** Applications stay closed (PR #7; the code-level gate in PR #14).

## Baseline

| Item            | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `main`          | `d20a948` (PR #10 merged)                                                                          |
| Live site       | GitHub Pages, legacy branch build from `main` `/`; applications closed (verified live after PR #7) |
| Backend hosting | None. Express API, learning service and intake Worker are **not deployed**                         |
| Closed PRs      | #4 (superseded by #7), #5 (closed by founder)                                                      |

## Merge train

Each branch contains all earlier train PRs. Merge **in order** with **"Create a merge commit"**.

| Step | PR  | Head      | Content                                                                                              | Gate before merging                 | After merging                                                                              |
| ---- | --- | --------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| 1    | #6  | `b5f5a94` | Privacy contact pages (PT/EN/FR), small-phone header fix, undeployed intake Worker with tests and CI | Founder approval; CI green          | Check the live privacy pages and phone header                                              |
| 2    | #12 | `db914a0` | Required CI: backend + PostgreSQL, FastAPI security, audits, gitleaks, CodeQL, link check            | **C1 decided**; `secret-scan` green | None                                                                                       |
| 3    | #14 | `093116b` | Learning MVP from #9, PostgreSQL-tested; portal pages `noindex`                                      | Founder approval; CI green          | Close #9 as superseded; check live `portal/learn/` shows "indisponível" with no login form |
| 4    | #11 | `151950e` | Pages deployment from an allowlisted artifact                                                        | Founder approval; CI green          | **Founder:** switch Pages source to GitHub Actions; `verify-live` must pass; then close #8 |
| 5    | #13 | this PR   | Governance, ADRs, register, this freeze record                                                       | Founder approval; CI green          | **Founder:** apply branch protection with the required checks                              |

## Evidence at freeze

Run on the train tip (all five PRs combined), in a clean clone outside iCloud Drive, macOS, Node 24, PostgreSQL 17, Chrome. CI evidence is on each PR.

| Suite                                  | Command                                                      | Result                                                |
| -------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Migrations on an empty DB              | `npm run migrate && npm run migrate:status`                  | 4 applied, 0 pending; re-run applies nothing          |
| Backend (with PostgreSQL)              | `REQUIRE_DATABASE_TESTS=1 npm test`                          | 56/56                                                 |
| Backend dependency gate                | `npm run audit:gate`                                         | Pass (1 reviewed `zod` exception, expires 2026-12-31) |
| FastAPI security                       | `pytest tests_py`                                            | 13/13                                                 |
| Python dependencies                    | `pip-audit -r requirements.txt -r requirements-dev.txt`      | No known vulnerabilities                              |
| Intake Worker                          | `npm audit`; `npm run test:unit`, `test:closed`, `test:e2e`  | 0 vulnerabilities; 15/15; 8/8; 23/23                  |
| Browser (headless Chrome, closed site) | `npm run test:browser`                                       | 7/7                                                   |
| Pages allowlist                        | `node --test scripts/site/test/*.test.mjs`; `build-site.mjs` | 13/13; 64 files, 0 violations                         |
| Documentation                          | Prettier 3.5.3; markdownlint; `check-md-links.mjs`           | Clean; 0 errors; 99 files, 0 broken links             |
| Sequential merge simulation            | merge #6 → #12 → #14 → #11 → #13 onto `main`                 | No conflicts                                          |

## Rollback

| Step              | How                                                                    | Effect                                              |
| ----------------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| Any merge         | `git revert -m 1 <merge commit>` in a PR, then merge                   | Restores the previous site and docs; history kept   |
| Pages switch      | Settings → Pages → Source back to "Deploy from a branch" (`main`, `/`) | Restores the old deploy, **including the exposure** |
| Branch protection | Edit or remove the rule                                                | Immediate                                           |

No step changes a database, credential or external provider, so there is no data rollback.

## Exit criteria (freeze ends)

1. All five train PRs merged in order.
2. `verify-live` passes on `biugacademy.org` (no internal path served).
3. Branch protection active with the required checks.
4. #8 and #9 closed as superseded; register final dispositions filled in.

After exit, production work continues as separate PRs. See the release gate report: hardening of identity (ADR-003), roles and cohort isolation (ADR-004), and audit (ADR-006), then hosting, then the G3 privacy gate.

## Open blockers

| ID  | Blocker                                                                                                                           | Owner   | Blocks           |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------- |
| C1  | Committed local dev database password: confirm not reused, or rotate                                                              | Founder | Step 2           |
| C2  | Unused `CROSS_REPO_PAT` Actions secret                                                                                            | Founder | Not the train    |
| C3  | Undocumented Cloudflare Workers Builds integration                                                                                | Founder | Not the train    |
| D-1 | ADR-001 to ADR-010 approval                                                                                                       | Founder | Post-freeze work |
| ENV | Local repository on the iCloud-synced Desktop was corrupted by iCloud eviction; work from a clone outside iCloud (`~/Developer/`) | Founder | Local tooling    |
