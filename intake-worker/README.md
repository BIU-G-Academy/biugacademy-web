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

Historical browser tests target the former intake UI and are not acceptance evidence for the current closed site. Run the current closure guard from the repository root:

```bash
node --test intake-worker/test/closed-site.test.mjs
```

Original browser tests and artifacts remain intact for future integration work; do not treat their historical results as current passes.
