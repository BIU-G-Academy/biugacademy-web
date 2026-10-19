# BIU.G Academy intake Worker

First-party intake API for biugacademy.org: Cloudflare Worker + D1 + Turnstile. Replaces the FormSubmit relay (PR #5, on hold under D-015).

- `src/index.js` - routes, Turnstile, rate limiting, admin, retention cron
- `src/validate.js` - server-side allow-list validation (minimal data)
- `src/crypto.js` - AES-256-GCM field encryption, HMAC lookups
- `migrations/0001_init.sql` - D1 schema
- `test/` - unit, end-to-end (workerd + local D1) and headless-browser tests; results in `test/artifacts/`

Runbook, retention, rollback and go-live steps: [docs/operations/intake-first-party.md](../docs/operations/intake-first-party.md).

Not deployed. `wrangler.toml` has `workers_dev = false`, no routes and a placeholder D1 id.
