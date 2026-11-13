# Branch protection for `main`

| Field         | Value                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner         | @biu-gholdings                                                                                                                                                        |
| Status        | **Ready for approval**: not applied                                                                                                                                   |
| Version       | 1.0                                                                                                                                                                   |
| Last reviewed | 2026-11-13                                                                                                                                                            |
| Related       | ADR-001, [ADR-010](../../architecture/decisions/ADR-010-pr-reconciliation-and-provenance.md), [release gate report](../../releases/release-gate-report-2026-11-13.md) |

## Current state (verified 2026-11-13)

`GET /repos/BIU-G-Academy/biugacademy-web/branches/main/protection` returns **404 "Branch not protected"**. Any collaborator with write access can push to or merge into `main`. Because Pages deploys from `main`, every merge is a production deploy.

## Required status checks

Check names exactly as GitHub reports them. Only add a check after it has passed on `main` at least once, otherwise every PR is blocked.

| Check                                                                   | Workflow  | Added by | Require after                               |
| ----------------------------------------------------------------------- | --------- | -------- | ------------------------------------------- |
| `markdownlint`                                                          | Docs lint | existing | now (path filter removed in #12)            |
| `prettier-check`                                                        | Docs lint | existing | now (path filter removed in #12)            |
| `link-check`                                                            | Docs lint | #12      | #12 merged                                  |
| `backend-tests`                                                         | CI        | #12      | #12 merged                                  |
| `fastapi-security`                                                      | CI        | #12      | #12 merged                                  |
| `dependency-audit`                                                      | CI        | #12      | #12 merged                                  |
| `secret-scan`                                                           | CI        | #12      | #12 merged **and** the C1 decision recorded |
| `codeql (javascript-typescript)`, `codeql (python)`, `codeql (actions)` | CI        | #12      | #12 merged                                  |
| `site-artifact`                                                         | Pages     | #11      | #11 merged                                  |

Before #12 merges, `markdownlint` and `prettier-check` only run on PRs that touch Markdown, so they cannot be required yet.

## Settings

Apply in **Settings → Branches → Add branch ruleset** (or classic protection) for `main`:

- Require a pull request before merging: **1 approval**; dismiss stale approvals on new commits; **require review from Code Owners**; require approval of the most recent push.
- Require status checks to pass, with **branches up to date** before merging: the checks above.
- Require conversation resolution.
- Block force pushes and branch deletion.
- Do not allow bypassing: include administrators. If the founder is the only maintainer, allow a documented emergency bypass for the founder only, and record each use in the register.
- Optional: require signed commits; require linear history.

## Equivalent API call

For an admin to run after approval. It changes repository settings.

```bash
gh api -X PUT repos/BIU-G-Academy/biugacademy-web/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "markdownlint", "prettier-check", "link-check",
      "backend-tests", "fastapi-security", "dependency-audit", "secret-scan",
      "codeql (javascript-typescript)", "codeql (python)", "codeql (actions)",
      "site-artifact"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "required_conversation_resolution": true,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

## Verification

```bash
gh api repos/BIU-G-Academy/biugacademy-web/branches/main/protection \
  --jq '{checks: .required_status_checks.contexts, admins: .enforce_admins.enabled, reviews: .required_pull_request_reviews.required_approving_review_count}'
```

Then open a test PR with a deliberate Prettier violation and confirm that merge is blocked.

## Known constraint

`CODEOWNERS` lists only `@biu-gholdings`. With "require review from Code Owners" and a single owner, the author cannot approve their own PR. Add a second code owner, or accept that the founder reviews all agent-authored PRs (the current practice).
