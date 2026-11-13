# Architecture decision records

| Field         | Value          |
| ------------- | -------------- |
| Owner         | @biu-gholdings |
| Status        | Active index   |
| Version       | 1.0            |
| Last reviewed | 2026-11-13     |

An ADR records one decision: its context, what was decided, the consequences, and the alternatives that were rejected. ADRs are numbered and never renumbered. A changed decision gets a new ADR that **supersedes** the old one, and the old one keeps its text with its status set to `Superseded by ADR-NNN`.

**Statuses:** `Proposed` (awaiting founder approval), `Accepted`, `Superseded`, `Rejected`.

| ADR     | Title                                                                                                                     | Status   | Gate  |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| ADR-001 | Publish the public site from an allowlisted Pages artifact (`ADR-001-pages-allowlist-deployment.md`, delivered in PR #11) | Proposed | G0    |
| ADR-002 | [Canonical backend: one Express + PostgreSQL application](ADR-002-canonical-backend.md)                                   | Proposed | G1    |
| ADR-003 | [Identity, sessions, staff MFA and account recovery](ADR-003-identity-sessions-recovery.md)                               | Proposed | G1    |
| ADR-004 | [Role-based access control and cohort isolation](ADR-004-rbac-cohort-isolation.md)                                        | Proposed | G1    |
| ADR-005 | [Privacy controls: encryption, consent, retention, data-subject requests](ADR-005-privacy-controls.md)                    | Proposed | G1/G3 |
| ADR-006 | [Audit and security event logging](ADR-006-audit-security-logging.md)                                                     | Proposed | G1    |
| ADR-007 | [AI recommends, people decide](ADR-007-auditable-ai.md)                                                                   | Proposed | G2    |
| ADR-008 | [CubeShackles integrations are sandbox-only](ADR-008-cubeshackles-sandbox.md)                                             | Proposed | G4    |
| ADR-009 | [Documentation taxonomy, metadata and supersession](ADR-009-documentation-taxonomy.md)                                    | Proposed | G0    |
| ADR-010 | [PR reconciliation and commit provenance](ADR-010-pr-reconciliation-and-provenance.md)                                    | Proposed | G0    |
