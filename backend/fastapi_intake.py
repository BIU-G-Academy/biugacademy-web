import json
import logging
from pathlib import Path
from typing import List, Literal

import os

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from openai import OpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select

from config_loader import Settings, load_settings
from ai_intake_service import is_phone_contact, normalize_phone, save_score_to_applicant, score_applicant
from service_security import require_service_token, secrets_match, valid_meta_signature
from sqlite_store import init_db
from sqlalchemy_models import Applicant, CohortEvent, MessageLog, SessionLocal, init_sqlalchemy_tables
from whatsapp_service import configure_whatsapp_service, send_whatsapp_text


app = FastAPI(title="BIU.G AI Intake", version="1.0.0")
BASE_DIR = Path(__file__).resolve().parent
MODULES_PATH = BASE_DIR / "data" / "modules.json"
COACH_PROMPT_PATH = BASE_DIR / "prompts" / "ai_coach_prompt_v1.txt"
SETTINGS: Settings | None = None
logger = logging.getLogger(__name__)


INTEREST_TRACKS = {
    "money": "money",
    "business": "business",
    "digital": "digital",
    "technical": "technical",
}

KEYWORDS = ["business", "money", "job", "learn", "start"]
ACTION_WORDS = ["start", "build", "earn"]
ANGOLA_HINTS = [
    "aoa",
    "luanda",
    "benguela",
    "huila",
    "huambo",
    "cabinda",
    "malanje",
    "namibe",
    "uige",
    "bengo",
    "bié",
    "bie",
    "lunda norte",
    "lunda sul",
    "moxico",
    "zaire",
    "cunene",
    "kwanza norte",
    "kwanza sul",
    "cuando cubango",
]


class IntakeRequest(BaseModel):
    name: str
    contact: str
    interest: str
    motivation: str
    whatsapp_consent: bool = Field(default=False)


class IntakeResponse(BaseModel):
    score: int
    track: Literal["money", "business", "digital", "technical"]
    priority: Literal["high", "mid", "low"]
    tags: List[str]


class CoachRequest(BaseModel):
    applicant_id: int
    module_id: str


class CoachResponse(BaseModel):
    explanation: str
    task: str
    check_in_question: str


class CheckinRequest(BaseModel):
    applicant_id: int
    message: str


class CheckinResponse(BaseModel):
    status: Literal["completed", "partial", "no_action"]
    response: str


class NudgeRequest(BaseModel):
    status: Literal["completed", "partial", "no_action"]
    task: str


class NudgeResponse(BaseModel):
    message: str


class AdminBroadcastRequest(BaseModel):
    track: Literal["money", "business", "digital", "technical"]
    module_id: str


class AdminBroadcastResponse(BaseModel):
    sent: int
    failed: int
    skipped: int


@app.on_event("startup")
def on_startup() -> None:
    global SETTINGS
    SETTINGS = load_settings()
    configure_whatsapp_service(SETTINGS)
    init_db()
    init_sqlalchemy_tables()


def route_applicant(ai_output: IntakeResponse) -> dict:
    if ai_output.score >= 15:
        cohort = "cohort_A"
    elif ai_output.score >= 10:
        cohort = "waitlist"
    else:
        cohort = "archive"

    return {
        "cohort": cohort,
        "track": ai_output.track,
        "priority": ai_output.priority,
    }


def normalize_text(value: str) -> str:
    return str(value).strip().lower()


def map_track(interest: str, motivation: str) -> Literal["money", "business", "digital", "technical"]:
    text = f"{interest} {motivation}"
    for key, track in INTEREST_TRACKS.items():
        if key in text:
            return track
    return "digital"


def contains_any(text: str, words: List[str]) -> bool:
    return any(word in text for word in words)


def word_limit(text: str, max_words: int = 80) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]).strip()


def classify_checkin_text(user_reply: str) -> Literal["completed", "partial", "no_action"]:
    text = normalize_text(user_reply)
    if contains_any(text, ["yes", "done", "complete"]):
        return "completed"
    if contains_any(text, ["tried", "partial"]):
        return "partial"
    return "no_action"


def is_no_reply_24h_signal(message: str) -> bool:
    raw = str(message or "").strip().upper()
    return raw in {"NO_REPLY_24H", "__NO_REPLY_24H__"}


def is_done_reply(message: str) -> bool:
    return str(message or "").strip().upper() == "DONE"


def is_weak_reply(message: str) -> bool:
    text = normalize_text(message)
    if not text:
        return True
    has_digit = any(ch.isdigit() for ch in text)
    has_spending_detail = contains_any(text, ["total", "spent", "waste", "mistake"])
    if len(text) < 20:
        return True
    return not has_digit and not has_spending_detail


def generate_checkin_response(message: str, status: Literal["completed", "partial", "no_action"]) -> str:
    if is_no_reply_24h_signal(message):
        return (
            "You didn’t complete the task.\n\n"
            "Are you continuing or stopping?\n\n"
            "Reply:\n"
            "CONTINUE or STOP"
        )
    if is_done_reply(message):
        return (
            "Good.\n\n"
            "What surprised you the most about your spending?\n\n"
            "Answer in 1–2 lines."
        )
    if is_weak_reply(message):
        return (
            "That’s not specific enough.\n\n"
            "Give:\n"
            "- total spent\n"
            "- one mistake you noticed"
        )
    return generate_nudge_message(status, "this week task")


def generate_nudge_message(status: Literal["completed", "partial", "no_action"], task: str) -> str:
    if status == "completed":
        msg = (
            f"Good work. You completed: {task}. Keep momentum now: apply it once in a real situation today, "
            "then send your result and start the next task immediately."
        )
    elif status == "partial":
        msg = (
            f"You started: {task}, but it is not finished. Complete it now before doing anything else. "
            "Set 20 focused minutes, finish the remaining part, and report completion today."
        )
    else:
        msg = (
            f"No action yet on: {task}. Stop delaying. Commit to a start time in the next 30 minutes and execute "
            "the first concrete step. Reply with your commitment now."
        )
    return word_limit(msg, 80)


def normalize_phone(value: str) -> str:
    return "".join(ch for ch in str(value) if ch.isdigit())


def extract_whatsapp_messages(payload: dict) -> List[dict]:
    out: List[dict] = []
    if not isinstance(payload, dict):
        return out

    for entry in payload.get("entry", []) or []:
        for change in (entry or {}).get("changes", []) or []:
            value = (change or {}).get("value", {}) or {}
            contacts = value.get("contacts", []) or []
            contact_name = ""
            if contacts and isinstance(contacts[0], dict):
                contact_name = (
                    ((contacts[0].get("profile") or {}).get("name"))
                    or contacts[0].get("wa_id")
                    or ""
                )
            for message in value.get("messages", []) or []:
                if not isinstance(message, dict):
                    continue
                sender = str(message.get("from") or "").strip()
                msg_type = str(message.get("type") or "unknown").strip()
                text_body = ""
                if msg_type == "text":
                    text_body = str(((message.get("text") or {}).get("body") or "")).strip()
                elif msg_type == "button":
                    text_body = str(((message.get("button") or {}).get("text") or "")).strip()
                elif msg_type == "interactive":
                    interactive = message.get("interactive") or {}
                    if isinstance(interactive, dict):
                        text_body = str(interactive.get("type") or "interactive").strip()

                out.append(
                    {
                        "sender": sender,
                        "sender_name": contact_name,
                        "text": text_body,
                        "message_id": str(message.get("id") or "").strip(),
                        "message_type": msg_type,
                    }
                )
    return out


def load_modules() -> dict:
    if not MODULES_PATH.exists():
        raise HTTPException(status_code=500, detail="Module content file not found.")
    try:
        return json.loads(MODULES_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Invalid module content format.") from exc


def load_coach_prompt() -> str:
    if COACH_PROMPT_PATH.exists():
        return COACH_PROMPT_PATH.read_text().strip()
    return (
        "You are a strict, practical coach. Your job is not to motivate. "
        "Your job is to make the user act. Keep it short, direct, and real-world focused. "
        "Give ONE task only. No theory. No fluff. Return JSON with explanation (max 80 words), "
        "task (1-2 steps), and check-in question."
    )


def get_module_content(modules: dict, module_id: str) -> dict:
    module = modules.get(module_id)
    if not module:
        raise HTTPException(status_code=404, detail="module_id not found.")
    return module


def build_weekly_message(track: str, module: dict) -> str:
    title = str(module.get("title") or "Weekly Module").strip()
    content = str(module.get("content") or module.get("summary") or "").strip()
    return (
        f"BIU.G Academy weekly task ({track}): {title}. "
        f"{content} Reply when done so we can guide your next step."
    )


def call_coach_llm(track: str, goal: str, module_id: str, module_content: dict) -> CoachResponse:
    if SETTINGS is None:
        raise HTTPException(status_code=500, detail="Settings not initialized.")

    model = SETTINGS.openai_model
    client = OpenAI(api_key=SETTINGS.openai_api_key)
    prompt = load_coach_prompt()

    user_payload = {
        "track": track,
        "goal": goal,
        "module_id": module_id,
        "module_content": module_content,
    }

    completion = client.chat.completions.create(
        model=model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": (
                    "Generate coaching output for this learner/module payload. "
                    "Return only JSON with keys: explanation, task, check_in_question.\n\n"
                    + json.dumps(user_payload, ensure_ascii=True)
                ),
            },
        ],
    )

    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise HTTPException(status_code=502, detail="LLM returned empty response.")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="LLM returned invalid JSON.") from exc

    try:
        return CoachResponse(**parsed)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="LLM response missing required fields.") from exc


@app.post("/ai/intake", response_model=IntakeResponse, dependencies=[Depends(require_service_token)])
def ai_intake(payload: IntakeRequest) -> IntakeResponse:
    contact_clean = payload.contact.strip()
    phone_norm = normalize_phone(contact_clean)
    contact_is_phone = is_phone_contact(contact_clean)
    whatsapp_opt_in = bool(payload.whatsapp_consent and contact_is_phone)

    scored = score_applicant(
        {
            "name": payload.name,
            "contact": contact_clean,
            "interest": payload.interest,
            "motivation": payload.motivation,
        }
    )

    try:
        with SessionLocal() as db:
            applicant = Applicant(
                name=payload.name.strip(),
                contact=contact_clean,
                phone_normalized=phone_norm if phone_norm else contact_clean,
                interest=payload.interest.strip().lower(),
                motivation=payload.motivation.strip(),
                ai_score=0,
                ai_track="digital",
                cohort_status="pending",
                whatsapp_opt_in=whatsapp_opt_in,
            )
            db.add(applicant)
            db.flush()
            save_score_to_applicant(db, applicant)
    except Exception as exc:
        logger.exception("Failed to persist applicant intake: %s", exc)
        raise HTTPException(status_code=500, detail="Could not save applicant intake.")

    if whatsapp_opt_in:
        send_whatsapp_text(
            contact_clean,
            "Application received. You’re on the BIU.G Academy first cohort list. "
            "We review every application carefully. If selected, you’ll receive your onboarding steps here.",
        )

    return IntakeResponse(
        score=int(scored["score"]),
        track=scored["track"],
        priority=scored["priority"],
        tags=list(scored.get("tags", [])),
    )


@app.post("/ai/coach", response_model=CoachResponse, dependencies=[Depends(require_service_token)])
def ai_coach(payload: CoachRequest) -> CoachResponse:
    module_id = payload.module_id.strip()

    modules = load_modules()
    module_content = get_module_content(modules, module_id)
    with SessionLocal() as db:
        applicant = db.get(Applicant, payload.applicant_id)
        if not applicant:
            raise HTTPException(status_code=404, detail="applicant_id not found.")
        track = normalize_text(applicant.ai_track or applicant.interest or "digital")
        goal = (applicant.motivation or "").strip() or "Build practical progress this week."

    return call_coach_llm(
        track=track,
        goal=goal,
        module_id=module_id,
        module_content=module_content,
    )


@app.post("/ai/checkin", response_model=CheckinResponse, dependencies=[Depends(require_service_token)])
def ai_checkin(payload: CheckinRequest) -> CheckinResponse:
    with SessionLocal() as db:
        applicant = db.get(Applicant, payload.applicant_id)
        if not applicant:
            raise HTTPException(status_code=404, detail="applicant_id not found.")

        status = classify_checkin_text(payload.message)
        response_text = generate_checkin_response(payload.message, status)

        db.add(
            CohortEvent(
                applicant_id=applicant.id,
                event_type="checkin_classified",
                payload_json=json.dumps(
                    {
                        "message": payload.message,
                        "status": status,
                        "response": response_text,
                    },
                    ensure_ascii=True,
                ),
            )
        )
        db.commit()

    return CheckinResponse(status=status, response=response_text)


@app.post("/ai/nudge", response_model=NudgeResponse, dependencies=[Depends(require_service_token)])
def ai_nudge(payload: NudgeRequest) -> NudgeResponse:
    task = payload.task.strip()
    return NudgeResponse(message=generate_nudge_message(payload.status, task))


@app.get("/webhooks/whatsapp")
def verify_whatsapp_webhook(request: Request):
    mode = request.query_params.get("hub.mode", "")
    token = request.query_params.get("hub.verify_token", "")
    challenge = request.query_params.get("hub.challenge", "")

    if mode == "subscribe" and SETTINGS and secrets_match(token, SETTINGS.whatsapp_verify_token):
        return Response(content=challenge, media_type="text/plain", status_code=200)
    return Response(content="forbidden", media_type="text/plain", status_code=403)


@app.post("/webhooks/whatsapp")
async def inbound_whatsapp_webhook(request: Request):
    # Meta signs every delivery with the app secret. Reject anything unsigned
    # or mis-signed before parsing, so forged deliveries cannot create
    # applicants, write message logs or trigger outbound WhatsApp messages.
    raw_body = await request.body()
    app_secret = SETTINGS.whatsapp_app_secret if SETTINGS else None
    if not valid_meta_signature(raw_body, request.headers.get("X-Hub-Signature-256"), app_secret):
        return Response(content="invalid signature", media_type="text/plain", status_code=401)

    try:
        payload = json.loads(raw_body or b"{}")
    except Exception:
        payload = {}

    try:
        messages = extract_whatsapp_messages(payload)
        if not messages:
            return {"ok": True}

        with SessionLocal() as db:
            for msg in messages:
                sender = msg.get("sender", "")
                sender_norm = normalize_phone(sender)
                text = msg.get("text", "")
                message_type = msg.get("message_type", "unknown")
                inbound_message_id = msg.get("message_id", None)

                if not sender_norm:
                    continue

                applicant = db.execute(
                    select(Applicant).where(Applicant.phone_normalized == sender_norm)
                ).scalar_one_or_none()

                if applicant is None:
                    applicant = Applicant(
                        name=(msg.get("sender_name") or "WhatsApp Applicant"),
                        contact=sender,
                        phone_normalized=sender_norm,
                        interest="unknown",
                        motivation="inbound whatsapp message",
                        ai_score=0,
                        ai_track="digital",
                        cohort_status="pending",
                        # Sending us a message is not consent to broadcasts.
                        # Opt-in is recorded only from an explicit consent field.
                        whatsapp_opt_in=False,
                    )
                    db.add(applicant)
                    db.flush()

                db.add(
                    MessageLog(
                        applicant_id=applicant.id,
                        direction="inbound",
                        channel="whatsapp",
                        message_text=text or "",
                        message_type=message_type,
                        whatsapp_message_id=inbound_message_id,
                    )
                )

                status = classify_checkin_text(text)
                nudge_text = generate_checkin_response(text, status)
                send_whatsapp_text(sender, nudge_text)
            db.commit()
    except Exception as exc:
        logger.exception("WhatsApp webhook processing error: %s", exc)

    return {"ok": True}


@app.post("/admin/cohort/broadcast-weekly-task", response_model=AdminBroadcastResponse)
def admin_broadcast_weekly_task(
    payload: AdminBroadcastRequest,
    admin_secret: str | None = Header(default=None, alias="ADMIN_SECRET"),
) -> AdminBroadcastResponse:
    expected_secret = os.getenv("ADMIN_SECRET", "").strip()
    if not expected_secret:
        raise HTTPException(status_code=500, detail="ADMIN_SECRET not configured.")
    if not secrets_match(admin_secret, expected_secret):
        raise HTTPException(status_code=403, detail="Forbidden")

    modules = load_modules()
    module = get_module_content(modules, payload.module_id.strip())
    weekly_message = build_weekly_message(payload.track, module)

    sent = 0
    failed = 0
    skipped = 0

    with SessionLocal() as db:
        applicants = db.execute(
            select(Applicant).where(
                Applicant.cohort_status == "accepted",
                Applicant.whatsapp_opt_in.is_(True),
                Applicant.ai_track == payload.track,
            )
        ).scalars().all()

        for applicant in applicants:
            to_phone = (applicant.contact or "").strip()
            if not to_phone:
                skipped += 1
                continue

            result = send_whatsapp_text(to_phone, weekly_message)
            if result.get("ok"):
                sent += 1
            else:
                failed += 1

    return AdminBroadcastResponse(sent=sent, failed=failed, skipped=skipped)
