# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

BIU.G Academy is an Angola-first technical education platform with an AI-powered waitlist intake system. It consists of:

- **Express/Node.js backend** (`backend/server.js`) — primary API with `POST /api/waitlist` and `GET /api/health`
- **FastAPI/Python backend** (`backend/fastapi_intake.py`) — extended API with intake, coaching, check-in, nudge, and WhatsApp webhook endpoints
- **Static HTML frontend** (root directory) — multilingual marketing site served as static files

### Running Services

**Express backend** (port 3000):

```bash
cd backend && npm run dev
```

**FastAPI backend** (port 8000):

```bash
cd backend && uvicorn fastapi_intake:app --host 0.0.0.0 --port 8000 --reload
```

Requires env vars: `DATABASE_URL`, `OPENAI_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.

**Static frontend** (port 8080):

```bash
python3 -m http.server 8080
```

### PostgreSQL Setup

The Express backend requires PostgreSQL. Start it with:

```bash
pg_ctlcluster 16 main start
```

Local dev database: `[REDACTED]`

### Known Gotchas

- **`current_role` is a PostgreSQL reserved keyword.** The `schema.sql` and `server.js` INSERT query must quote it as `"current_role"`. Without this fix, `ensureSchema()` and the waitlist INSERT will fail with a syntax error.
- **Express backend requires a real `OPENAI_API_KEY`** for full waitlist submission flow. Without it, the app starts fine and validation works, but submissions return 502 after the DB insert (the insert is then rolled back).
- **FastAPI backend uses SQLite by default** (`sqlite:///./biug_academy.db`) and its `/ai/intake` endpoint uses a deterministic scorer (no OpenAI dependency), so it works without API keys for basic intake testing.
- **FastAPI `config_loader.py` requires all WhatsApp env vars** to be set (even placeholder values) or the app will refuse to start.
- **No lint or test scripts** are defined in `package.json`. There are no automated tests or linting configurations in this repository.

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in values. See `backend/README.md` for details.
