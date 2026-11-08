# Learning MVP — readiness, not a launch

**Status:** under development. Not operational. Not production-ready.

**Review date:** 2026-11-07  
**Target the founder asked about:** 2026-11-10, America/Chicago  
**Decision from the evidence in this repository:** a public site or a real-learner pilot cannot honestly be called ready on 10 November 2026.

The long-term aspiration to reach at least 12 million Africans is an aspiration. It is not achieved adoption and it is not verified capacity.

This document is the migration, deployment, rollback, and CubeShackles inventory for the learning slice. Nothing in it was executed against a production or UAT database, and nothing here authorizes provisioning, payment, or a secret rotation.

## What this slice is

The existing Express service in `backend/` now has a learning router beside the older intake routes:

- Server session cookie (`biug_session`, HTTP-only, `SameSite=Lax`, `Secure` in production)
- Login, logout, and session expiry
- Roles `learner`, `instructor`, and `admin`, enforced on the server
- Admin cohort creation, course assignment, and membership
- Learner progress only for that learner, and only for modules assigned to that cohort
- Two badges, `primeiro_passo` and `trilha_concluida`, awarded only from recorded completions
- Cohort insight for staff of that cohort, and a self view for the learner
- Local checklist exercises for a developer track and a non-developer track
- CubeShackles adapters that are labeled and refuse every external call

The browser client is `portal/learn/`. It is mobile-first, uses system fonts, and is Portuguese by default with `?lang=en`. It is not an authorization boundary. GitHub Pages can publish the HTML. It cannot create a trusted session.

Personal-data intake stays closed. `POST /api/waitlist` and `POST /api/support` return 403 and do not write. There is no environment variable that reopens them. The public sentences stay:

- `As candidaturas ainda não estão abertas.`
- `Applications are not open yet.`

Pull requests [#7](https://github.com/BIU-G-Academy/biugacademy-web/pull/7) and [#8](https://github.com/BIU-G-Academy/biugacademy-web/pull/8) stay open. This branch does not merge, close, or replace them.

## Accounts and data minimization

Stored account fields are an opaque login, a display name, a password hash, a role, `pt` or `en`, an 18+ attestation that must be true, and active/disabled. The schema has no contact address, phone, government identifier, date of birth, or free-text reflection.

Real account provisioning does not exist in this build. The only creation path is `ACADEMY_SYNTHETIC_DEMO=1` plus `ACADEMY_ACCOUNT_PROVISIONING=synthetic-local` while `NODE_ENV` is not `production`. The synthetic demo script refuses production and refuses to start without `ACADEMY_SYNTHETIC_PASSWORD`. It does not print that password and it does not ship a default. `server.js` does not call the seed.

Disabling an account is allowed for an admin because it removes access. It does not collect new personal data. Sessions for that account are revoked.

The new learner pilot in this design is 18+ only. A false attestation is rejected.

## CubeShackles integration inventory

Observed on 2026-11-07 with the credentials available to this review. This is an inventory of what could be read, not a claim of commercial availability.

| Surface                                                                   | What was actually available                                                                                                                                                                                                                             | Status in this MVP                                                                      | Called at runtime |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------- |
| [CubeShackles/.github](https://github.com/CubeShackles/.github)           | Public organization profile, Portuguese twin, and GitHub App operating notes. Six documented properties: app identity, installation scope, short-lived installation tokens, explicit repository selection, minimum permissions, no secrets in the repo. | `reference_only`. Developer and non-developer checklists quote those public statements. | No                |
| [CubeShackles/cubeshackles](https://github.com/CubeShackles/cubeshackles) | Linked as the umbrella (doctrine, repository map, claims register). Unauthenticated GitHub API and `github.com` both returned HTTP 404. The profile says many sibling repositories stay private during pre-production.                                  | `not_accessible`. No endpoint was inferred from the link.                               | No                |
| Tool API                                                                  | No contract, OpenAPI file, or base URL was readable.                                                                                                                                                                                                    | `unconfigured`. `CUBESHACKLES_TOOL_BASE_URL` is ignored.                                | No                |
| SSO / OAuth                                                               | No CubeShackles issuer, authorize URL, or client contract was readable.                                                                                                                                                                                 | `unconfigured`. Sign-in is the local Academy cookie only.                               | No                |
| FastAPI experiment in `backend/fastapi_intake.py`                         | Separate local intake experiment already in this repo.                                                                                                                                                                                                  | Not used by the learning router.                                                        | No                |
| S9-5, S14, S6, D4, GiroBito                                               | Out of scope. Not inspected and not changed.                                                                                                                                                                                                            | Untouched                                                                               | No                |

`backend/cubeshackles/adapters.js` has no `fetch`, `http.request`, or `https.request`. Tests spy on `fetch` and expect zero calls. A tool invocation returns HTTP 503 with `called: false`.

CubeShackles is described in its own public profile as pre-production AOA-native financial infrastructure. Nothing in this Academy slice moves value, opens an account on that platform, or presents the profile as regulatory approval.

## Migration

File: `backend/migrations/004_academy_learning.sql`  
Runner: `npm run migrate` reads only `backend/migrations/*.sql`.  
The down script lives in `backend/rollback/` so the runner cannot apply it by accident.

**Not executed by this pull request.** Do not point it at a production, UAT, or shared database.

Reviewed local sequence, when a disposable database is intentionally chosen:

```bash
cd backend
npm install
npm run migrate:status
npm run migrate
npm run migrate:status
```

`004` creates `academy_accounts`, `academy_sessions`, `academy_cohorts`, `academy_memberships`, `academy_cohort_courses`, `academy_progress`, and `academy_badges_earned`. Course text stays in `backend/learning/catalog.js`.

The PostgreSQL store is implemented in `backend/learning/pg-store.js`. Automated tests in this run use the in-memory store. This review environment had neither `psql` nor Docker, so migration `004` was not applied to any database. A disposable PostgreSQL rehearsal is still required before any hosted pilot.

## Deployment

Do not deploy this as a live learner system on 10 November 2026.

GitHub Pages publishes the repository root and cannot host the API. Open pull request #8 exists specifically because `backend/` is currently in that published tree. This branch adds more backend files. Landing it on `main` before #8 increases what Pages publishes. It still publishes no secret and no real account, but it is the wrong host for the API.

When a later, reviewed host is chosen:

- Bind `0.0.0.0:$PORT` (the process already does).
- Serve `/learn` from the API origin so the session cookie stays host-only.
- Do not set a public `biug-api-base` until cookie, CORS, and CSRF are reviewed for a split origin. The client header `X-BIUG-Client: academy` is required on every mutating call.
- Leave personal-data intake closed. Do not set a fictional reopen flag. There isn't one.
- Do not set `NODE_ENV=production` together with the synthetic demo and expect accounts. Production forces provisioning closed.
- Do not run `backend/scripts/synthetic-demo.js` on a public host. It keeps accounts in process memory and is labeled synthetic.
- Required production checks remain: protected default branch, a required reviewer who is not the author, and passing checks. This run could not read classic branch protection (`403`). Repository rulesets returned an empty list for this token. A repo admin has to confirm the setting in GitHub. An empty list from this token is not proof that protection is off, and a 403 is not proof that it is on.

The older intake release checklist in [backend-deployment.md](backend-deployment.md) is suspended. Do not create a test applicant, send mail, or verify a provider key as part of this slice.

## Rollback

Not executed here.

1. Stop the API process. Do not delete the host or the database as a first step.
2. Deploy the previous release. Intake in this release is already closed; rolling back to `main` as of 2026-11-07 reopens the old waitlist code path, which is a reason to prefer #7 and #8 landing first.
3. If `004` was applied to a disposable database and must be removed, back up first, then run `backend/rollback/004_academy_learning_down.sql` by hand. It drops only the `academy_*` learning tables. Waitlist tables, if present, stay.
4. Sessions die with `academy_sessions`. Password hashes in that table go with it.
5. Do not rewrite git history. Revert the merge commit if this later lands.

## Local synthetic demo

```bash
cd backend
npm install
export NODE_ENV=development
export ACADEMY_SYNTHETIC_DEMO=1
export ACADEMY_ACCOUNT_PROVISIONING=synthetic-local
export ACADEMY_SYNTHETIC_PASSWORD='replace-with-a-local-secret'
node scripts/synthetic-demo.js
```

Open `http://127.0.0.1:3000/learn/`. Logins are `sint-admin`, `sint-instrutor`, and `sint-aprendiz`. The password is the environment variable and is not printed. Data is memory-only and is not a real cohort.

Default tests do not need PostgreSQL:

```bash
cd backend
npm test
```

## What is functional, gated, or absent

| Area                                                | State                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Login, logout, session rotation, expiry, disable    | Implemented and covered by tests, in memory                                             |
| Server-side RBAC and cross-cohort isolation         | Implemented and covered by tests                                                        |
| Cohort create, course assign, membership            | Implemented for an authenticated admin                                                  |
| Progress, completion, two earned badges             | Implemented. Badges follow current assignments                                          |
| Staff insight and learner self insight              | Implemented. Learners do not receive other people's names                               |
| Developer and non-developer checklist exercises     | Implemented as local acknowledgements                                                   |
| CubeShackles tool execution and SSO                 | Absent. Adapters disabled                                                               |
| Public registration and real provisioning           | Absent. Fail closed                                                                     |
| Personal-data intake and support storage            | Fail closed in this branch. Still open on current `main` until #7/#8 or this gate ships |
| French learning UI                                  | Not in this slice. French closure sentence is on the status payload                     |
| Certificates, payments, WhatsApp, email of learners | Not in this slice                                                                       |
| PostgreSQL rehearsal of `004`                       | Not run by the default test suite                                                       |
| Production hosting, DNS, branch-protection proof    | Not established in this run                                                             |

## Minimum founder decisions before any real learner

1. Accept that 10 November 2026 is a review date, not a public or real-learner launch, or name a later date.
2. Obtain a written opinion from qualified Angolan counsel on APD, cross-border processing, retention, deletion, access, and the 18+ pilot. This pull request is not that opinion. A counsel reference string does not reopen intake.
3. Approve a privacy architecture separately from this code. This slice only minimizes fields and fails closed.
4. Choose an API host that is not GitHub Pages, and name who pays for it. This run did not provision anything.
5. Decide the merge order with #7 and #8. Recommended order: land the form closure and the removal of published server trees first, then re-home this API where Pages cannot serve it. Expect a conflict with #8 because that pull request deletes `backend/`.
6. Grant read access to the CubeShackles umbrella and to any real tool or SSO contract, or confirm in writing that no learner-facing contract exists yet.
7. Confirm that opaque logins, with no stored contact address, are acceptable until counsel allows a contact channel.
8. Have a repo admin confirm protected `main`, required independent review, and required checks. This token could not.
9. Confirm the pilot size, who facilitates, and that no person under 18 will be admitted.
10. Confirm whether reviewers may see the synthetic demo in private. That demo is not a launch.
11. Keep S9-5, S14, S6, D4, and GiroBito out of this work. Do not rotate secrets from this effort.

## Schedule through 10 November 2026 (America/Chicago)

| When       | Work                                                                                                                                          | Expected result                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Sat 7 Nov  | This pull request: code, tests, synthetic UI, inventory                                                                                       | Reviewable slice. No-go for real learners                                                                                   |
| Sun 8 Nov  | Founder answers the decisions above. Repo admin checks branch protection. Counsel packet is assembled from existing public docs, not invented | Decisions recorded. Counsel opinion still absent unless a qualified lawyer actually delivers one                            |
| Mon 9 Nov  | Independent review of this pull request. Rebase plan against #7 and #8. No deploy                                                             | Review comments. Still no public session service                                                                            |
| Tue 10 Nov | Go / no-go against the gates in this file                                                                                                     | No-go unless every decision above is actually done and a separate release is approved. This run does not have that evidence |

A public website, including biugacademy.org, does not establish production readiness.
