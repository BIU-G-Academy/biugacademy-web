# PR reconciliation register

| Field         | Value                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner         | @biu-gholdings                                                                                                                                         |
| Status        | **Active**: source of truth for every open pull request's disposition                                                                                  |
| Version       | 1.0                                                                                                                                                    |
| Last reviewed | 2026-11-13                                                                                                                                             |
| Mandate       | Master Execution Directive 001 (Phases 0 and 2)                                                                                                        |
| Related       | [ADR-010](../architecture/decisions/ADR-010-pr-reconciliation-and-provenance.md), [release gate report](../releases/release-gate-report-2026-11-13.md) |

**Rules.** Nothing listed here has been merged, closed or deployed by this register. Every _recommended_ disposition needs founder approval before it is carried out. The _final_ disposition column is filled in only after the action happens, with a link to the evidence.

## Inventory snapshot

Taken 2026-11-13 after `git fetch --all --prune`. Repository: `BIU-G-Academy/biugacademy-web` (public). Base for every PR at snapshot time: `main` @ `7d275d5`. **Update 2026-11-13 17:11 UTC:** #7 merged; `main` is now `ecbbc11`, and #10, #12 and this PR were rebased onto it. No PR has reviews. `main` has no branch protection. Pages: legacy branch build from `main` `/`.

No PRs had been opened since the 2026-11-13 audit. PRs #10 to #12 were opened by this workstream.

## Summary matrix

Status as of **2026-11-14** (production freeze). `main` = `d20a948`.

| PR  | Owner / author                           | Objective                                         | Head      | Disposition                                                 | Final disposition                                               |
| --- | ---------------------------------------- | ------------------------------------------------- | --------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| #4  | fabiogmassanga                           | Forms fail closed without a configured API        | `e908177` | Supersede by #7                                             | **Closed** 2026-11-13 17:19 UTC, superseded by #7               |
| #5  | fabiogmassanga (atlas)                   | Interim FormSubmit relay                          | `9c4ab7e` | Retire (third-party relay of personal data)                 | **Closed** 2026-11-13 18:12 UTC by the founder, unmerged        |
| #6  | fabiogmassanga (atlas)                   | Worker intake candidate, privacy pages, phone fix | `b5f5a94` | **Merge: train 1/5**                                        | Open, ready                                                     |
| #7  | fabiogmassanga (cursoragent)             | Close application forms                           | `7b4a0b4` | Merge                                                       | **Merged** 2026-11-13 as `ecbbc11`                              |
| #8  | fabiogmassanga (cursoragent)             | Delete `backend/` from the site root              | `39180fb` | Supersede by #11; close after cutover verification          | Open, pending approval to close                                 |
| #9  | fabiogmassanga (cursoragent)             | Learning MVP                                      | `edbf8ac` | Supersede by #14 (same commits, rebased, provenance kept)   | Open, pending approval to close                                 |
| #10 | this workstream                          | Backend harness and intake security defects       | `dba6f31` | Merge                                                       | **Merged** 2026-11-13 as `d20a948` (with founder fix `11c4ad1`) |
| #12 | this workstream                          | Required CI                                       | `db914a0` | **Merge: train 2/5**, after the C1 decision                 | Open, draft                                                     |
| #14 | Cursor Agent (from #9) + this workstream | Learning MVP, rebased and PostgreSQL-tested       | `093116b` | **Merge: train 3/5**                                        | Open                                                            |
| #11 | this workstream                          | Pages allowlist deployment (ADR-001)              | `151950e` | **Merge: train 4/5**, then founder-authorized Pages cutover | Open, draft                                                     |
| #13 | this workstream                          | Governance, register, freeze record               | (this PR) | **Merge: train 5/5**                                        | Open, draft                                                     |

## Overlap and conflict map

Computed with `git merge-tree` between PR heads on 2026-11-13 ("clean" means no textual conflict).

| Pair    | Result                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| #4 × #5 | conflict: `js/script.js`                                                                                       |
| #4 × #6 | conflict: `js/script.js`                                                                                       |
| #4 × #7 | conflict: `js/script.js`                                                                                       |
| #5 × #6 | conflict: `CHANGELOG.md`, `js/script.js`                                                                       |
| #5 × #7 | conflict: 4 application pages, `js/script.js`                                                                  |
| #5 × #9 | conflict: `CHANGELOG.md`                                                                                       |
| #6 × #7 | conflict: 5 application pages, `js/script.js`                                                                  |
| #6 × #9 | conflict: `CHANGELOG.md`, `docs/README.md`                                                                     |
| #7 × #9 | conflict: `backend/test/api.test.js` (modify/delete)                                                           |
| #8 × #9 | conflict: `backend/.env.example`, `README.md`, `package.json`, `server.js`, `test/api.test.js` (modify/delete) |
| others  | clean                                                                                                          |

PRs #10 and #12 overlap with #7, #8 and #9 on `backend/`. PR #11 has no file overlap with #4–#9.

## Per-PR records

### #4: fix(site): fail closed when no application API is configured

| Field            | Record                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head      | `7d275d5` / `53a254d` (1 commit)                                                                                                                                                                                    |
| Files            | `js/script.js`, `CHANGELOG.md` (+111/−10)                                                                                                                                                                           |
| CI               | markdownlint ✅, prettier-check ✅, Cloudflare "Workers Builds: biugacademy-web" ✅                                                                                                                                 |
| Risk             | Low. It is superseded in effect by #7, which removes submission entirely                                                                                                                                            |
| Evidence         | #7's `js/script.js` contains **0** `fetch`/`XMLHttpRequest`/`sendBeacon` calls, and its application pages contain **no `<form>` elements** (grep of `7b4a0b4`). Nothing can be submitted, which is stricter than #4 |
| Tests            | Allowlist site build of `53a254d`: 58 files, 0 violations                                                                                                                                                           |
| Required changes | None to #4 itself. When intake reopens, the reopened client must keep #4's rule: no submission without an explicitly configured API origin                                                                          |
| Disposition      | **Supersede by #7** after #7 merges. Provenance: record #4's `apiIsConfigured()` design in the intake-reopening PR                                                                                                  |

### #5: fix(intake): FormSubmit relay (interim)

| Field            | Record                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base / head      | `7d275d5` / `9c4ab7e` (2 commits), draft                                                                                                                                                   |
| Files            | 20 (site pages, `js/script.js`, `robots.txt`, `sitemap.xml`, `CHANGELOG.md`)                                                                                                               |
| CI               | markdownlint ✅, prettier-check ✅                                                                                                                                                         |
| Risk             | **High (privacy).** Sends applicant personal data to a third party. Contradicts ADR-005 and founder decision D-015 (hold)                                                                  |
| Evidence         | PR body states the third-party processing and requires founder sign-off                                                                                                                    |
| Required changes | n/a                                                                                                                                                                                        |
| Disposition      | **Retire** (close unmerged) once the first-party replacement (#6 port) is verified. Until then, keep it open and untouched. `robots.txt`/`sitemap.xml` ideas can be re-proposed separately |

### #6: feat(intake): first-party privacy-preserving intake (Worker + D1 + Turnstile), D-015

| Field            | Record                                                                                                                                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head      | `7d275d5` / `c792493` (1 commit), draft, milestone Phase 1                                                                                                                                                                                                                               |
| Files            | 33 (+6649/−997): `intake-worker/`, privacy pages (`pt/privacidade/`, `en/privacy/`, `fr/confidentialite/`), `docs/operations/intake-first-party.md`, `docs/regulatory/data-consent-framework.md`, application pages, `js/script.js`                                                      |
| CI               | markdownlint ✅, prettier-check ✅                                                                                                                                                                                                                                                       |
| Risk             | Medium. A second backend stack (Cloudflare Worker + D1) beside Express + PostgreSQL. Go-live approvals A1–A7 are outstanding                                                                                                                                                             |
| Evidence         | `intake-worker` unit tests: **15/15 pass** (local, Node 24). Committed `stored-row-sample.json` holds only ciphertext/HMAC for name, email and phone, plus `consent_version`, `consent_at`, `guardian_consent` and a one-year `expires_at`                                               |
| Tests not run    | `test:e2e` and `test:browser` (they need `wrangler`/workerd). **Not executed; no claim made**                                                                                                                                                                                            |
| Required changes | Port to Express per ADR-005: AES-256-GCM field encryption with key versioning, HMAC-SHA-256 lookups, Turnstile, Origin allowlist, body cap, hashed-IP rate limit, consent versioning, retention purge, privacy-request/erase endpoints, admin audit log. Privacy pages need legal review |
| Disposition      | **Port**, then mark superseded with a link to the porting PR. Keep open as the reference implementation. Provenance: cherry-pick with `-x` or `Co-authored-by` for reused code                                                                                                           |

### #7: fix(site): close application forms (applications not open yet)

| Field            | Record                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head      | `7d275d5` / `7b4a0b4` (6 commits)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Files            | 44 (+437/−1594): all application and thank-you pages (PT-AO, EN, FR), `js/script.js`, `AGENTS.md` (redaction), docs, **deletes `backend/test/api.test.js`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CI               | markdownlint ✅, prettier-check ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Risk             | Low for the site. The test deletion removes the only API regression suite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Evidence         | Allowlist site build of `7b4a0b4`: **58 files, 0 violations, all internal links resolve**. 0 network calls in `js/script.js`. No `<form>` on the application pages. Markdown link check: 1 broken link, which already exists on `main` (fixed in #12)                                                                                                                                                                                                                                                                                                                                                                                         |
| Required changes | **Keep `backend/test/api.test.js`.** #7 deleted it because it embedded the local database fallback. #10 removes that fallback and repairs the suite, so the deletion is no longer needed. Merge #7, then rebase #10 to restore #10's version                                                                                                                                                                                                                                                                                                                                                                                                  |
| Disposition      | **Merge first** as the intake-closure baseline, after founder review of the PT-AO, EN-US and FR-FR copy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Pre-merge tests  | On `7b4a0b4` (identical to the merge result, since `main` had not moved): Prettier ✅; markdownlint ✅ 0 errors; GitHub CI ✅; allowlist build 58 files, 0 violations ✅; HTTP smoke test 65/65 ✅; 0 `<form>` and 0 personal-data inputs across 53 pages ✅; 17 closure pages in the correct language, all `noindex` ✅; migrations 3 applied, 0 pending ✅; `node --test test/*.test.js` 5/5 ✅. Same as `main`, not caused by #7: `npm test` errors on Node ≥ 22, `npm audit` 1 critical / 4 high / 1 moderate, 1 broken Markdown link (all fixed by #10/#12). Pre-existing: 8 `pt/` and `fr/` alias pages declare `lang="en"` (follow-up) |
| Final            | **Merged 2026-11-13 17:11 UTC** as `ecbbc11` with founder authorization (merge commit pinned to the tested head). Labels `area/site`, `type/fix`, `lang/pt`, `lang/en`, `lang/fr`; milestone Phase 1. Pages build of `ecbbc11` completed. Live check: application pages in PT/EN/FR show the closure sentence, 0 forms, `noindex`; live `js/script.js` makes 0 network calls; live `AGENTS.md` has no password URI                                                                                                                                                                                                                            |

### #8: fix: remove published backend and Apps Script from the site root

| Field            | Record                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head      | `7d275d5` / `39180fb` (2 commits)                                                                                                                                                                                   |
| Files            | 31 (+1/−4709): deletes `backend/` and `google-apps-script/`, moves `CODEOWNERS` to `.github/`, redacts `AGENTS.md`                                                                                                  |
| CI               | markdownlint ✅, prettier-check ✅                                                                                                                                                                                  |
| Risk             | High functional risk. Removes the backend that #9, #10 and #12 build on                                                                                                                                             |
| Evidence         | The problem it addresses is real: 111 non-site files are served by `biugacademy.org` (`verify-deployed.mjs`, 2026-11-13)                                                                                            |
| Required changes | n/a. Replaced by #11, which removes the exposure without deleting code                                                                                                                                              |
| Disposition      | **Supersede by #11** after the Pages cutover passes `verify-live`. The `AGENTS.md` redaction is carried by #7 and this governance PR. The `CODEOWNERS` move is optional (GitHub reads root, `docs/` and `.github/`) |

### #9: Add fail-closed learning MVP for sessions, cohorts, and progress

| Field            | Record                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head      | `7d275d5` / `edbf8ac` (2 commits)                                                                                                                                                                                                                                                                                               |
| Files            | 34 (+4506/−177): `backend/learning/*`, `backend/cubeshackles/adapters.js`, migration `004_academy_learning.sql` + rollback, `portal/learn/*`, tests, docs                                                                                                                                                                       |
| CI               | markdownlint ✅, prettier-check ✅ (backend tests are not in CI on `main`)                                                                                                                                                                                                                                                      |
| Risk             | Medium. Sound foundation (hashed opaque sessions, server-side roles, hard intake gate, adapters that refuse calls). Gaps against ADR-003/004 listed below                                                                                                                                                                       |
| Evidence         | Local, disposable PostgreSQL 17 DB: `npm run migrate` applied `004` cleanly; `npm test` **33/33 pass**. Allowlist site build of `edbf8ac`: 61 files (adds `portal/learn/`), 0 violations                                                                                                                                        |
| Required changes | Rebase onto #7 + #10 + #12. scrypt cost N=2^14 → ≥ 2^17 with rehash on login (ADR-003). Locale constraint must add `fr`. Staff MFA. Verified-email recovery. Permission matrix and cohort isolation tests (ADR-004). `audit_events` (ADR-006). zod 4 migration (closes the audit exception). Run tests in CI against PostgreSQL |
| Disposition      | **Rebase and harden** in a new PR that preserves #9's two commits (rebased, authorship intact). Mark #9 superseded once that PR is open                                                                                                                                                                                         |

### #10: fix(backend): repair test harness and close intake security defects

| Field       | Record                                                                                                                                                                                                                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head | `ecbbc11` / `dba6f31` (2 commits, rebased after #7; previously `ca0b9ec`), draft                                                                                                                                                                                                                                                                    |
| Evidence    | Local: `npm test` 21/21 on a disposable DB (twice); pytest 13/13; `audit:gate` passes. Negative controls against `main`: 3 Node and 10 pytest regressions fail. CI (via #12): `backend-tests` and `fastapi-security` pass on PostgreSQL 16 / Python 3.12. CodeQL found `js/polynomial-redos` (high) in the existing email regex; fixed in `ca0b9ec` |
| Disposition | Merge next. Rebased onto `ecbbc11`; the modify/delete conflict on `backend/test/api.test.js` was resolved by keeping the repaired version (no password fallback). After rebase: `npm test` 21/21 on a fresh disposable DB, `audit:gate` passes, pytest 13/13, Prettier clean                                                                        |

### #11: ci(pages): deploy the public site from an allowlisted artifact

| Field       | Record                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head | `7d275d5` / `7ea6754` (2 commits), draft, `status/deployment-gated`                                                                                                                      |
| Evidence    | Local and CI: `site-artifact` passes (13/13 allowlist tests; 58-file artifact). Live verifier pre-cutover: 111 excluded files reachable (the expected failure, recorded as the baseline) |
| Disposition | Merge, then the founder-authorized cutover (runbook `docs/operations/runbooks/pages-allowlist-cutover.md`, delivered in #11). G0 is met only when `verify-live` passes on the domain     |

### #14: feat(learning): learning MVP (supersedes #9)

| Field       | Record                                                                                                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Head        | `093116b`, stacked on #12                                                                                                                                                                                                           |
| Provenance  | #9's commits `4229bcc` and `edbf8ac` cherry-picked with `-x`, authorship Cursor Agent; `git range-diff` shows the code identical; only `CHANGELOG.md`, `docs/README.md` and `requirements-dev.txt` differ                           |
| Additions   | PostgreSQL-store run of the learning suite (it previously ran only in memory); #10's intake persistence tests preserved behind a test-only gate; `noindex` on all portal pages (found by the browser suite on the integrated train) |
| Evidence    | On the train tip: migrations 001–004, `npm test` 56/56, learning 5/5 on both stores, browser 7/7, `portal/learn/` fails closed on a static host                                                                                     |
| Disposition | Merge as train step 3; close #9 as superseded                                                                                                                                                                                       |

### #12: ci: required backend, security and documentation checks

| Field       | Record                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base / head | `ecbbc11` / `11b6e0d` (contains #10's commits; restacked after #7), draft                                                                                                                                                                                                                                                                                                                                                |
| Evidence    | CI run 1: backend-tests ✅, fastapi-security ✅, dependency-audit ✅, link-check ✅, markdownlint ✅, prettier-check ✅, CodeQL analyses ✅ (one high alert, fixed in #10). **secret-scan ❌**: 6 redacted findings. 3 were allowlist misconfiguration (fixed in `6c43515`); 3 are the committed local dev database URL, which awaits the decision in the [credential review](../security/credential-exposure-review.md) |
| Disposition | Merge after #10, then add its checks to branch protection                                                                                                                                                                                                                                                                                                                                                                |

## Merge train (production freeze)

The open PRs form one linear stack. Each branch contains every PR before it, so each PR's CI tests exactly what `main` becomes when it merges. Simulated sequentially on 2026-11-14: every step merges without conflict.

| Step | PR  | Merge when                                                                 |
| ---- | --- | -------------------------------------------------------------------------- |
| 1    | #6  | Approved                                                                   |
| 2    | #12 | Approved and C1 decided (`secret-scan` green)                              |
| 3    | #14 | Approved; then close #9 as superseded                                      |
| 4    | #11 | Approved; then the Pages source switch, `verify-live` green, then close #8 |
| 5    | #13 | Approved; then branch protection on `main`                                 |

**Rules:** merge in this order only, each with **"Create a merge commit"**. Squash or rebase merges rewrite SHAs and break the later branches. Details: [production freeze record](../releases/production-freeze-2026-11-14.md).

## Discovered during Phase 0

- A **Cloudflare Workers & Pages** GitHub App is installed and reported "Workers Builds: biugacademy-web" on #4. Its purpose and deploy targets are not documented in the repository. Founder to confirm.
- Repository Actions secret **`CROSS_REPO_PAT`** (created 2026-05-21) is not referenced by any workflow on any branch. See the credential review.
- No new pull requests beyond #4–#9.
