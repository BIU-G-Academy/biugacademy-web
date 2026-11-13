# ADR-005: Privacy controls: encryption, consent, retention, data-subject requests

| Field   | Value                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner   | @biu-gholdings                                                                                                                                                                                                                                           |
| Status  | **Proposed**                                                                                                                                                                                                                                             |
| Version | 1.0                                                                                                                                                                                                                                                      |
| Date    | 2026-11-13                                                                                                                                                                                                                                               |
| Related | [ADR-002](ADR-002-canonical-backend.md), [ADR-006](ADR-006-audit-security-logging.md), [register: #6](../../governance/pr-reconciliation-register.md#6-featintake-first-party-privacy-preserving-intake-worker--d1--turnstile-d-015), `docs/regulatory/` |

## Context

On `main`, intake stores contact data in plaintext, copies the full submission into `raw_form_payload` and into the email outbox, and has no retention or deletion. The legacy simplified path fabricated consent (fixed in PR #10).

PR #6 implements a stronger model in a Cloudflare Worker: field encryption, HMAC lookups, consent versioning, expiry, erasure, purge and audit. Its committed sample row contains only ciphertext and HMACs for name, email and phone.

## Decision

Port PR #6's controls into the Express backend (ADR-002):

| Control               | Requirement                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data minimization     | Allow-list validation. Unknown fields are dropped and never stored. **No `raw_form_payload`.** Free text only where the program needs it                                                                                                           |
| Field encryption      | Name, email, phone and free-text support messages encrypted with AES-256-GCM in the application before the database. Versioned ciphertext prefix (`v1.`) for key rotation. Keys come from the secret manager, never the repository or the database |
| Lookups               | HMAC-SHA-256 with a separate key for email and phone equality (duplicate detection, recovery)                                                                                                                                                      |
| Duplicate responses   | Indistinguishable from a first submission, so they reveal nothing about other applicants (PR #10 removes the identifier; full neutrality comes with this port)                                                                                     |
| Consent records       | `consent_records`: subject, purpose, **policy version**, locale, timestamp, method, and guardian consent where applicable. Consent is never defaulted or inferred, from any channel (including WhatsApp)                                           |
| Retention             | Every personal-data row has `expires_at`. A daily purge job deletes or anonymizes expired rows and writes an audit event. Initial periods are proposed in `docs/regulatory/retention/` (to be written) and need counsel approval                   |
| Data-subject requests | Access, correction and erasure requests are recorded (`privacy_requests`), verified, fulfilled within a documented deadline, and audited. Erasure keeps the audit record, not the data                                                             |
| Abuse controls        | Turnstile (or equivalent) on public forms, Origin allowlist, 8 KB body cap, hashed-IP rate limits                                                                                                                                                  |
| Outbound email        | Staff notifications contain a reference ID and a link to the authenticated console, **not** the applicant's data                                                                                                                                   |
| Logs                  | No personal data in application logs (ADR-006)                                                                                                                                                                                                     |

## Gate G3 (real learner data)

Personal-data intake stays **closed** (PR #7; PR #9's code-level gate) until all of these hold:

1. A written opinion from qualified Angolan counsel on the applicable data-protection law and any registration or notification duties. Counsel confirms which law and authority apply; this ADR does not assert them.
2. A data protection impact assessment.
3. Approved privacy notices in PT-AO, EN-US and FR-FR (PR #6's privacy pages are a draft input).
4. Approved retention schedule.
5. PR #6's approvals A1–A7, or their equivalents for the Express deployment.
6. Founder sign-off.

Reopening is a **code change** reviewed against this list, not an environment variable.
