# BIU.G Academy intake Worker

Undeployed intake implementation candidate: Cloudflare Worker + D1 + Turnstile. PR #5 was closed without merging on 2026-11-13. This Worker has not been selected as the canonical backend; the Express-versus-Cloudflare decision remains pending. Public applications remain closed.

- `src/index.js` - routes, Turnstile, rate limiting, admin, retention cron
- `src/validate.js` - server-side allow-list validation (minimal data)
- `src/crypto.js` - AES-256-GCM field encryption, HMAC lookups
- `migrations/0001_init.sql` - D1 schema
- `test/` - unit, end-to-end (workerd + local D1) and headless-browser tests; results in `test/artifacts/`

Runbook, retention, rollback and go-live steps: [docs/operations/intake-first-party.md](../docs/operations/intake-first-party.md).

Not deployed. `wrangler.toml` has `workers_dev = false`, no routes and a placeholder D1 id.

The public site has no intake integration. Its privacy pages provide an email contact only. Setting configuration values will not restore the removed frontend handler.

## Tests

From `intake-worker/` (Node 22+, `npm ci` first):

| Command                                     | What it proves                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`                         | Validation, encryption and HMAC helpers                                                                                                                                           |
| `npm run test:closed`                       | Public application and privacy pages contain no form controls and keep the email contact route (source-level)                                                                     |
| `npm run test:e2e`                          | The Worker in the real Workers runtime (`wrangler dev --local`, workerd + local D1): intake, duplicates, Turnstile, rate limits, admin, privacy requests, retention               |
| `CHROME_PATH=<chrome> npm run test:browser` | The closed public site in headless Chrome: no form controls, no non-GET or third-party requests, correct language, closure notice, privacy links, no horizontal overflow at 360px |
| `npm test`                                  | unit + closed-site + e2e                                                                                                                                                          |

CI runs all of the above plus `npm audit --audit-level=high` (`.github/workflows/intake-worker.yml`). Results from the latest local run are in `test/artifacts/`, each with the command, commit and environment in its header.

`test/legacy/browser-intake-forms.e2e.mjs` is the original browser test for the former intake forms, kept with all its assertions for a future reopening. It is not run while the site has no intake forms, and its historical results are not evidence of current behavior.
