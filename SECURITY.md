# Security Policy

## Responsible disclosure

If you discover a security vulnerability affecting BIU.G Academy public infrastructure:

1. **Do not** disclose exploit details in a public issue.
2. Email **support@biugacademy.org** with description, impact, and reproduction steps.
3. Allow reasonable time for investigation before public disclosure.

Good-faith research that respects privacy and avoids service disruption is welcome.

---

## Reporting contact

| Channel          | Address                                                   |
| ---------------- | --------------------------------------------------------- |
| Security reports | [support@biugacademy.org](mailto:support@biugacademy.org) |
| General support  | [support@biugacademy.org](mailto:support@biugacademy.org) |

_Replace or add a dedicated `security@` alias when operational._

---

## Privacy expectations

- Collect only data necessary for stated educational purposes
- Do not commit personal data, credentials, or production databases to git
- Update [docs/regulatory/data-privacy-position.md](docs/regulatory/data-privacy-position.md) when production storage goes live

---

## Data handling principles

| Principle          | Application                                    |
| ------------------ | ---------------------------------------------- |
| Minimization       | Limit intake form fields                       |
| Purpose limitation | Admissions and program delivery only           |
| No secrets in repo | Use environment configuration for bridges/APIs |
| Least privilege    | Future admin roles separated                   |
| Retention limits   | Define before scale (planned)                  |

---

## Static site rules (operational)

- No API keys in HTML, CSS, or client JavaScript
- Review third-party scripts before inclusion
- Intake endpoints configured outside public source when possible

---

## Future backend expectations (planned)

When APIs and databases deploy:

- HTTPS only in production
- Authentication and role-based access for admins
- Encryption at rest where supported by provider
- No full PII in application logs
- Human-in-the-loop for AI-assisted admissions review

The public site does not ship a production API.

---

## Form abuse

Public intake may face spam. Mitigations: rate limiting (planned), honeypots, manual review, monitoring. Report abuse to **support@biugacademy.org**.

---

## Never commit

Secrets, API keys, private keys, wallet phrases, national ID datasets, production `.env`, or confidential regulator correspondence.
