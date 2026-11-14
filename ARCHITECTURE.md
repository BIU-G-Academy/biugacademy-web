# System architecture

BIU.G Academy’s technical architecture is intentionally simple today and documented for progressive expansion. This document distinguishes **operational**, **under development**, and **planned** components.

**Website:** [https://biugacademy.org](https://biugacademy.org)

---

## Design principles

| Principle               | Rationale                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| **Mobile-first**        | Primary access in Angola is via smartphone                                                     |
| **Offline-first**       | Learning and content must tolerate intermittent connectivity (planned for curriculum delivery) |
| **Static-by-default**   | Minimize attack surface and hosting cost for public presence                                   |
| **Documentation-first** | Architecture changes precede public claims                                                     |
| **Human-in-the-loop**   | Admissions and AI assist remain reviewer-governed (planned)                                    |

---

## Current architecture (operational)

### Frontend structure

```text
biugacademy-web/
├── index.html              # Root → /pt/
├── pt/ en/ fr/             # Localized pages
├── css/styles.css          # Design tokens and layout
├── js/script.js            # Navigation and UI behavior
├── assets/                 # Logo and images
├── about/ programs/        # Path aliases (redirects)
├── waitlist/ thank-you/    # Intake aliases
└── CNAME                   # biugacademy.org
```

| Concern | Implementation                                     |
| ------- | -------------------------------------------------- |
| Routing | Directory-based static paths + HTML redirects      |
| Styling | CSS custom properties in `css/styles.css`          |
| i18n    | Separate locale trees; `hreflang` on primary pages |
| Forms   | Client POST to external bridge (if configured)     |

### Deployment model

```mermaid
flowchart TB
  subgraph dev [Developer]
    Git[Git push]
  end

  subgraph gh [GitHub]
    Repo[biugacademy-web repo]
    Pages[GitHub Pages]
  end

  subgraph public [Public]
    DNS[biugacademy.org DNS]
    User[Browser]
  end

  Git --> Repo
  Repo --> Pages
  DNS --> Pages
  User --> DNS
  User --> Pages
```

- **Hosting:** GitHub Pages from default branch, root `/`
- **TLS:** Provided by GitHub Pages
- **Custom domain:** `CNAME` file in repository root

See [docs/operations/deployment-guide.md](docs/operations/deployment-guide.md).

### Optional intake bridge (operational when configured)

```mermaid
sequenceDiagram
  participant U as Applicant browser
  participant P as GitHub Pages
  participant B as Intake bridge optional

  U->>P: Load static form page
  U->>B: Submit application
  B-->>U: Confirmation redirect
```

`google-apps-script/` documents one optional pattern. Not all environments use a bridge.

### Non-production: `backend/`

Experimental FastAPI/SQLite code may exist for local intake trials. It is **not** part of the GitHub Pages deployment and **not** described as operational infrastructure.

---

## Under development

| Component         | Direction                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cohort operations | Manual review workflows documented in `docs/operations/`                                                                                                            |
| Learning MVP      | Server sessions, RBAC, cohorts, and local exercises in `backend/learning/`. Not operational. See [docs/operations/learning-mvp.md](docs/operations/learning-mvp.md) |
| Content packaging | Module outlines in `docs/curriculum/`                                                                                                                               |
| Documentation CI  | Markdown lint via GitHub Actions (optional)                                                                                                                         |

---

## Planned architecture

### CMS direction (planned)

A future content management layer would support:

- Reviewed publishing workflow for curriculum updates
- Versioned modules and facilitator guides
- Separation of public marketing copy from instructional content

**Not operational today.** Static HTML remains the source of truth for the public site.

### Authentication (planned)

| Actor        | Need                            |
| ------------ | ------------------------------- |
| Learners     | Progress, offline sync (future) |
| Facilitators | Cohort management               |
| Admins       | Admissions, reporting           |

A non-production learning slice now implements HTTP-only cookie sessions and server-side roles for learner, instructor, and admin. It is not the live site. Real account provisioning and CubeShackles SSO are not configured. Planned properties that remain: production HTTPS-only hosting, no shared credentials, and secrets outside the repository.

### Offline-first learning (planned)

```mermaid
flowchart LR
  subgraph client [Client - Planned]
    PWA[PWA shell]
    Cache[Module cache]
  end

  subgraph sync [Sync - Planned]
    API[Application API]
  end

  PWA --> Cache
  Cache -.->|when online| API
```

### Analytics (planned)

Privacy-bounded metrics aligned with [docs/metrics/outcomes-framework.md](docs/metrics/outcomes-framework.md)—no production analytics pipeline today.

### Assistive AI (planned)

Human-reviewed classification and optional learning coach—see [docs/architecture/future-ai-backend.md](docs/architecture/future-ai-backend.md).

---

## Mobile-first rationale

- Layout and navigation are designed for small viewports first (`css/styles.css`).
- Forms and CTAs must remain usable on common Android screen sizes.
- Heavy assets and autoplay media are avoided on public pages.

---

## Related documents

| Document                                                                                       | Topic                    |
| ---------------------------------------------------------------------------------------------- | ------------------------ |
| [docs/architecture/website-architecture.md](docs/architecture/website-architecture.md)         | Route and stack detail   |
| [docs/architecture/data-intake-architecture.md](docs/architecture/data-intake-architecture.md) | Intake and database plan |
| [ROADMAP.md](ROADMAP.md)                                                                       | Phase timeline           |
| [docs/whitepaper/biug-academy-whitepaper-v1.md](docs/whitepaper/biug-academy-whitepaper-v1.md) | Strategic architecture   |
