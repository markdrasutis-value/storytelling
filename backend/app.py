"""
FastAPI application — serves:
  /app/*              Mobile KPI entry UI (static)
  /api/sectors        Sector taxonomy
  /api/customers      Customer KPI CRUD
  /api/story          Story generation
  /slack/events       Slack Event API webhook  (listens for "story for [name]")
  /whatsapp/webhook   Twilio WhatsApp webhook  (listens for "story for [name]")
"""

import asyncio
import hashlib
import hmac
import json
import os
import time
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from kpi_store import get_customer, list_customers, upsert_customer
from models import KPIUpdateRequest, StoryRequest
from sector_config import SECTORS
from slack_reader import fetch_verified_outcomes
from story_engine import generate_story

load_dotenv()

_SLACK_SIGNING_SECRET = os.environ.get("SLACK_SIGNING_SECRET", "")
_SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
_FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")


# ── App ───────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Amplitude Story Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.isdir(_FRONTEND_DIR):
    app.mount("/app", StaticFiles(directory=_FRONTEND_DIR, html=True), name="ui")


# ── Sector & Customer API ─────────────────────────────────────────────────────

@app.get("/api/sectors")
async def sectors_list():
    return {k: {"label": v["label"], "kpis": v["kpis"]} for k, v in SECTORS.items()}


@app.get("/api/customers")
async def customers_list():
    return [c.model_dump() for c in await list_customers()]


@app.post("/api/customers", status_code=201)
async def customer_upsert(req: KPIUpdateRequest):
    return (await upsert_customer(req)).model_dump()


@app.get("/api/customers/{name}")
async def customer_get(name: str):
    profile = await get_customer(name)
    if not profile:
        raise HTTPException(404, f"No profile found for '{name}'")
    return profile.model_dump()


# ── Story API ─────────────────────────────────────────────────────────────────

@app.post("/api/story")
async def story_generate(req: StoryRequest):
    profile = await get_customer(req.customer)
    if not profile:
        raise HTTPException(
            404,
            f"No KPI profile for '{req.customer}'. Add one via the Story Engine app.",
        )
    fragments = await fetch_verified_outcomes()
    story = await generate_story(profile, fragments)
    return story.model_dump()


# ── Slack Webhook ─────────────────────────────────────────────────────────────

def _slack_sig_valid(body: bytes, timestamp: str, signature: str) -> bool:
    if not _SLACK_SIGNING_SECRET:
        return True  # skip verification in dev
    if abs(time.time() - float(timestamp)) > 300:
        return False
    base = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.new(
        _SLACK_SIGNING_SECRET.encode(), base.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.post("/slack/events")
async def slack_events(request: Request):
    body = await request.body()
    ts = request.headers.get("X-Slack-Request-Timestamp", "0")
    sig = request.headers.get("X-Slack-Signature", "")
    if not _slack_sig_valid(body, ts, sig):
        raise HTTPException(401, "Invalid Slack signature")

    payload = json.loads(body)

    if payload.get("type") == "url_verification":
        return {"challenge": payload["challenge"]}

    event = payload.get("event", {})
    if (
        event.get("type") == "message"
        and not event.get("bot_id")
        and not event.get("subtype")
    ):
        text = event.get("text", "").strip()
        if text.lower().startswith("story for "):
            customer_name = text[len("story for "):].strip().rstrip(".")
            asyncio.create_task(
                _slack_story(customer_name, event["channel"], event.get("ts", ""))
            )

    return {"ok": True}


async def _slack_story(customer_name: str, channel: str, thread_ts: str) -> None:
    headers = {"Authorization": f"Bearer {_SLACK_BOT_TOKEN}"}
    async with httpx.AsyncClient(timeout=60) as client:
        await client.post(
            "https://slack.com/api/chat.postMessage",
            headers=headers,
            json={
                "channel": channel,
                "thread_ts": thread_ts,
                "text": f":hourglass_flowing_sand: Building story for *{customer_name}*…",
            },
        )

        profile = await get_customer(customer_name)
        if not profile:
            await client.post(
                "https://slack.com/api/chat.postMessage",
                headers=headers,
                json={
                    "channel": channel,
                    "thread_ts": thread_ts,
                    "text": (
                        f":warning: No KPI profile found for *{customer_name}*. "
                        "Add one at the Story Engine web app first."
                    ),
                },
            )
            return

        fragments = await fetch_verified_outcomes()
        story = await generate_story(profile, fragments)
        blocks = json.loads(story.slack_formatted)

        await client.post(
            "https://slack.com/api/chat.postMessage",
            headers=headers,
            json={
                "channel": channel,
                "thread_ts": thread_ts,
                "blocks": blocks,
                "text": f"Story Arc: {customer_name}",
            },
        )


# ── WhatsApp Webhook (Twilio) ─────────────────────────────────────────────────

@app.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request):
    form = await request.form()
    body = str(form.get("Body", "")).strip()

    if body.lower().startswith("story for "):
        customer_name = body[len("story for "):].strip().rstrip(".")
        profile = await get_customer(customer_name)
        if not profile:
            reply = (
                f"No KPI profile found for *{customer_name}*. "
                "Please add their profile via the Story Engine web app first."
            )
        else:
            fragments = await fetch_verified_outcomes()
            story = await generate_story(profile, fragments)
            reply = story.whatsapp_formatted
    elif body.lower() in ("help", "?", "hi", "hello"):
        reply = (
            "*Amplitude Story Engine*\n\n"
            "Send: `story for [customer name]`\n\n"
            "Example: `story for Acme Corp`\n\n"
            "The customer must have a KPI profile saved in the web app."
        )
    else:
        reply = "Send `story for [customer name]` to generate a story. Send `help` for more."

    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Message>{reply}</Message></Response>"
    )
    return Response(content=twiml, media_type="application/xml")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
