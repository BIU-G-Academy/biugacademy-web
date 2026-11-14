# Runbook: Pages allowlist cutover

| Field         | Value                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| Owner         | @biu-gholdings                                                                |
| Status        | **Ready for approval**, not executed                                          |
| Version       | 1.0                                                                           |
| Last reviewed | 2026-11-13                                                                    |
| Related       | [ADR-001](../../architecture/decisions/ADR-001-pages-allowlist-deployment.md) |

This changes how production is deployed. **Do not run it without founder authorization.**

## Preconditions

1. The PR adding `.github/workflows/pages.yml` is approved and its `site-artifact` check is green.
2. The artifact inventory in that check's summary has been reviewed: every public page is listed, and nothing else.
3. Someone with repository admin rights is available for the settings change.

## Steps

1. Merge the Pages workflow PR. The `deploy` job is expected to **fail** at this point, because the Pages source is still "Deploy from a branch". The site keeps serving from the branch.
2. In **Settings → Pages → Build and deployment**, change **Source** from "Deploy from a branch" to **"GitHub Actions"**. Keep the custom domain `biugacademy.org` and **Enforce HTTPS** as they are.
3. **Actions → Pages → Run workflow** on `main`.
4. Wait for `deploy` and `verify-live`. `verify-live` retries for about 5 minutes to allow for CDN propagation.

## Acceptance

- `verify-live` passes: every required public path returns 200 and every excluded path does not return 2xx.
- Manual spot check from a clean browser:
  - `https://biugacademy.org/pt/` loads, with styles.
  - `https://biugacademy.org/backend/server.js` returns 404.
  - `https://biugacademy.org/AGENTS.md` returns 404.

## Rollback

1. In **Settings → Pages**, set **Source** back to "Deploy from a branch", with `main` and `/ (root)`.
2. The previous behavior returns within minutes, **including the exposure**. Record the rollback and its reason in the PR reconciliation register.

## Afterwards

- Add `site-artifact` to the required status checks (see `docs/security/controls/branch-protection.md`, added by the governance PR).
- Optional: schedule `verify-deployed.mjs` daily, so a reverted settings change is detected.
