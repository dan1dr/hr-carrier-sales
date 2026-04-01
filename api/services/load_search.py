"""Load search engine with multi-factor scoring."""

import math
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import LoadRow
from api.models.schemas import LoadMatch, LoadSearchRequest, LoadSearchResponse


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _parse_location(loc: str) -> tuple[str | None, str | None]:
    """Best-effort parse 'City, ST' into (city, state)."""
    parts = [p.strip() for p in loc.split(",")]
    if len(parts) == 2:
        return parts[0].lower(), parts[1].upper().strip()
    return parts[0].lower() if parts else None, None


def _score_lane(req_city: str | None, req_state: str | None,
                load_city: str, load_state: str) -> tuple[float, str]:
    if req_city and req_city == load_city.lower():
        return 1.0, "exact_city_match"
    if req_state and req_state == load_state.upper():
        return 0.6, "same_state"
    return 0.0, "no_lane_match"


def _score_date(load_pickup: datetime, requested_date: datetime | None) -> tuple[float, str]:
    if requested_date is None:
        return 0.5, "no_date_filter"
    delta = abs((load_pickup - requested_date).total_seconds()) / 3600
    if delta <= 24:
        return 1.0, "pickup_within_24h"
    if delta <= 48:
        return 0.7, "pickup_within_48h"
    if delta <= 72:
        return 0.4, "pickup_within_72h"
    return 0.0, "pickup_too_far"


def _score_equipment(load_equip: str, req_equip: str | None) -> tuple[float, str]:
    if req_equip is None:
        return 0.5, "no_equipment_filter"
    if load_equip.lower() == req_equip.lower():
        return 1.0, "equipment_match"
    compatible = {
        ("dry_van", "van"): 0.5,
        ("van", "dry_van"): 0.5,
        ("reefer", "refrigerated"): 0.5,
        ("refrigerated", "reefer"): 0.5,
    }
    return compatible.get((load_equip.lower(), req_equip.lower()), (0.0, "equipment_incompatible"))[:1][0], "equipment_compatible" if (load_equip.lower(), req_equip.lower()) in compatible else "equipment_incompatible"


def _score_urgency(load_pickup: datetime, now: datetime | None = None) -> tuple[float, str]:
    now = now or datetime.utcnow()
    hours_until = (load_pickup - now).total_seconds() / 3600
    if hours_until < 12:
        return 1.0, "urgent_pickup"
    if hours_until < 24:
        return 0.7, "soon_pickup"
    return 0.3, "standard_pickup"


def score_load(load: LoadRow, req: LoadSearchRequest, now: datetime | None = None) -> tuple[float, list[str]]:
    origin_city, origin_state = _parse_location(req.origin)
    dest_city, dest_state = _parse_location(req.destination)

    origin_score, origin_reason = _score_lane(origin_city, origin_state, load.origin_city, load.origin_state)
    dest_score, dest_reason = _score_lane(dest_city, dest_state, load.dest_city, load.dest_state)
    lane_score = (origin_score + dest_score) / 2
    lane_reasons = [r for r in [origin_reason, dest_reason] if "no_" not in r]

    pickup_date = None
    if req.pickup_date:
        try:
            pickup_date = datetime.fromisoformat(req.pickup_date)
        except ValueError:
            pass
    date_score, date_reason = _score_date(load.pickup_datetime, pickup_date)

    equip_score, equip_reason = _score_equipment(load.equipment_type, req.equipment_type)
    urgency_score, urgency_reason = _score_urgency(load.pickup_datetime, now)

    total = (lane_score * 40) + (date_score * 25) + (equip_score * 20) + (urgency_score * 15)

    reasons = lane_reasons + [date_reason, equip_reason, urgency_reason]
    return round(total, 1), [r for r in reasons if "no_" not in r]


async def search_loads(db: AsyncSession, req: LoadSearchRequest) -> LoadSearchResponse:
    result = await db.execute(
        select(LoadRow).where(LoadRow.status == "available")
    )
    loads = result.scalars().all()

    scored: list[tuple[LoadRow, float, list[str]]] = []
    now = datetime.utcnow()
    for load in loads:
        score, reasons = score_load(load, req, now)
        if score > 10:
            scored.append((load, score, reasons))

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:5]

    matches = [
        LoadMatch(
            load_id=load.load_id,
            origin=f"{load.origin_city}, {load.origin_state}",
            destination=f"{load.dest_city}, {load.dest_state}",
            pickup_datetime=load.pickup_datetime,
            delivery_datetime=load.delivery_datetime,
            equipment_type=load.equipment_type,
            loadboard_rate=load.loadboard_rate,
            miles=load.miles,
            weight=load.weight,
            commodity_type=load.commodity_type,
            score=score,
            reason_codes=reasons,
        )
        for load, score, reasons in top
    ]

    return LoadSearchResponse(
        matches=matches,
        recommended=matches[0].load_id if matches else None,
        total_matches=len(matches),
    )
