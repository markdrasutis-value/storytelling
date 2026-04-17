"""
JSON-file storage for customer KPI profiles.
Thread-safe enough for single-server use; swap for a DB when scaling.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

import aiofiles

from models import CustomerProfile, KPIUpdateRequest

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_CUSTOMERS_FILE = os.path.join(_DATA_DIR, "customers.json")


def _ensure_store() -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    if not os.path.exists(_CUSTOMERS_FILE):
        with open(_CUSTOMERS_FILE, "w") as f:
            json.dump({}, f)


async def _load() -> Dict:
    _ensure_store()
    try:
        async with aiofiles.open(_CUSTOMERS_FILE, "r") as f:
            raw = await f.read()
            return json.loads(raw) if raw.strip() else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


async def _save(data: Dict) -> None:
    _ensure_store()
    async with aiofiles.open(_CUSTOMERS_FILE, "w") as f:
        await f.write(json.dumps(data, indent=2))


async def upsert_customer(req: KPIUpdateRequest) -> CustomerProfile:
    store = await _load()
    now = datetime.now(timezone.utc).isoformat()

    existing_id: Optional[str] = None
    for cid, cdata in store.items():
        if cdata.get("name", "").lower() == req.name.lower():
            existing_id = cid
            break

    if existing_id:
        store[existing_id].update(
            sector=req.sector,
            kpis=req.kpis,
            company_size=req.company_size,
            region=req.region,
            updated_at=now,
        )
        profile = CustomerProfile(**store[existing_id])
    else:
        cid = str(uuid.uuid4())
        store[cid] = dict(
            id=cid,
            name=req.name,
            sector=req.sector,
            kpis=req.kpis,
            company_size=req.company_size,
            region=req.region,
            created_at=now,
            updated_at=now,
        )
        profile = CustomerProfile(**store[cid])

    await _save(store)
    return profile


async def get_customer(name: str) -> Optional[CustomerProfile]:
    store = await _load()
    for cdata in store.values():
        if cdata.get("name", "").lower() == name.lower():
            return CustomerProfile(**cdata)
    return None


async def list_customers() -> List[CustomerProfile]:
    store = await _load()
    return [CustomerProfile(**c) for c in store.values()]
