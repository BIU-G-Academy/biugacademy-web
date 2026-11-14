# First-party intake candidate (Cloudflare Worker + D1 + Turnstile)

Status: **undeployed implementation candidate; architecture and reopening decisions pending**.

PR #6 preserves the Worker implementation developed under D-015. PR #5 was closed without merging on 2026-11-13. The merged #7 baseline keeps public applications closed. Neither the Worker nor the Express backend is approved for production intake by this document.

## Current public behavior

- Application pages remain closed; `js/script.js` handles navigation and display only.
- `/pt/privacidade/`, `/en/privacy/` and `/fr/confidentialite/` provide a privacy contact email. They contain no data-entry forms, unfinished controller-address placeholders or claims that Worker processing is live.
- There is no `INTAKE_CONFIG` or frontend intake handler to enable. Reopening requires separately reviewed integration code, not a configuration edit alone.
- GitHub Pages hosts the static site. No deployed Academy API or database is established by this PR.

## Preserved implementation

| Path                                     | Responsibility                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `intake-worker/src/index.js`             | Intake/support/privacy routes, admin operations, retention and request controls |
| `intake-worker/src/validate.js`          | Server-side input validation                                                    |
| `intake-worker/src/crypto.js`            | Field encryption and keyed contact lookup                                       |
| `intake-worker/migrations/0001_init.sql` | Proposed D1 schema                                                              |
| `intake-worker/wrangler.toml`            | Deployment configuration template; placeholder database ID and no active routes |

These are implementation artifacts, not proof of deployed service behavior. The Worker remains available for comparison or a scoped port into Express. No architecture choice or port is approved here.

## Retention

The Worker candidate implements proposed periods of 12 months for applications, 6 months for support, 24 months for privacy requests and admin audit records, and under 48 hours for rate counters. These periods require owner and legal review before adoption. No live retention execution or deletion completion is claimed.

## Decisions before any reopening

1. Founder selects the canonical backend and approves any port or integration scope.
2. Confirm the controller identity/address, privacy notice, processor arrangements, transfer requirements, retention and request-handling procedure with the appropriate reviewers.
3. Approve and provision the selected hosting/database, credentials, bot protection and DNS separately. Do not execute historical deployment instructions from the earlier PR revision without renewed review.
4. Implement a frontend that fails closed before configuration and on submission failures, with explicit consent and accessible recovery.
5. Verify the selected backend's complete intake, support, privacy-request, identity-confirmation, deletion, retention and recovery paths using isolated synthetic data.
6. Obtain founder authorization for deployment and reopening; verify the hosted result before claiming readiness.

## Verification scope

From the repository root:

```bash
node --test intake-worker/test/closed-site.test.mjs
node --test intake-worker/test/unit.test.mjs
```

The closure guard checks the public application/privacy pages for data-entry controls and preserves the email contact route. It is a source-level guard, not browser or hosted proof.

The existing Worker E2E suite uses workerd/local D1; the existing browser suite targets the former intake forms. Historical output under `intake-worker/test/artifacts/` is retained unchanged. Those results predate the current branch integration and do not establish current acceptance. The browser suite needs a reviewed scope change or restored, approved integration before it can demonstrate reopening readiness; no failing assertion has been removed.

## Rollback and preservation

The reconciliation changes only static privacy pages, documentation and a closure regression test. It changes no Worker logic, schema, credentials, provider resources or database records. Revert the reconciliation commit to restore its prior source state if necessary; doing so would also restore the unhandled privacy forms and must not be treated as approval to publish them.

Any future backend deployment needs its own tested rollback and recovery plan. Preserve this branch and the historical implementation until its controls are adopted or explicitly retired.
