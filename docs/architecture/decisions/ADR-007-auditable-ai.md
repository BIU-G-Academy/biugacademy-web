# ADR-007: AI recommends, people decide

| Field   | Value                                                                                     |
| ------- | ----------------------------------------------------------------------------------------- |
| Owner   | @biu-gholdings                                                                            |
| Status  | **Proposed**                                                                              |
| Version | 1.0                                                                                       |
| Date    | 2026-11-13                                                                                |
| Related | [ADR-004](ADR-004-rbac-cohort-isolation.md), [ADR-006](ADR-006-audit-security-logging.md) |

## Context

- `backend/ai.js` (an OpenAI classifier) is imported by nothing.
- `backend/scoring.js` and FastAPI's `/ai/intake` use a deterministic keyword scorer.
- FastAPI's coach and check-in routes call an LLM. They were unauthenticated until PR #10.

None of this records which model or prompt produced an output, or who acted on it.

## Decision

1. Every AI output that could influence a person's opportunities (admissions ranking, eligibility, grading suggestions, milestone suggestions) is stored as a row in **`ai_recommendations`**. Each row records:
   - the purpose and subject reference;
   - the provider and **model ID**;
   - the **prompt template ID and version**;
   - a hash of the input (not the input itself, when it contains personal data);
   - the structured output and any stated confidence;
   - the creation time and the code version.
2. **Only a person creates a decision.** `decisions` rows (admission, eligibility, grade, milestone verification) require `decided_by` (a staff account with MFA) and may reference zero or more recommendations. The database rejects a decision without a human actor. **No automated adverse decision**: AI can never reject, withdraw or fail anyone.
3. The reviewer sees the recommendation and its rationale, and records whether they agreed. That agreement rate is reported.
4. Applicants and learners are told when AI assisted a decision about them, in the privacy notice (ADR-005).
5. Deterministic scorers are versioned the same way as models (`model_id = "scoring.js@<version>"`).
6. A provider-neutral interface (`backend/ai/provider.js`). Model IDs come from configuration. Personal data sent to a provider is minimized and covered by the privacy notice and the provider's terms.
7. **Evaluation:** each recommendation type has a fixed evaluation set and a CI check that output parsing and schema validation still hold. Changing a prompt or model requires a new version and a recorded evaluation result.

## Acceptance tests

- Inserting a `decisions` row without `decided_by` fails.
- A recommendation without `model_id` and `prompt_version` fails validation.
- No code path changes an application or enrollment status from an AI response alone. Covered by a test that runs the AI path with decision writes stubbed to throw.
