# BIU.G Academy — Documentation

Institutional documentation for inspectors, partners, and contributors. All documents use an **institutional tone** and distinguish **operational**, **under development**, and **planned** capability.

**Disclaimer:** BIU.G Academy is under development. It does not currently issue accredited academic degrees. No government approval or partnership is implied unless formally published.

---

## Directory map

| Folder                                                      | Purpose                                         |
| ----------------------------------------------------------- | ----------------------------------------------- |
| [whitepaper/](whitepaper/)                                  | Strategic white papers                          |
| [partnerships/](partnerships/)                              | Collaboration framework (no implied deals)      |
| [regulatory/](regulatory/)                                  | Compliance and privacy positions                |
| [operations/](operations/)                                  | Cohorts, admissions, deployment                 |
| [curriculum/](curriculum/)                                  | Learning tracks (under development)             |
| [metrics/](metrics/)                                        | Outcomes and reporting framework                |
| [governance/](governance/)                                  | Transparency and institutional policy           |
| [branding/](branding/)                                      | Visual and communication standards              |
| [i18n/](i18n/)                                              | Translation glossary                            |
| [vision/](vision/)                                          | Strategic thesis                                |
| [architecture/](architecture/)                              | Technical detail                                |
| [architecture/decisions/](architecture/decisions/README.md) | Architecture decision records (ADR-001 onward)  |
| [operations/runbooks/](operations/runbooks/)                | Step-by-step operational procedures             |
| [design/](design/)                                          | Legacy paths — see branding for guidelines      |
| [community/](community/)                                    | Contributor roles                               |
| [security/](security/)                                      | Credential review, controls (branch protection) |
| [releases/](releases/)                                      | Release gate reports                            |

---

## Start here by audience

| Audience            | Read first                                                                                                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regulators          | [regulatory/regulatory-position.md](regulatory/regulatory-position.md), [whitepaper/biug-academy-whitepaper-v1.md](whitepaper/biug-academy-whitepaper-v1.md)                                                                                                                                                     |
| NGOs / universities | [partnerships/partnership-framework.md](partnerships/partnership-framework.md), [governance/transparency-policy.md](governance/transparency-policy.md)                                                                                                                                                           |
| Developers          | [../ARCHITECTURE.md](../ARCHITECTURE.md), [operations/deployment-guide.md](operations/deployment-guide.md), [operations/backend-deployment.md](operations/backend-deployment.md), [operations/intake-first-party.md](operations/intake-first-party.md), [operations/learning-mvp.md](operations/learning-mvp.md) |
| Contributors        | [../CONTRIBUTING.md](../CONTRIBUTING.md), [community/contributor-onboarding.md](community/contributor-onboarding.md)                                                                                                                                                                                             |
| Donors (future)     | [governance/transparency-policy.md](governance/transparency-policy.md), [metrics/outcomes-framework.md](metrics/outcomes-framework.md)                                                                                                                                                                           |

---

## Governance and assurance

| Document                                                                                     | Purpose                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [releases/production-freeze-2026-11-14.md](releases/production-freeze-2026-11-14.md)         | Active production freeze: merge train, evidence, rollback, exit criteria |
| [governance/pr-reconciliation-register.md](governance/pr-reconciliation-register.md)         | Every open PR: overlap, risk, evidence, disposition                      |
| [architecture/decisions/README.md](architecture/decisions/README.md)                         | ADR index and statuses                                                   |
| [releases/release-gate-report-2026-11-13.md](releases/release-gate-report-2026-11-13.md)     | Baseline test evidence and G0–G4 gate status                             |
| [security/credential-exposure-review.md](security/credential-exposure-review.md)             | Credential exposure findings and rotation inventory                      |
| [security/controls/branch-protection.md](security/controls/branch-protection.md)             | Required checks and `main` protection settings                           |
| [governance/documentation-ownership-matrix.md](governance/documentation-ownership-matrix.md) | Owner, target location and review cadence for every document             |
| [governance/documentation-migration-plan.md](governance/documentation-migration-plan.md)     | Canonical taxonomy migration batches and supersession log                |

The canonical taxonomy is defined in [ADR-009](architecture/decisions/ADR-009-documentation-taxonomy.md). Existing documents move in batches after open PRs are reconciled.

---

## Root policy files

- [../README.md](../README.md)
- [../GOVERNANCE.md](../GOVERNANCE.md)
- [../ROADMAP.md](../ROADMAP.md)
- [../SECURITY.md](../SECURITY.md)
- [../AGENTS.md](../AGENTS.md) (instructions for coding agents)

---

## Repository maturity

Unfinished work and milestones: [REPOSITORY_MATURITY.md](REPOSITORY_MATURITY.md)
