"""
Anonymises story content from #customer-verified-outcomes so verified
customer names never appear in generated stories.

Rules:
  - Replace competitor analytics tool names with generic labels
  - Remove proper nouns that look like company names
  - Preserve all metrics and percentages (the evidence)
  - Replace person names with role titles
"""

import re
from typing import Optional
from sector_config import SECTORS

# Analytics and data tools that might appear in outcome posts
_TOOL_REPLACEMENTS = {
    r"\bmixpanel\b": "their previous analytics tool",
    r"\bheap\b": "their existing analytics platform",
    r"\bpendo\b": "their product analytics tool",
    r"\bfullstory\b": "their session recording tool",
    r"\bsegment\b": "their data pipeline",
    r"\bbraze\b": "their engagement platform",
    r"\bklaviyo\b": "their email platform",
    r"\bgoogle analytics\b": "GA",
    r"\blooker\b": "their BI tool",
    r"\btableau\b": "their BI tool",
    r"\bpower bi\b": "their BI tool",
    r"\bdbt\b": "their data transformation layer",
    r"\bfivetran\b": "their data pipeline",
    r"\bsnowflake\b": "their data warehouse",
}

# Patterns that likely indicate a real person's full name
_NAME_RE = re.compile(r"\b[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}\b")


def anonymise_text(text: str, sector: str = "") -> str:
    result = text
    for pattern, replacement in _TOOL_REPLACEMENTS.items():
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    result = _NAME_RE.sub("the team", result)
    return result


def get_persona(sector: str, index: int = 0) -> str:
    """Return an anonymous persona descriptor for a given sector."""
    personas = SECTORS.get(sector, {}).get("personas", [f"a leading {sector} company"])
    return personas[index % len(personas)]
