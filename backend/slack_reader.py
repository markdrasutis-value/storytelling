"""
Reads verified customer outcomes from the #customer-verified-outcomes Slack channel.

Posts in that channel should follow this loose format (freeform is also supported):

  SECTOR: fintech
  OUTCOME: 40% improvement in onboarding completion
  CONTEXT: The team was losing a third of users at the KYC step...

Freeform posts containing percentage figures are also parsed and used as story evidence.
When SLACK_BOT_TOKEN is not set the reader falls back to sample_outcomes.json.
"""

import json
import os
import re
from typing import Dict, List, Optional

import aiofiles

_CHANNEL_NAME = "customer-verified-outcomes"
_SAMPLE_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "sample_outcomes.json")

# Lazy-initialised Slack client
_client = None


def _get_client():
    global _client
    if _client is None:
        from slack_sdk.web.async_client import AsyncWebClient
        token = os.environ.get("SLACK_BOT_TOKEN")
        if not token:
            return None
        _client = AsyncWebClient(token=token)
    return _client


async def fetch_verified_outcomes(limit: int = 60) -> List[Dict]:
    """
    Return a list of story-fragment dicts, each with keys:
      sector, outcomes (list[str]), context (str), raw (str)

    Falls back to sample data when Slack is not configured.
    """
    client = _get_client()
    if client is None:
        return await _load_sample_outcomes()

    try:
        from slack_sdk.errors import SlackApiError

        channel_id = await _find_channel(client, _CHANNEL_NAME)
        if not channel_id:
            return await _load_sample_outcomes()

        resp = await client.conversations_history(channel=channel_id, limit=limit)
        messages = resp.get("messages", [])
        parsed = _parse_messages(messages)
        return parsed if parsed else await _load_sample_outcomes()
    except Exception:
        return await _load_sample_outcomes()


async def _find_channel(client, name: str) -> Optional[str]:
    try:
        resp = await client.conversations_list(
            types="public_channel,private_channel", limit=200
        )
        for ch in resp.get("channels", []):
            if ch.get("name") == name:
                return ch["id"]
    except Exception:
        pass
    return None


async def _load_sample_outcomes() -> List[Dict]:
    try:
        async with aiofiles.open(_SAMPLE_FILE, "r") as f:
            raw = await f.read()
            return json.loads(raw)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _parse_messages(messages: List[Dict]) -> List[Dict]:
    results = []
    for msg in messages:
        text = msg.get("text", "").strip()
        if not text or msg.get("subtype"):
            continue
        fragment = _parse_structured(text) or _parse_freeform(text)
        if fragment:
            fragment["raw"] = text
            fragment["ts"] = msg.get("ts", "")
            results.append(fragment)
    return results


def _parse_structured(text: str) -> Optional[Dict]:
    customer_m = re.search(r"CUSTOMER:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    sector_m   = re.search(r"SECTOR:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    outcome_m  = re.search(r"OUTCOME:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    context_m  = re.search(r"CONTEXT:\s*([\s\S]+?)(?:\n\n|$)", text, re.IGNORECASE)
    if not outcome_m:
        return None
    return {
        "source_customer": customer_m.group(1).strip() if customer_m else None,
        "sector": sector_m.group(1).strip().lower() if sector_m else "general",
        "outcomes": [outcome_m.group(1).strip()],
        "context": context_m.group(1).strip() if context_m else "",
        "structured": True,
    }


def _parse_freeform(text: str) -> Optional[Dict]:
    percentages = re.findall(r"\b\d+(?:\.\d+)?%\b", text)
    if not percentages:
        return None
    return {
        "sector": _infer_sector(text),
        "outcomes": percentages,
        "context": text,
        "structured": False,
    }


def _infer_sector(text: str) -> str:
    lower = text.lower()
    keywords = {
        "ecommerce":          ["cart", "checkout", "conversion", "purchase", "retail", "shop"],
        "fintech":            ["kyc", "onboarding", "transaction", "payment", "bank", "lending"],
        "media_entertainment": ["content", "subscriber", "stream", "watch", "listen", "publish"],
        "saas":               ["trial", "activation", "feature adoption", "saas", "b2b", "enterprise"],
        "gaming":             ["player", "retention", "level", "session", "game", "arppu"],
        "travel":             ["booking", "hotel", "flight", "travel", "itinerary"],
        "healthcare":         ["patient", "health", "clinical", "care", "appointment"],
    }
    for sector, kws in keywords.items():
        if any(kw in lower for kw in kws):
            return sector
    return "general"
