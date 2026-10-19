# First-party intake (Cloudflare Worker + D1 + Turnstile)

Status: **built and tested locally, not deployed.** Founder decision D-015 (2026-10-19) holds PR #5 (FormSubmit relay) and asks for a first-party, privacy-preserving alternative. This document is the runbook for that alternative.

## Data path

```text
Browser (biugacademy.org, GitHub Pages)
  |  HTTPS POST, JSON, Turnstile token, Origin allow-list
  v
intake.biugacademy.org  -> Worker "biug-academy-intake"
  |  server-side validation, honeypot, rate limit, Turnstile siteverify
  |  name / email / phone / support text encrypted (AES-256-GCM) in the Worker
  v
D1 "biug-academy-intake"  (contact lookups by HMAC-SHA-256 hash only)
  ^
  |  admin export / erase / purge: Bearer token + Cloudflare Access
Founder / authorised staff
```

No third party other than Cloudflare (processor) receives form data. GitHub Pages serves static files only.

## What is collected (minimal first stage)

| Field                                    | Required   | Why                                             |
| ---------------------------------------- | ---------- | ----------------------------------------------- |
| Full name                                | yes        | Identify the applicant                          |
| Email **or** phone (at least one)        | yes        | Contact about the cohort                        |
| Phone has WhatsApp, preferred channel    | no         | Choose the cheapest working channel             |
| Province (21 provinces + outside Angola) | yes        | Cohort priority, geographic reporting           |
| Age range                                | yes        | Eligibility; 16-17 needs guardian authorisation |
| Main language, education level           | yes        | Lesson language and level                       |
| Areas of interest (1-4)                  | yes        | Track allocation                                |
| Internet access, device                  | no         | Low-data delivery planning                      |
| Consent version and time                 | server-set | Proof of consent                                |
| Referral (hostname or campaign tag only) | auto       | Channel attribution, no full URLs               |

Removed from the first stage: municipality, employment status, technical background, motivation essay, LinkedIn, GitHub, separate WhatsApp number, browser language, timezone, client timestamp. Ask for these only after selection.

## Retention

| Record                                | Kept for                       | How it ends                         |
| ------------------------------------- | ------------------------------ | ----------------------------------- |
| Application                           | 12 months from submission      | Daily cron purge (`15 3 * * *` UTC) |
| Support message                       | 6 months                       | Daily cron purge                    |
| Privacy request (hashes only)         | 24 months                      | Daily cron purge                    |
| Rate-limit counters (hashed IP + day) | under 48 hours                 | Daily cron purge                    |
| Admin audit log (no personal data)    | 24 months                      | Daily cron purge                    |
| D1 Time Travel history                | 7 days (Free) / 30 days (Paid) | Cloudflare-managed                  |

Admitted learners move to the learner system under programme terms (out of scope here).

## Deletion and access requests

1. The person uses the form on `/pt/privacidade/`, `/en/privacy/` or `/fr/confidentialite/`, or writes to support@biugacademy.org.
2. The Worker stores only the request type and HMAC of the contact (`privacy_requests`) and answers `202` whether or not data exists.
3. Admin lists pending requests: `GET /admin/privacy-requests` (shows `matching_applications`).
4. Admin confirms identity by contacting the address/number on file (never the one in a new message only).
5. Admin erases: `POST /admin/erase {"privacy_request_id":"PRV-..."}`; the request is marked `completed` with the number of records erased.
6. Reply to the person within 30 days (Lei 22/11, art. 28.º n.º 2 sets 60 business days as the legal maximum).
7. For access requests, export with `GET /admin/applications`, filter to the person, send through the verified channel.

## Admin access

- Admin routes are disabled unless `ADMIN_TOKEN` (32+ chars) is set.
- Production: also put `intake.biugacademy.org/admin/*` behind Cloudflare Access (free up to 50 users) and set `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD`; the Worker then verifies the Access JWT as well as the token.
- Every admin action writes an `admin_audit` row (action, time, counts; no personal data).

```bash
curl -s https://intake.biugacademy.org/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s "https://intake.biugacademy.org/admin/applications?format=csv" -H "Authorization: Bearer $ADMIN_TOKEN" -o applications.csv
```

Exports contain decrypted personal data: store them encrypted, delete them when the selection round ends.

## Go-live steps (each needs Founder approval; see Intake_Architecture_Decision.md)

```bash
cd intake-worker
npx wrangler d1 create biug-academy-intake --jurisdiction=eu      # A2; put the id in wrangler.toml
npx wrangler d1 migrations apply biug-academy-intake --remote
openssl rand -base64 32 | npx wrangler secret put DATA_KEY         # A3 (store a copy offline)
openssl rand -base64 32 | npx wrangler secret put HASH_KEY
openssl rand -base64 48 | npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put TURNSTILE_SECRET                           # A4 widget secret
# A5: uncomment the custom_domain route in wrangler.toml, then
npx wrangler deploy
curl -s https://intake.biugacademy.org/api/health                 # expect "configured": true
```

Then set `INTAKE_CONFIG.apiBase` and `INTAKE_CONFIG.turnstileSiteKey` in `js/script.js`, replace the controller-address placeholder in the three privacy notices, and merge this PR (A6). Submit one real test application, check it with `/admin/stats`, then erase it.

## Rollback

| Situation                    | Action                                                                                                                         | Data impact                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Frontend problem after merge | Revert the merge commit on `main` (GitHub Pages redeploys in about 1 minute). Forms return to the previous state.              | None; stored data stays in D1                   |
| Worker bug                   | `npx wrangler rollback` to the previous version, or empty `INTAKE_CONFIG` so forms fail closed                                 | None                                            |
| Turnstile outage             | Forms show the "could not send" message with support e-mail; no data loss                                                      | None                                            |
| Full withdrawal              | Export, then `wrangler delete`, remove the custom domain, `wrangler d1 delete` after the export is handled                     | Data deleted (7-day Time Travel window on Free) |
| Key compromise               | Rotate `ADMIN_TOKEN` immediately. For `DATA_KEY`, export with the old key, re-import under a new key, then destroy the old one | Plan a maintenance window                       |

## Tests

```bash
cd intake-worker
npm ci
npm run test:unit                                   # 15 tests: validation, crypto, Access JWT
npm run test:e2e                                    # 23 tests: workerd + local D1 + Turnstile test keys
CHROME_PATH=/usr/bin/google-chrome npm run test:browser   # 7 checks: real pages in headless Chrome
```

Requires Node 22+. Nothing is deployed and no Cloudflare resources are created by the tests.
