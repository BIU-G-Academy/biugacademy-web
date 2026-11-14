# ADR-001: Publish the public site from an allowlisted Pages artifact

| Field         | Value                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Owner         | @biu-gholdings                                                                                                      |
| Status        | **Proposed**, awaiting founder approval                                                                             |
| Version       | 1.0                                                                                                                 |
| Date          | 2026-11-13                                                                                                          |
| Last reviewed | 2026-11-13                                                                                                          |
| Supersedes    | The deletion strategy in PR #8 (on approval)                                                                        |
| Related       | ADR-002 (canonical backend, governance PR), [cutover runbook](../../operations/runbooks/pages-allowlist-cutover.md) |

## Context

GitHub Pages deploys `main` from the repository root (`.nojekyll` present). Every tracked file is therefore public on `biugacademy.org`. On 2026-11-13, `scripts/site/verify-deployed.mjs` found **111 tracked files that are not part of the website** served with HTTP 200, including `backend/server.js`, `backend/.env.example`, `backend/migrations/*.sql`, `google-apps-script/Code.gs`, `AGENTS.md` and all of `docs/`.

The GitHub repository is itself public, so this is not a disclosure of otherwise-private content. It still matters:

- server code and internal documents are published under the institution's domain and indexed as if they were part of the site;
- any future mistake (a committed secret, a data export) would be published to the domain on merge;
- server code cannot live in the repository without being published, which is why PR #8 deletes `backend/` and why PR #8 and PR #9 cannot both merge.

## Decision

Deploy Pages with GitHub Actions from an artifact built by `scripts/site/build-site.mjs`:

1. Only **git-tracked** files are considered, so untracked local files (for example `.env`) can never be published.
2. A file is published only if it is a listed root file, or it lives in a listed public directory **and** has an allowed static-asset extension (`scripts/site/public-site.json`).
3. Forbidden segments (`backend`, `docs`, `scripts`, `migrations`, `test`, …), forbidden names (`*.md`, `*.sql`, `*.json`, dotfiles, …) and secret-shaped content fail the build even inside an allowed directory.
4. Every internal link in the artifact must resolve inside the artifact.
5. After each deploy, `verify-live` requests every excluded tracked file and a list of sensitive probes from `https://biugacademy.org` and fails if any returns 2xx.

## Consequences

- `backend/` and future server code can stay in the repository with full history. PR #8's deletion is no longer required; PR #9 can be rebased without a modify/delete conflict.
- Adding a public directory or extension is an explicit, reviewable change to `public-site.json`.
- **Requires a repository settings change** (Pages source → GitHub Actions). That is a production deployment change and needs founder authorization. Until it happens, the `deploy` job fails on `main` and the legacy branch deployment keeps serving everything.
- Files under `docs/` stop being reachable on the domain. No public page links to them (verified by the internal link check); they remain readable on GitHub.

## Alternatives considered

| Option                                     | Why not chosen                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Merge PR #8 (delete `backend/`)            | Removes code that PR #9 builds on; leaves no structural protection against future additions                                     |
| `_config.yml` `exclude`                    | Ignored because `.nojekyll` disables Jekyll                                                                                     |
| Move the site into `site/` and deploy that | Rewrites every public path in history and every open PR; the artifact allowlist achieves the same boundary without moving files |
| Separate platform repository               | Viable later; splits history and review now, and does not by itself protect the site repository                                 |

## Verification

- `node --test "scripts/site/test/*.test.mjs"`: positive and negative allowlist cases, injected-file guard, untracked-file exclusion, and deployed-origin simulation (passes against an artifact-only origin, fails against a whole-repository origin, fails when the origin is unreachable).
- `node scripts/site/verify-deployed.mjs https://biugacademy.org`: before cutover, 111 failures (recorded 2026-11-13). After cutover the `verify-live` job must pass.
