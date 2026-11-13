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

Taken 2026-11-13 after `git fetch --all --prune`. Repository: `BIU-G-Academy/biugacademy-web` (public). Base for every PR: `main` @ `7d275d5`. No PR has reviews. `main` has no branch protection. Pages: legacy branch build from `main` `/`.

No PRs had been opened since the 2026-11-13 audit. PRs #10 to #12 were opened by this workstream.

## Summary matrix

| PR  | Owner / author               | Objective                                            | Head      | Recommended disposition                                                                      | Final disposition |
| --- | ---------------------------- | ---------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- | ----------------- |
| #4  | fabiogmassanga               | Forms fail closed without a configured API           | `53a254d` | **Supersede by #7** once #7 merges; carry `apiIsConfigured` into reopened intake             | Pending approval  |
| #5  | fabiogmassanga (atlas)       | Interim FormSubmit relay for applications            | `9c4ab7e` | **Retire** once the first-party replacement is verified; do not merge                        | Pending approval  |
| #6  | fabiogmassanga (atlas)       | First-party privacy-preserving intake (Worker + D1)  | `c792493` | **Port** privacy and intake controls into Express (ADR-002, ADR-005); keep open as reference | Pending approval  |
| #7  | fabiogmassanga (cursoragent) | Close application forms (founder directive)          | `7b4a0b4` | **Merge first** (intake-closure baseline) after one change (see below)                       | Pending approval  |
| #8  | fabiogmassanga (cursoragent) | Delete `backend/` and Apps Script from the site root | `39180fb` | **Supersede by #11** (allowlist deployment); do not merge                                    | Pending approval  |
| #9  | fabiogmassanga (cursoragent) | Learning MVP: sessions, roles, cohorts, progress     | `edbf8ac` | **Rebase and harden** on the consolidated foundation as a new PR                             | Pending approval  |
| #10 | this workstream              | Backend test harness and intake security defects     | `ca0b9ec` | Merge after #7 (rebase to keep the repaired `api.test.js`)                                   | Open, draft       |
| #11 | this workstream              | Pages allowlist deployment (ADR-001)                 | `7ea6754` | Merge, then the founder-authorized cutover                                                   | Open, draft       |
| #12 | this workstream              | Required CI checks (stacked on #10)                  | `6c43515` | Merge after #10; then require its checks                                                     | Open, draft       |

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

| Field            | Record                                                                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head      | `7d275d5` / `7b4a0b4` (6 commits)                                                                                                                                                                                                                     |
| Files            | 44 (+437/−1594): all application and thank-you pages (PT-AO, EN, FR), `js/script.js`, `AGENTS.md` (redaction), docs, **deletes `backend/test/api.test.js`**                                                                                           |
| CI               | markdownlint ✅, prettier-check ✅                                                                                                                                                                                                                    |
| Risk             | Low for the site. The test deletion removes the only API regression suite                                                                                                                                                                             |
| Evidence         | Allowlist site build of `7b4a0b4`: **58 files, 0 violations, all internal links resolve**. 0 network calls in `js/script.js`. No `<form>` on the application pages. Markdown link check: 1 broken link, which already exists on `main` (fixed in #12) |
| Required changes | **Keep `backend/test/api.test.js`.** #7 deleted it because it embedded the local database fallback. #10 removes that fallback and repairs the suite, so the deletion is no longer needed. Merge #7, then rebase #10 to restore #10's version          |
| Disposition      | **Merge first** as the intake-closure baseline, after founder review of the PT-AO, EN-US and FR-FR copy                                                                                                                                               |

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
| Base / head | `7d275d5` / `ca0b9ec` (2 commits), draft                                                                                                                                                                                                                                                                                                            |
| Evidence    | Local: `npm test` 21/21 on a disposable DB (twice); pytest 13/13; `audit:gate` passes. Negative controls against `main`: 3 Node and 10 pytest regressions fail. CI (via #12): `backend-tests` and `fastapi-security` pass on PostgreSQL 16 / Python 3.12. CodeQL found `js/polynomial-redos` (high) in the existing email regex; fixed in `ca0b9ec` |
| Disposition | Merge after #7. Rebase keeps `backend/test/api.test.js`                                                                                                                                                                                                                                                                                             |

### #11: ci(pages): deploy the public site from an allowlisted artifact

| Field       | Record                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base / head | `7d275d5` / `7ea6754` (2 commits), draft, `status/deployment-gated`                                                                                                                      |
| Evidence    | Local and CI: `site-artifact` passes (13/13 allowlist tests; 58-file artifact). Live verifier pre-cutover: 111 excluded files reachable (the expected failure, recorded as the baseline) |
| Disposition | Merge, then the founder-authorized cutover (runbook `docs/operations/runbooks/pages-allowlist-cutover.md`, delivered in #11). G0 is met only when `verify-live` passes on the domain     |

### #12: ci: required backend, security and documentation checks

| Field       | Record                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base / head | `7d275d5` / `6c43515` (contains #10's commits), draft                                                                                                                                                                                                                                                                                                                                                                    |
| Evidence    | CI run 1: backend-tests ✅, fastapi-security ✅, dependency-audit ✅, link-check ✅, markdownlint ✅, prettier-check ✅, CodeQL analyses ✅ (one high alert, fixed in #10). **secret-scan ❌**: 6 redacted findings. 3 were allowlist misconfiguration (fixed in `6c43515`); 3 are the committed local dev database URL, which awaits the decision in the [credential review](../security/credential-exposure-review.md) |
| Disposition | Merge after #10, then add its checks to branch protection                                                                                                                                                                                                                                                                                                                                                                |

## Recommended merge order

Every step needs founder approval.

1. **#7**: intake-closure baseline.
2. **#10**: rebased on #7, keeping the repaired `api.test.js`.
3. **#12**: required CI, after the secret-scan decision.
4. **This governance PR**: register, ADRs, credential review, branch-protection guide.
5. **#11**, then the **Pages cutover** (settings change), then `verify-live` green, then **close #8** as superseded.
6. **Branch protection** on `main` with the required checks (settings change).
7. **#9 rebased and hardened** (new PR), then mark #9 superseded.
8. **#6 privacy/intake port** (new PR), then mark #6 superseded, **close #4** (after #7) and **close #5**.

## Discovered during Phase 0

- A **Cloudflare Workers & Pages** GitHub App is installed and reported "Workers Builds: biugacademy-web" on #4. Its purpose and deploy targets are not documented in the repository. Founder to confirm.
- Repository Actions secret **`CROSS_REPO_PAT`** (created 2026-05-21) is not referenced by any workflow on any branch. See the credential review.
- No new pull requests beyond #4–#9.
