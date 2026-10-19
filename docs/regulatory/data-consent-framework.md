# Data consent framework

## Purpose

Define consent and privacy principles for BIU.G Academy intake data.

This framework supports an educational infrastructure initiative under development and does not imply full legal completion for every jurisdiction yet.

## Consent collection

Every intake submission must include explicit consent:

- Checkbox field: `consent_checkbox = true`
- Consent text in plain language on the form
- Submission stored with timestamp metadata

If consent is not provided, submission is rejected.

## Educational use only

Submitted data is collected for:

- Applicant review for BIU.G Academy cohorts
- Program operations and communication
- Aggregate planning metrics

Submitted data is not collected for unrelated commercial resale.

## No resale policy

BIU.G Academy does not sell applicant personal data.

Any future data-sharing with institutional partners requires:

- A documented legal basis
- Purpose limitation
- Minimum necessary data
- User-facing disclosure where applicable

## Privacy principles

Core principles:

1. Data minimization
2. Purpose limitation
3. Storage security
4. Controlled access
5. Retention discipline
6. Transparent communication

## Data elements and sensitivity

Intake currently stores contact and profile fields relevant to educational cohort selection.

Sensitive handling expectations:

- Protect email and phone data
- Avoid storing unnecessary sensitive identifiers
- Avoid collecting national ID or financial credentials in this intake flow

## Retention preparation

Retention for the first-party intake is defined in [../operations/intake-first-party.md](../operations/intake-first-party.md#retention) (applications 12 months, support 6 months, privacy-request records 24 months). General direction for other records:

- Keep active intake records for cohort cycles
- Archive or delete stale records based on operational need and legal guidance
- Keep aggregate metrics with reduced personal identifiers

## Angola compliance preparation (future)

BIU.G Academy is preparing for stronger compliance alignment as operations mature, including:

- Angola-specific privacy and education data obligations
- Internal handling standards for staff and reviewers
- Partner data-sharing controls

No claim is made here of completed regulatory certification.

## User rights direction

Future operational policy should define:

- Contact channel for correction requests
- Contact channel for deletion requests
- Response timelines for data requests

## Operational controls

- Rate-limited API endpoints
- Honeypot and duplicate controls
- Restricted admin access
- Audit-friendly records for manual review actions

## Related documents

- [regulatory-position.md](regulatory-position.md)
- [data-privacy-position.md](data-privacy-position.md)
- [../operations/intake-system.md](../operations/intake-system.md)
