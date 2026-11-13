# BIU.G Academy intake backend

Express + PostgreSQL intake API for BIU.G Academy waitlist applications.

## What this service does

- Exposes structured intake endpoint: `POST /api/waitlist`
- Validates payload server-side (Zod)
- Persists intake records in PostgreSQL
- Applies anti-spam controls (rate limit + honeypot)
- Enforces CORS against `FRONTEND_ORIGIN`

## Project layout

| Path                        | Role                                   |
| --------------------------- | -------------------------------------- |
| `server.js`                 | Express API and routes                 |
| `db.js`                     | PostgreSQL pool and connectivity check |
| `migrations/`               | SQL migrations (ordered)               |
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

## Structured intake test (curl)

```bash
curl -sS -X POST http://localhost:3000/api/waitlist \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -d '{
    "full_name": "Test Applicant",
    "email": "test@example.com",
    "phone_number": "+244923456789",
    "whatsapp_number": "+244923456789",
    "province": "Luanda",
    "municipality": "Luanda",
    "age_range": "25-34",
    "primary_language": "Portuguese",
    "education_level": "Secondary",
    "areas_of_interest": ["financial-literacy", "digital-skills"],
    "technical_background": "Basic digital tools and customer support",
    "internet_access_level": "Mobile data only",
    "device_access": "Smartphone only",
    "employment_status": "Informal worker",
    "linkedin_optional": "",
    "github_optional": "",
    "motivation_statement": "I want to improve practical skills for financial stability and long-term opportunities.",
    "consent_checkbox": true,
    "source_platform": "biugacademy-web",
    "browser_language": "pt-AO",
    "timezone": "Africa/Luanda",
    "referral_source": "manual-test",
    "submission_timestamp": "2026-05-27T15:30:00.000Z",
    "honeypot": ""
  }' | jq .
```

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
