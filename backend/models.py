from pydantic import BaseModel
from typing import List, Optional


class CustomerProfile(BaseModel):
    id: str
    name: str
    sector: str
    kpis: List[str]
    company_size: Optional[str] = None
    region: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


class KPIUpdateRequest(BaseModel):
    name: str
    sector: str
    kpis: List[str]
    company_size: Optional[str] = None
    region: Optional[str] = None


class StoryRequest(BaseModel):
    customer: str


class StoryArc(BaseModel):
    situation: str
    complication: str
    rising_action: str
    resolution: str
    so_what: str
    outcomes: List[str]
    indicative_outcomes: List[str]


class StoryResponse(BaseModel):
    customer: str
    sector: str
    story_arc: StoryArc
    slack_formatted: str
    whatsapp_formatted: str
