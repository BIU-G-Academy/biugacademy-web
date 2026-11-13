# ADR-003: Identity, sessions, staff MFA and account recovery

| Field   | Value                                                                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner   | @biu-gholdings                                                                                                                                                             |
| Status  | **Proposed**                                                                                                                                                               |
| Version | 1.0                                                                                                                                                                        |
| Date    | 2026-11-13                                                                                                                                                                 |
| Related | [ADR-002](ADR-002-canonical-backend.md), [ADR-004](ADR-004-rbac-cohort-isolation.md), [ADR-005](ADR-005-privacy-controls.md), [ADR-006](ADR-006-audit-security-logging.md) |

## Context

PR #9 already provides: opaque session tokens stored only as SHA-256 hashes; an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production); scrypt password hashes with timing-safe comparison; server-side roles; and a custom-header check. It stores **no contact data**, so there is no account recovery. It also has no MFA, and its scrypt cost (N = 2^14) is below current OWASP guidance.

The directive requires verified email for recovery, protected learner contact data, and staff MFA.

## Decision

| Control          | Requirement                                                                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords        | scrypt N = 2^17, r = 8, p = 1 (or Argon2id m = 19 MiB, t = 2, p = 1). Parameters are stored in the hash, and hashes are upgraded on next successful login. Minimum 12 characters, checked against a breached-password list, no composition rules (NIST SP 800-63B)                      |
| Sessions         | 256-bit random token in the cookie, SHA-256 hash in the database. Idle timeout 30 min for staff, 12 h for learners; absolute timeout 7 days. Rotated on login, privilege change and MFA step-up. Revoked on logout, password change, account disable and recovery                       |
| Cookie           | `__Host-` prefix when served from the API origin, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`                                                                                                                                                                                        |
| CSRF             | Every state-changing request needs (a) `SameSite=Lax`, (b) an `Origin` header on the allowlist, and (c) the custom header `X-BIUG-Client` (PR #9). Safe methods never change state                                                                                                      |
| Staff MFA        | TOTP (RFC 6238) **mandatory** for `instructor`, `admissions_reviewer`, `admin` and `auditor` before any staff permission is usable. Ten single-use recovery codes (hashed). WebAuthn added later. Step-up re-authentication for admin actions older than 15 min                         |
| Learner MFA      | Optional TOTP                                                                                                                                                                                                                                                                           |
| Recovery         | Verified email only. Email stored encrypted (ADR-005) with an HMAC lookup column. Verification and reset tokens: 256-bit, single-use, hashed at rest, 30-minute expiry. Every reset revokes all sessions and notifies the old address. Responses never reveal whether an account exists |
| Rate limiting    | Login, reset and verification limited per account and per hashed IP. Progressive delay, then temporary lock (15 min after 10 failures). Lock events are audited                                                                                                                         |
| Account creation | Learner accounts only from an enrolled admissions decision (ADR-004 / admissions). Staff accounts only by an admin with MFA. PR #9's synthetic-demo mode stays non-production only                                                                                                      |
| Locales          | `pt-AO` (default), `en-US`, `fr-FR` on the account. PR #9's `CHECK (locale IN ('pt','en'))` must add `fr`                                                                                                                                                                               |

## Consequences

- New tables: `account_emails` (encrypted address, HMAC, `verified_at`), `mfa_factors`, `mfa_recovery_codes`, `auth_tokens` (verify/reset, hashed), and `auth_events` (or the `audit_events` table from ADR-006).
- Requires a transactional email path: the existing `email_outbox` and Resend dispatcher.
- Real learner contact data must not be collected until G3 (ADR-005).

## Alternatives considered

- **SMS or WhatsApp recovery.** Phone numbers are higher-risk identifiers, and SIM-swap makes recovery weaker. Not used for recovery.
- **JWT access tokens.** Hard to revoke and they leak claims. Opaque server sessions are kept.
- **Third-party identity provider now.** Possible later (OIDC). It doesn't remove the need for local roles and cohort isolation.
