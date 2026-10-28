# Website architecture

## Current system (live)

```
Browser
   │
   ▼
GitHub Pages (static)
   │
   ├── HTML (localized: /pt/, /en/, /fr/)
   ├── css/styles.css
   ├── js/script.js
   └── assets/ (logo, images)
```

**Characteristics:**

- No server-side rendering in production
- No build toolchain required for deployment
- Custom domain via `CNAME` → `biugacademy.org`

## Public routes

### Localized primary pages

| Path                                          | Role                                |
| --------------------------------------------- | ----------------------------------- |
| `/`                                           | Redirect to default locale (`/pt/`) |
| `/pt/`, `/en/`, `/fr/`                        | Home                                |
| `*/sobre/` · `*/about/`                       | About                               |
| `*/como-funciona/` · `*/how-it-works/`        | How it works                        |
| `*/entrar-primeira-turma/` · waitlist aliases | Cohort application                  |
| `*/candidatura-recebida/` · thank-you aliases | Confirmation                        |

### Institutional aliases (root)

| Path         | Behavior                    |
| ------------ | --------------------------- |
| `about/`     | Redirect to localized about |
| `programs/`  | Program / home redirect     |
| `platform/`  | Platform orientation        |
| `waitlist/`  | Redirect to cohort intake   |
| `thank-you/` | Redirect to confirmation    |

Documentation refers to **`apply/`** as the logical application route; implementation today uses `waitlist.html` and `/pt/entrar-primeira-turma/`.

## Intake (current)

The public site does not submit applications. Submissions are **not** processed by GitHub Pages itself.

## Non-production components

| Component         | Status                                                            |
| ----------------- | ----------------------------------------------------------------- |
| Server code       | Not in the public site root                                       |
| AI classification | Not production (see [future-ai-backend.md](future-ai-backend.md)) |

## Related documents

- [data-intake-architecture.md](data-intake-architecture.md)
- [../deployment/github-pages.md](../deployment/github-pages.md)
- [../deployment/local-development.md](../deployment/local-development.md)
