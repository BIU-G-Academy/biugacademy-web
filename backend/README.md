# BIU.G Academy intake backend

Express + PostgreSQL intake API for BIU.G Academy waitlist applications.

## What this service does

- Serves a non-production learning API (sessions, roles, cohorts, progress) documented in `docs/operations/learning-mvp.md`
- Keeps `POST /api/waitlist` and `POST /api/support` fail-closed. They do not persist personal data in this build
- Validates any future intake payload server-side (Zod) only if a later reviewed change reopens intake in code
- Enforces CORS against `FRONTEND_ORIGIN`

## Project layout

| Path                        | Role                                   |
| --------------------------- | -------------------------------------- |
| `server.js`                 | Express API and routes                 |
| `learning/`                 | Sessions, RBAC, cohorts, progress      |
| `cubeshackles/adapters.js`  | Non-callable integration inventory     |
| `db.js`                     | PostgreSQL pool and connectivity check |
| `migrations/`               | SQL migrations (ordered)               |
| `rollback/`                 | Manual down scripts, not auto-run      |
| `scripts/migrate.js`        | Migration runner                       |
| `scripts/migrate-status.js` | Migration status reporter              |
| `test/`                     | Node test suite                        |

## Local setup (reproducible)

### 1) Install dependencies

```bash
cd backend
npm install
```

### 2) Create local PostgreSQL database

Example commands (adapt credentials for your machine):

```bash
createdb biug_academy
```

If your user is not default, create a role first:

```bash
createuser biug --pwprompt
```

### 3) Configure environment

Create `backend/.env` from `.env.example`:

```env
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/biug_academy
PORT=3000
FRONTEND_ORIGIN=https://biugacademy.org
NODE_ENV=development
```

### 4) Check migration status

```bash
npm run migrate:status
```

Use this before and after deployment to confirm which SQL migrations are applied or still pending. Pending migrations must be reviewed before a production release.

### 5) Run migrations

```bash
npm run migrate
```

### 6) Start backend

```bash
npm run dev
```

## Health checks

### API health

```bash
curl -sS http://localhost:3000/health | jq .
```

Expected:

```json
{
  "ok": true,
  "service": "biug-academy-intake-api",
  "status": "healthy"
}
```

### Database health

```bash
curl -sS http://localhost:3000/health/db | jq .
```

Expected:

```json
{
  "ok": true,
  "database": "connected"
}
```

## Closed intake check (curl)

```bash
curl -sS -X POST http://localhost:3000/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"honeypot":""}'
```

Expected HTTP 403 with `persisted: false` and both `As candidaturas ainda não estão abertas.` and `Applications are not open yet.` Do not send a real applicant.

Learning routes and the synthetic demo are documented in `docs/operations/learning-mvp.md`.

## Scripts

| Script                   | Purpose                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `npm run migrate:status` | List applied and pending migrations                                                          |
| `npm run migrate`        | Run pending SQL migrations                                                                   |
| `npm run dev`            | Start API with nodemon                                                                       |
| `npm start`              | Start API in production mode                                                                 |
| `npm test`               | Run test suite (API suite needs `DATABASE_URL` for a disposable DB; otherwise it is skipped) |
| `npm run audit:gate`     | Fail on unreviewed high/critical production advisories (see `audit-exceptions.json`)         |

## Security notes

- Never commit `.env` or credentials.
- `DATABASE_URL` is required but never logged by this service.
- Rate limiter remains active on waitlist endpoint.
- Honeypot remains active.
- CORS is restricted to `FRONTEND_ORIGIN` (+ localhost in non-production).

## Deployment

For Render, Railway, and Supabase PostgreSQL guidance, see:

- `docs/operations/backend-deployment.md`

## Future CI path

Live database is not required in GitHub Actions today. Future CI can run against ephemeral PostgreSQL service containers with `npm run migrate` before tests.
