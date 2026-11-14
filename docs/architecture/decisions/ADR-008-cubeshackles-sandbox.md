# ADR-008: CubeShackles integrations are sandbox-only

| Field   | Value                                                                         |
| ------- | ----------------------------------------------------------------------------- |
| Owner   | @biu-gholdings                                                                |
| Status  | **Proposed**                                                                  |
| Version | 1.0                                                                           |
| Date    | 2026-11-13                                                                    |
| Related | PR #9 (`backend/cubeshackles/adapters.js`, `docs/operations/learning-mvp.md`) |

## Context

PR #9 inventoried CubeShackles on 2026-11-07. The public organization profile is readable. The umbrella repository returned 404 to unauthenticated requests. No tool API, OpenAPI contract or SSO issuer was readable. Its adapters perform no network I/O and refuse every call (HTTP 503, `called: false`). CubeShackles describes itself as pre-production financial infrastructure.

## Decision

1. Academy learning tracks may teach CubeShackles concepts and APIs. **Executable integrations call sandbox environments only.**
2. An adapter becomes callable only when all of the following are true, and each is reviewed code, not configuration:
   - a **pinned API contract** (OpenAPI or equivalent, with a version and checksum) is committed under `backend/cubeshackles/contracts/`;
   - the **host** is on a code-level allowlist of sandbox hosts; production hosts are rejected even if configured;
   - the credentials are **sandbox credentials** from the secret manager, scoped to read-only or test operations;
   - responses are validated against the pinned contract.
3. **Nothing moves value.** No adapter may initiate a payment, transfer, account opening or KYC submission, even in a sandbox, without a separate ADR.
4. Learners never receive CubeShackles credentials from the Academy. Exercises use per-learner sandbox tokens issued by the sandbox, or recorded fixtures.
5. Egress from the Academy backend is restricted to the allowlisted hosts. Tests spy on `fetch` and fail on any other host (extending PR #9's zero-call test).

## Consequences

The CubeShackles track (G4) is **blocked until a sandbox contract is available**. Until then, tutorials use documented public material and recorded fixtures only.
