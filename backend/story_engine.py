"""
Story generation engine.

Takes a customer KPI profile + anonymised Slack story fragments and calls
Claude to produce a classic 5-part story arc:

  Situation → Complication → Rising Action → Resolution → So What

Output is returned in both Slack Block Kit JSON and WhatsApp plain-text formats.
"""

import json
import os
from typing import Dict, List, Optional

import anthropic

from anonymiser import anonymise_text, get_persona
from models import CustomerProfile, StoryArc, StoryResponse
from sector_config import SECTORS

_client: Optional[anthropic.AsyncAnthropic] = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


def _indicative_outcomes(sector: str, kpis: List[str]) -> List[str]:
    outcomes_map = SECTORS.get(sector, {}).get("indicative_outcomes", {})
    matched: List[str] = []
    for kpi in kpis[:4]:
        kl = kpi.lower()
        for key, outcome in outcomes_map.items():
            if key != "default" and any(w in kl for w in key.split()):
                if outcome not in matched:
                    matched.append(outcome)
                    break
    if not matched:
        default = outcomes_map.get("default")
        if default:
            matched.append(default)
    return matched[:4]


def _format_fragments(fragments: List[Dict], sector: str) -> str:
    if not fragments:
        return "No verified outcomes on file for this sector yet — use indicative data."
    relevant = [f for f in fragments if f.get("sector") in (sector, "general")][:5]
    if not relevant:
        relevant = fragments[:4]
    lines = []
    for i, f in enumerate(relevant, 1):
        ctx = anonymise_text(f.get("context", ""), sector)[:220]
        outcomes = ", ".join(f.get("outcomes", []))
        source = f.get("source_customer")
        cite = f" [verified: {source}]" if source else ""
        lines.append(f"{i}.{cite} {ctx}… [outcomes: {outcomes}]")
    return "\n".join(lines)


async def generate_story(
    profile: CustomerProfile,
    story_fragments: List[Dict],
) -> StoryResponse:
    client = _get_client()

    sector_data = SECTORS.get(profile.sector, {})
    sector_label = sector_data.get("label", profile.sector)
    persona = get_persona(profile.sector)
    kpis_str = ", ".join(profile.kpis[:5]) if profile.kpis else "key product metrics"
    ind_outcomes = _indicative_outcomes(profile.sector, profile.kpis)
    challenges = sector_data.get("challenge_themes", [])[:3]
    fragments_text = _format_fragments(story_fragments, profile.sector)

    size_ctx = f"{profile.company_size} " if profile.company_size else ""
    region_ctx = f"{profile.region} " if profile.region else ""

    system = (
        "You are an expert storyteller for Amplitude, a product analytics platform. "
        "You craft compelling, evidence-based customer stories for senior product and data leaders. "
        "Write in a direct, confident tone — Harvard Business Review, not a sales brochure. "
        "Never use vague buzzwords like 'leverage', 'synergy', or 'unlock'."
    )

    prompt = f"""Create a customer story arc for a sales conversation with {profile.name}.

PROSPECT PROFILE
- Company: {profile.name}
- Sector: {sector_label}
- Context: {size_ctx}{region_ctx}company
- KPIs they care about: {kpis_str}

VERIFIED OUTCOMES FROM SIMILAR {sector_label.upper()} CUSTOMERS
{fragments_text}

Important: where a [verified: CustomerName] tag appears above, preserve it in the story output
immediately after the anonymised persona descriptor (e.g. "A leading e-commerce company [Officeworks]").
This lets the AE confirm the outcome is real. Only cite sources that appear in the data above.

INDICATIVE OUTCOMES FOR THEIR SECTOR AND KPIS
{chr(10).join(f"- {o}" for o in ind_outcomes)}

COMMON CHALLENGES AMPLITUDE SOLVES IN THIS SECTOR
{chr(10).join(f"- {c}" for c in challenges)}

Return ONLY valid JSON matching this exact structure — no markdown fences, no extra keys:
{{
  "situation": "2-3 sentences. Establish the world this type of {sector_label} company lives in — their ambitions, their scale, what normal looks like for them.",
  "complication": "2-3 sentences. The specific data or analytics challenge holding similar companies back. Pick the most relatable challenge from the list above. Make it feel real and specific to {sector_label}.",
  "rising_action": "2 sentences. What they tried before Amplitude and why it fell short — custom dashboards, analyst bottlenecks, slow tooling.",
  "resolution": "2-3 sentences. How Amplitude changed the game: self-serve insights, fast experimentation, clear behavioural visibility. Reference 1-2 specific outcomes from the verified data above.",
  "so_what": "2-3 sentences. Directly address {profile.name} by name. What does this mean for their focus on {kpis_str}? Make it specific and personal.",
  "outcomes": ["3-5 bullet strings from verified customer data — specific and numerical where possible, e.g. '+22% conversion rate in 90 days'"],
  "indicative_outcomes": ["2-3 bullet strings of what {profile.name} could realistically expect, phrased as ranges not guarantees, tied to their specific KPIs"]
}}"""

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1600,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    # Strip any accidental markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.split("```")[0].strip()

    data = json.loads(raw)

    arc = StoryArc(
        situation=data["situation"],
        complication=data["complication"],
        rising_action=data["rising_action"],
        resolution=data["resolution"],
        so_what=data["so_what"],
        outcomes=data.get("outcomes", []),
        indicative_outcomes=data.get("indicative_outcomes", ind_outcomes),
    )

    return StoryResponse(
        customer=profile.name,
        sector=profile.sector,
        story_arc=arc,
        slack_formatted=_to_slack(profile.name, arc),
        whatsapp_formatted=_to_whatsapp(profile.name, arc),
    )


def _to_slack(customer: str, arc: StoryArc) -> str:
    """Serialize to Slack Block Kit JSON string."""
    def section(text: str) -> Dict:
        return {"type": "section", "text": {"type": "mrkdwn", "text": text}}

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"Story Arc: {customer}"}},
        {"type": "divider"},
        section(f"*The Context*\n{arc.situation}"),
        section(f"*The Challenge*\n{arc.complication}"),
        section(f"*What They Tried*\n{arc.rising_action}"),
        section(f"*The Turning Point*\n{arc.resolution}"),
        {"type": "divider"},
        section("*Verified Outcomes*\n" + "\n".join(f"• {o}" for o in arc.outcomes)),
        section(f"*What This Means for {customer}*\n{arc.so_what}"),
        section("*Indicative Outcomes*\n" + "\n".join(f"• {o}" for o in arc.indicative_outcomes)),
    ]
    return json.dumps(blocks)


def _to_whatsapp(customer: str, arc: StoryArc) -> str:
    """Plain text with WhatsApp *bold* markers."""
    lines = [
        f"*Story Arc: {customer}*",
        "",
        "*The Context*",
        arc.situation,
        "",
        "*The Challenge*",
        arc.complication,
        "",
        "*What They Tried*",
        arc.rising_action,
        "",
        "*The Turning Point*",
        arc.resolution,
        "",
        "*Verified Outcomes*",
        *[f"• {o}" for o in arc.outcomes],
        "",
        f"*What This Means for {customer}*",
        arc.so_what,
        "",
        "*Indicative Outcomes*",
        *[f"• {o}" for o in arc.indicative_outcomes],
    ]
    return "\n".join(lines)
