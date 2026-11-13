# ADR-006: Audit and security event logging

| Field   | Value                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner   | @biu-gholdings                                                                                                                                                            |
| Status  | **Proposed**                                                                                                                                                              |
| Version | 1.0                                                                                                                                                                       |
| Date    | 2026-11-13                                                                                                                                                                |
| Related | [ADR-003](ADR-003-identity-sessions-recovery.md), [ADR-004](ADR-004-rbac-cohort-isolation.md), [ADR-005](ADR-005-privacy-controls.md), [ADR-007](ADR-007-auditable-ai.md) |

## Decision

An append-only `audit_events` table in PostgreSQL:

| Column                           | Notes                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `id`, `occurred_at`              | UUID, server time                                                              |
| `actor_account_id`, `actor_role` | Null for anonymous/system; role at the time of the action                      |
| `action`                         | Dotted verb from a fixed list, e.g. `auth.login.failed`, `application.decided` |
| `target_type`, `target_id`       | What was acted on                                                              |
| `cohort_id`                      | For cohort-scoped events                                                       |
| `outcome`                        | `allowed`, `denied`, `error`                                                   |
| `ip_hash`                        | HMAC of the IP address with a key rotated every 30 days; never the raw IP      |
| `request_id`                     | Correlates with application logs                                               |
| `details`                        | JSON. **No personal data**: identifiers and enumerations only                  |

- The application database role has `INSERT` and `SELECT` only. `UPDATE` and `DELETE` are revoked, and a trigger rejects them.
- Events that must be recorded:
  - **Authentication:** login (success and failure), lockout, MFA enrollment, MFA challenge failure, password reset (requested and completed), session revocation.
  - **Authorization:** denials of staff permissions.
  - **Personal data:** export, erasure, purge job runs.
  - **Admissions:** recorded decisions, with a link to any AI recommendation (ADR-007).
  - **Administration:** content publishing, role and membership changes, configuration changes.
- Retention of audit events: 24 months (proposed; counsel to confirm), and longer than the data they describe.
- Application logs are structured JSON and contain no request bodies, cookies, tokens or contact data.

## Acceptance tests

- Each listed action writes exactly one event with the expected `action` and `outcome`.
- `UPDATE` and `DELETE` on `audit_events` fail under the application role.
- A scan of the test-run logs finds no email addresses, phone numbers or session tokens.
