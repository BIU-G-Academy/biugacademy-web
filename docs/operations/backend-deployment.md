# Backend deployment

## Current limit (2026-11-07)

Personal-data intake is fail-closed on the learning-MVP branch. `POST /api/waitlist` and `POST /api/support` do not persist. Do not execute the applicant or support release checklist below, and do not send a test applicant through email. That checklist describes the older intake design. It is not permission to collect personal data. Cohort learning deployment, rollback, and the CubeShackles inventory are in [learning-mvp.md](learning-mvp.md).

## Purpose

Deployment notes for the BIU.G Academy API (`backend/`). The API is not a live admissions system while intake is closed.

## Production data path

```text
biugacademy.org
  -> /api/waitlist or /api/support
  -> BIU.G Academy Node API
  -> PostgreSQL transaction
       -> application/support row
       -> email_outbox row(s)
  -> COMMIT
  -> Resend delivery attempt
  -> background retry worker until sent or max attempts reached
```

Application submission creates three durable records in one transaction boundary:

1. the applicant record;
2. a support-notification email intent to `support@biugacademy.org`;
3. an applicant-confirmation email intent to the applicant.

The database transaction is committed before provider delivery is attempted. This prevents a provider outage from losing a valid application and prevents a database rollback from producing emails for an application that was never persisted.

Website support uses the same architecture: the support request and its email intent are committed atomically.

## Supported targets

- Render
- Railway
- Any Node 20+ host with PostgreSQL
- Supabase as the PostgreSQL provider

## Required environment variables

- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — API port (default `3000`)
- `FRONTEND_ORIGIN=https://biugacademy.org`
- `NODE_ENV=production`
- `RESEND_API_KEY` — server-side Resend API key
- `SUPPORT_EMAIL=support@biugacademy.org`
- `EMAIL_FROM=BIU.G Academy <support@biugacademy.org>`

Optional tuning:

- `EMAIL_WORKER_INTERVAL_MS=15000`
- `EMAIL_MAX_ATTEMPTS=5`

The sending domain must be verified with the transactional email provider before production delivery. Keep provider credentials only in the deployment environment; never place them in frontend JavaScript or Git.

## Migrations

Tracked in `schema_migrations`. Files are applied lexicographically from `backend/migrations/`.

Current critical migrations:

- `001_create_waitlist_applications.sql`
- `002_add_waitlist_metadata_and_indexes.sql`
- `003_create_email_outbox.sql`

Before deploy:

```bash
npm run migrate:status
```

During deploy:

```bash
npm run migrate
```

After deploy:

```bash
npm run migrate:status
```

All expected migrations must show `applied`.

## Static-site API routing

GitHub Pages cannot execute `/api/*`. Production must therefore use one of these two patterns:

### Preferred: reverse proxy / edge route

Keep browser URLs same-origin:

```text
https://biugacademy.org/api/* -> deployed BIU.G Academy API
```

This keeps the frontend on `/api/waitlist` and `/api/support` without exposing infrastructure details in page markup.

### Alternative: explicit API origin

Add this to the page `<head>` after the API is deployed:

```html
<meta name="biug-api-base" content="https://api.biugacademy.org" />
```

The backend CORS allowlist must include `https://biugacademy.org`.

## Health checks

- `/health`
- `/health/db`
- `/health/email`

`/health/email` reports whether the provider key is configured and current outbox status counts. It does not expose secrets.

## Deployment target examples

### Render

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm run migrate && npm start`
- Health check: `/health`

### Railway

- Project root: `backend`
- Deploy command: `npm run migrate && npm start`
- Attach PostgreSQL or configure external `DATABASE_URL`

## Release gate

Before making the API the live submission endpoint:

- [ ] PostgreSQL reachable from runtime
- [ ] migration `003_create_email_outbox.sql` applied
- [ ] `RESEND_API_KEY` configured
- [ ] `support@biugacademy.org` sending domain verified with provider
- [ ] `/health` healthy
- [ ] `/health/db` connected
- [ ] `/health/email` shows `provider_configured: true`
- [ ] test applicant receives confirmation email
- [ ] `support@biugacademy.org` receives the complete application details
- [ ] application exists in `waitlist_applications`
- [ ] two corresponding application rows exist in `email_outbox`
- [ ] test support request is persisted in `support_requests`
- [ ] support request reaches `support@biugacademy.org`
- [ ] duplicate application submission returns HTTP 409
- [ ] API base/reverse proxy is configured for the production website
- [ ] no provider secret exists in the browser bundle or repository

## Failure semantics

If PostgreSQL cannot commit, the API returns failure and no transactional email intent is created.

If PostgreSQL commits but the email provider is unavailable, the application remains accepted and the outbox marks delivery failed for retry. The background worker retries with backoff up to `EMAIL_MAX_ATTEMPTS`.

This is the required reliability boundary for BIU.G Academy admissions.
