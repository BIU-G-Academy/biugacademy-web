# ADR-004: Role-based access control and cohort isolation

| Field   | Value                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Owner   | @biu-gholdings                                                                                                                     |
| Status  | **Proposed**                                                                                                                       |
| Version | 1.0                                                                                                                                |
| Date    | 2026-11-13                                                                                                                         |
| Related | [ADR-003](ADR-003-identity-sessions-recovery.md), [ADR-006](ADR-006-audit-security-logging.md), [ADR-007](ADR-007-auditable-ai.md) |

## Decision

Access is **denied by default**. A request is allowed only when the session's **global role** grants the permission **and**, for cohort-scoped permissions, the account holds a **membership** in that cohort. Every check is done on the server. Static portal pages are never an authorization boundary.

### Roles

| Role                  | Scope                       | Purpose                                                         |
| --------------------- | --------------------------- | --------------------------------------------------------------- |
| `learner`             | Own record + own cohorts    | Learn, submit work, see own progress                            |
| `instructor`          | Assigned cohorts only       | Deliver content, grade, verify milestones                       |
| `admissions_reviewer` | Assigned application cycles | Review applications, record decisions                           |
| `admin`               | Platform                    | Accounts, cohorts, content publishing, configuration            |
| `auditor`             | Platform, read-only         | Read audit events and decision records; no personal-data export |

### Permission matrix (initial)

✅ = allowed · ◐ = only within assigned cohort or cycle · — = denied

| Permission                          | learner | instructor | admissions_reviewer |           admin           | auditor |
| ----------------------------------- | :-----: | :--------: | :-----------------: | :-----------------------: | :-----: |
| `profile.read_self` / `update_self` |   ✅    |     ✅     |         ✅          |            ✅             |   ✅    |
| `progress.read_self`                |   ✅    |     —      |          —          |             —             |    —    |
| `progress.record_self`              |    ◐    |     —      |          —          |             —             |    —    |
| `progress.read_cohort`              |    —    |     ◐      |          —          |            ✅             |    —    |
| `submission.create_self`            |    ◐    |     —      |          —          |             —             |    —    |
| `submission.grade`                  |    —    |     ◐      |          —          |             —             |    —    |
| `milestone.verify`                  |    —    |     ◐      |          —          |             —             |    —    |
| `content.draft`                     |    —    |     ◐      |          —          |            ✅             |    —    |
| `content.publish`                   |    —    |     —      |          —          |            ✅             |    —    |
| `application.read`                  |    —    |     —      |          ◐          |            ✅             |    —    |
| `application.decide`                |    —    |     —      |          ◐          |             —             |    —    |
| `cohort.manage`                     |    —    |     —      |          —          |            ✅             |    —    |
| `account.manage`                    |    —    |     —      |          —          |            ✅             |    —    |
| `audit.read`                        |    —    |     —      |          —          |            ✅             |   ✅    |
| `personal_data.export`              |    —    |     —      |          —          | ✅ (MFA step-up, audited) |    —    |
| `ai.recommendation.read`            |    —    |     ◐      |          ◐          |            ✅             |   ✅    |

Admins do **not** decide applications by default. Separating duties keeps one person from configuring the system and also deciding outcomes.

### Enforcement

- Permissions are declared in code (`backend/authz/permissions.js`) and attached to each route. A route with no declared permission fails a CI test.
- Cohort scoping is applied **in the query**, for example `WHERE cohort_id = ANY($memberCohorts)`, not by filtering results afterwards.
- Every denial of a staff permission and every use of `personal_data.export`, `application.decide`, `account.manage` and `content.publish` writes an `audit_events` row (ADR-006).

## Acceptance tests

- A matrix test enumerates **every route × every role** and asserts 2xx or 403 against the table above.
- Isolation tests: an instructor of cohort A reading cohort B data gets 403. A learner reading another learner's progress gets 403. A reviewer of cycle 1 reading cycle 2 gets 403.
- A staff role without completed MFA can use no staff permission.
