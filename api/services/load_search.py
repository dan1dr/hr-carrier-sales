"""Load search engine with adaptive multi-factor scoring.

Only origin is required. Every additional field the carrier provides
narrows the search and boosts match quality. If load_id is given,
we return that exact load (direct lookup).
"""

import math
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import LoadRow
from api.models.schemas import LoadMatch, LoadSearchRequest, LoadSearchResponse


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 3959
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _parse_location(loc: str) -> tuple[str | None, str | None]:
    parts = [p.strip() for p in loc.split(",")]
    if len(parts) == 2:
        return parts[0].lower(), parts[1].upper().strip()
    return parts[0].lower() if parts else None, None


def _score_city_state(req_city: str | None, req_state: str | None,
                      load_city: str, load_state: str) -> tuple[float, str]:
    if req_city and req_city == load_city.lower():
        return 1.0, "exact_city_match"
    if req_state and req_state == load_state.upper():
        return 0.6, "same_state"
    return 0.0, "no_match"


def _score_date(load_dt: datetime, requested: datetime | None) -> tuple[float, str]:
    if requested is None:
        return 0.0, "not_provided"
    delta_h = abs((load_dt - requested).total_seconds()) / 3600
    if delta_h <= 6:
        return 1.0, "exact_date"
    if delta_h <= 24:
        return 0.8, "within_24h"
    if delta_h <= 48:
        return 0.5, "within_48h"
    if delta_h <= 72:
        return 0.3, "within_72h"
    return 0.0, "too_far"


def _score_equipment(load_equip: str, req_equip: str | None) -> tuple[float, str]:
    if req_equip is None:
        return 0.0, "not_provided"
    if load_equip.lower() == req_equip.lower():
        return 1.0, "exact_equipment"
    compatible = {
        ("dry_van", "van"), ("van", "dry_van"),
        ("reefer", "refrigerated"), ("refrigerated", "reefer"),
    }
    if (load_equip.lower(), req_equip.lower()) in compatible:
        return 0.6, "compatible_equipment"
    return 0.0, "incompatible_equipment"


def _score_weight(load_weight: float | None, req_weight: float | None) -> tuple[float, str]:
    if req_weight is None or load_weight is None:
        return 0.0, "not_provided"
    if load_weight >= req_weight:
        return 1.0, "weight_ok"
    ratio = load_weight / req_weight
    if ratio >= 0.8:
        return 0.5, "weight_close"
    return 0.0, "weight_mismatch"


def _score_miles(load_miles: float | None, req_miles: float | None) -> tuple[float, str]:
    if req_miles is None or load_miles is None:
        return 0.0, "not_provided"
    diff_pct = abs(load_miles - req_miles) / max(req_miles, 1)
    if diff_pct <= 0.1:
        return 1.0, "miles_match"
    if diff_pct <= 0.3:
        return 0.5, "miles_close"
    return 0.0, "miles_mismatch"


def _score_urgency(load_pickup: datetime, now: datetime) -> tuple[float, str]:
    hours_until = (load_pickup - now).total_seconds() / 3600
    if hours_until < 0:
        return 0.0, "past_pickup"
    if hours_until < 12:
        return 1.0, "urgent"
    if hours_until < 24:
        return 0.7, "soon"
    return 0.3, "standard"


def score_load(load: LoadRow, req: LoadSearchRequest, now: datetime) -> tuple[float, list[str]]:
    """Adaptive scoring: weights shift based on which fields the carrier provided.

    Origin is always scored. Each additional field adds its own scoring
    dimension. The total is normalized to 0-100 regardless of how many
    fields were provided, so a 2-field search and a 6-field search
    produce comparable scores.
    """
    factors: list[tuple[float, float, str]] = []  # (score, weight, reason)

    # Origin — always present, always weighted heavily
    o_city, o_state = _parse_location(req.origin)
    o_score, o_reason = _score_city_state(o_city, o_state, load.origin_city, load.origin_state)
    factors.append((o_score, 35, o_reason))

    # Destination — if provided
    if req.destination:
        d_city, d_state = _parse_location(req.destination)
        d_score, d_reason = _score_city_state(d_city, d_state, load.dest_city, load.dest_state)
        factors.append((d_score, 30, d_reason))

    # Equipment — if provided
    e_score, e_reason = _score_equipment(load.equipment_type, req.equipment_type)
    if req.equipment_type:
        factors.append((e_score, 20, e_reason))

    # Pickup date — if provided
    pickup_dt = None
    if req.pickup_date:
        try:
            pickup_dt = datetime.fromisoformat(req.pickup_date)
        except ValueError:
            pass
    if pickup_dt:
        p_score, p_reason = _score_date(load.pickup_datetime, pickup_dt)
        factors.append((p_score, 15, p_reason))

    # Delivery date — if provided
    delivery_dt = None
    if req.delivery_date:
        try:
            delivery_dt = datetime.fromisoformat(req.delivery_date)
        except ValueError:
            pass
    if delivery_dt:
        dl_score, dl_reason = _score_date(load.delivery_datetime, delivery_dt)
        factors.append((dl_score, 10, dl_reason))

    # Weight — if provided
    w_score, w_reason = _score_weight(load.weight, req.weight)
    if req.weight:
        factors.append((w_score, 8, w_reason))

    # Miles — if provided
    m_score, m_reason = _score_miles(load.miles, req.miles)
    if req.miles:
        factors.append((m_score, 8, m_reason))

    # Urgency — always scored (based on how soon the load picks up)
    u_score, u_reason = _score_urgency(load.pickup_datetime, now)
    factors.append((u_score, 10, u_reason))

    # Normalize: scale to 0-100 based on actual weights used
    total_weight = sum(w for _, w, _ in factors)
    if total_weight == 0:
        return 0.0, []

    raw = sum(s * w for s, w, _ in factors)
    normalized = (raw / total_weight) * 100

    reasons = [r for _, _, r in factors if r not in ("not_provided", "no_match", "past_pickup")]
    return round(normalized, 1), reasons


async def search_loads(db: AsyncSession, req: LoadSearchRequest) -> LoadSearchResponse:
    # Direct lookup by load_id
    if req.load_id:
        result = await db.execute(
            select(LoadRow).where(LoadRow.load_id == req.load_id)
        )
        load = result.scalar_one_or_none()
        if load is None:
            return LoadSearchResponse(matches=[], recommended=None, total_matches=0)
        return LoadSearchResponse(
            matches=[LoadMatch(
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
                score=100.0,
                reason_codes=["direct_lookup"],
            )],
            recommended=load.load_id,
            total_matches=1,
        )

    # Scored search across all available loads
    result = await db.execute(
        select(LoadRow).where(LoadRow.status == "available")
    )
    loads = result.scalars().all()

    scored: list[tuple[LoadRow, float, list[str]]] = []
    now = datetime.utcnow()
    for load in loads:
        score, reasons = score_load(load, req, now)
        if score > 15:
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
