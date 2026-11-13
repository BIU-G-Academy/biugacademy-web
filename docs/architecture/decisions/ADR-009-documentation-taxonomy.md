# ADR-009: Documentation taxonomy, metadata and supersession

| Field   | Value                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner   | @biu-gholdings                                                                                                                             |
| Status  | **Proposed**                                                                                                                               |
| Version | 1.0                                                                                                                                        |
| Date    | 2026-11-13                                                                                                                                 |
| Related | [ownership matrix](../../governance/documentation-ownership-matrix.md), [migration plan](../../governance/documentation-migration-plan.md) |

## Decision

1. **Canonical structure** (Directive 001, Phase 4) under `docs/`:
   - `architecture/`: `decisions/`, `diagrams/`, `api/`, `data-model/`
   - `governance/`: `policies/`, plus the PR reconciliation register
   - `security/`: `threat-model/`, `controls/`, `incident-response/`
   - `regulatory/`: `privacy/`, `consent/`, `retention/`
   - `operations/`: `deployment/`, `runbooks/`, `monitoring/`, `backups/`
   - `product/`: `admissions/`, `cohorts/`, `learning/`, `gamification/`, `cubeshackles/`
   - also `curriculum/`, `metrics/`, `i18n/`, `partnerships/`, `branding/`, `releases/`
2. **Root entry points stay at the root:** `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, `CHANGELOG.md`, `AGENTS.md`.
3. **Every document starts with a metadata table:** Owner, Status, Version, Last reviewed, and Related ADRs where applicable. `docs/README.md` is the master index. Ownership and review cadence are kept in the ownership matrix.
4. **Supersession, not silent replacement.** When guidance changes, the old document keeps a header `Status: Superseded by <link> on <date>` and its body is either kept or reduced to a pointer. Conflicting normative statements are resolved by an entry in the supersession log in the migration plan.
5. **Moves preserve history** (`git mv`, one move per commit group) and repair every inbound link in the same PR. The link checker (PR #12) enforces this.
6. **Sequencing:** existing documents are **not moved** while PRs #6, #7 and #9 are open, because each of them edits files under `docs/` that would be moved. New documents are created in the canonical locations now. Moves follow PR reconciliation, per the migration plan.
