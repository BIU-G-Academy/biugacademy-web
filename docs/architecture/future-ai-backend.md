# Future AI backend (planned)

## Status

**Not deployed in production.** Experimental prompts or scripts are research-only until promoted on [ROADMAP.md](../../ROADMAP.md) Phase 4.

## Intended role (assistive only)

AI tooling is being **designed** to support human reviewers—not to autonomously admit or reject candidates.

| Function               | Description                                        |
| ---------------------- | -------------------------------------------------- |
| Signal extraction      | Summarize application text into structured tags    |
| Consistency checks     | Flag incomplete or contradictory answers           |
| Routing hints          | Suggest track fit for reviewer confirmation        |
| Coach content (future) | Optional learning assistance with clear boundaries |

## Architecture sketch (planned)

```
Application record (database)
        │
        ▼
Classification service (policy-bound prompts + rules)
        │
        ▼
Reviewer dashboard (human decision)
        │
        ▼
Cohort selection outcome (logged)
```

## Safeguards (required before launch)

- Human-in-the-loop for all admission decisions
- Bias and fairness review for training data and prompts
- No automated denial without appeal path
- PII minimization in model inputs
- Logging without raw sensitive data retention
- Clear applicant disclosure where AI assists review

## What we will not claim

- “AI admissions engine” as a finished product today
- Guaranteed matching to employment or income
- Autonomous credential issuance

## Related documents

- [data-intake-architecture.md](data-intake-architecture.md)
- [../operations/cohort-selection.md](../operations/cohort-selection.md)
- [../curriculum/ai-readiness.md](../curriculum/ai-readiness.md)
