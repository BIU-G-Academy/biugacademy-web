# ADR-010: PR reconciliation and commit provenance

| Field   | Value                                                                        |
| ------- | ---------------------------------------------------------------------------- |
| Owner   | @biu-gholdings                                                               |
| Status  | **Proposed**                                                                 |
| Version | 1.0                                                                          |
| Date    | 2026-11-13                                                                   |
| Related | [PR reconciliation register](../../governance/pr-reconciliation-register.md) |

## Decision

1. The [register](../../governance/pr-reconciliation-register.md) is the single record of every open PR's objective, overlaps, risk, evidence, recommended disposition and final disposition.
2. **Nothing is merged or closed without founder approval.** Agents prepare PRs and recommendations only.
3. **Provenance:**
   - work integrated from another PR keeps its original commits (rebased, authorship unchanged);
   - partial reuse uses `git cherry-pick -x` (records the source SHA), or a `Co-authored-by:` trailer when the code was adapted;
   - superseded PRs are closed with a comment linking the replacing PR and the register row, never deleted. Their branches are kept;
   - history is never rewritten on `main` or on another author's branch.
4. **Dispositions:**

   | Disposition | Meaning                                                                 |
   | ----------- | ----------------------------------------------------------------------- |
   | `merge`     | Merged as is, or after the listed changes                               |
   | `integrate` | Its commits land through another PR, with provenance as above           |
   | `port`      | Its design is re-implemented elsewhere; the PR is kept as the reference |
   | `supersede` | Its objective is met by another PR; closed unmerged with a link         |
   | `retire`    | Its approach is rejected; closed unmerged with the reason               |

5. **Evidence:** a register entry may say PASS only with a command, its result and the commit it ran on. Tests that were not executed are listed as not executed.
