# Documentation migration plan and supersession log

| Field         | Value                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Owner         | @biu-gholdings                                                                                                                |
| Status        | **Proposed**: moves not started                                                                                               |
| Version       | 1.0                                                                                                                           |
| Last reviewed | 2026-11-13                                                                                                                    |
| Related       | [ADR-009](../architecture/decisions/ADR-009-documentation-taxonomy.md), [ownership matrix](documentation-ownership-matrix.md) |

## Why moves are deferred

Open PRs edit documents that the taxonomy would move. Moving them now would turn every one of those edits into a modify/delete conflict.

- **#6:** `docs/regulatory/data-consent-framework.md`, `docs/README.md`, and adds `docs/operations/intake-first-party.md`.
- **#7:** `docs/architecture/future-ai-backend.md`, `docs/architecture/website-architecture.md`, `docs/operations/deployment-guide.md`.
- **#9:** `docs/architecture/website-architecture.md`, `docs/operations/backend-deployment.md`, `docs/vision/ecosystem-alignment.md`, `docs/README.md`, and adds `docs/operations/learning-mvp.md`.

New documents go into canonical locations now. Existing documents move after steps 1–5 of the register's merge order.

## Move batches

Each batch is one PR. It uses `git mv` (history preserved), repairs every inbound link in the same PR (enforced by `link-check`, PR #12), leaves no redirect stubs inside `docs/` (GitHub renders the moved file and the link checker catches stale links), and updates the ownership matrix.

| Batch | Moves                                                                                                                                                                                                                                                                                                                          | Precondition             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| M1    | `deployment/domain-and-dns.md` and `local-development.md` → `operations/deployment/`; `operations/deployment-guide.md` and `backend-deployment.md` → `operations/deployment/`; `operations/pdf-export-pipeline.md` → `operations/runbooks/`. Delete the redirect stubs `deployment/README.md` and `deployment/github-pages.md` | #7, #9 merged or rebased |
| M2    | `operations/{admissions-framework,cohort-selection,intake-system,admin-dashboard-planning}.md` → `product/admissions/`; `operations/first-cohort-*.md` → `product/cohorts/`; `operations/quality-standards.md` → `curriculum/`                                                                                                 | #7 merged                |
| M3    | `regulatory/data-consent-framework.md` → `regulatory/consent/`; `regulatory/data-privacy-position.md` → `regulatory/privacy/`; new `regulatory/retention/` (ADR-005)                                                                                                                                                           | #6 ported or closed      |
| M4    | `governance/transparency-policy.md` → `governance/policies/`; `REPOSITORY_MATURITY.md` → `governance/`; `design/{accessibility,content-style-guide}.md` → `branding/`. Delete the redirect stubs `design/brand-guidelines.md` and `ECOSYSTEM_ALIGNMENT.md`                                                                     | none                     |
| M5    | `architecture/data-intake-architecture.md` → `architecture/data-model/intake.md`. Create `architecture/{diagrams,api,data-model}/`                                                                                                                                                                                             | ADR-002 accepted         |
| M6    | `vision/`, `whitepaper/`, `community/` → per decision D-DOC-1                                                                                                                                                                                                                                                                  | D-DOC-1                  |

**Decision D-DOC-1 (founder).** The Directive's taxonomy has no home for `vision/`, `whitepaper/` or `community/`. The proposal is `governance/strategy/` (vision, white paper) and `governance/community/`. The alternative is to add them as top-level folders to the taxonomy.

## Supersession log

Each entry names the normative conflict, the document that wins, and how the loser is marked.

| ID  | Conflict                                                                                                                                                                                                           | Winner           | Action on the superseded text                                                                                     | When                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------- |
| S-1 | `ARCHITECTURE.md` describes `backend/` as "experimental FastAPI/SQLite", not operational; the Express + PostgreSQL service is the real backend                                                                     | ADR-002          | Rewrite the backend section of `ARCHITECTURE.md` to point to ADR-002 (after #9 rebases, since #9 edits this file) | After #9            |
| S-2 | Root docs and the website describe a "candidate intake path" as operational (README "Operational" table); founder directive and #7 close intake                                                                    | #7 + ADR-005 G3  | README operational table updated by #7; verify after merge                                                        | With #7             |
| S-3 | `operations/intake-system.md` describes the intake flow as current                                                                                                                                                 | #7 + ADR-005     | Add `Status: Superseded in part by ADR-005; intake closed (PR #7) on <date>`                                      | After #7            |
| S-4 | `architecture/data-intake-architecture.md` plans the data model independently                                                                                                                                      | ADR-002, ADR-005 | Status header pointing to the ADRs; content moves in M5                                                           | M5                  |
| S-5 | `architecture/future-ai-backend.md` describes assistive AI without decision records                                                                                                                                | ADR-007          | Status header pointing to ADR-007                                                                                 | After #7            |
| S-6 | `docs/deployment/github-pages.md` and `operations/deployment-guide.md` describe branch deployment from the repository root                                                                                         | ADR-001          | Update the deployment guide after cutover; delete the stub in M1                                                  | After Pages cutover |
| S-7 | `AGENTS.md` gotchas (`current_role` quoting, "no tests", OpenAI 502 path) no longer match the code                                                                                                                 | Code on `main`   | Corrected in this PR                                                                                              | This PR             |
| S-8 | Prior supersessions already in place: `ECOSYSTEM_ALIGNMENT.md` → `vision/ecosystem-alignment.md`; `design/brand-guidelines.md` → `branding/brand-guidelines.md`; `deployment/*` → `operations/deployment-guide.md` | Existing targets | Stubs deleted in M1/M4                                                                                            | M1, M4              |

## Metadata backfill

Existing documents do not yet carry the metadata table (Owner, Status, Version, Last reviewed, Related ADRs). Each move batch adds it to the documents it moves. Documents that stay put get it in a final batch, M7.
