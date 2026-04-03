from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_api_key
from api.database import CallRow, EventRow, get_db
from api.models.schemas import LogCallRequest, LogCallResponse
from api.services.event_logger import log_call

router = APIRouter(prefix="/api/v1/calls", tags=["calls"])


def _call_list_item(r: CallRow) -> dict:
    return {
        "call_id": r.call_id,
        "mc_number": r.mc_number,
        "caller_name": r.caller_name,
        "requested_origin": r.requested_origin,
        "requested_destination": r.requested_destination,
        "equipment_type": r.equipment_type,
        "outcome": r.outcome,
        "sentiment": r.sentiment,
        "created_at": r.created_at,
        "call_duration_seconds": r.call_duration_seconds,
        "final_rate": r.final_rate,
        "loadboard_rate": r.loadboard_rate,
        "negotiation_rounds": r.negotiation_rounds,
        "margin_retained_pct": r.margin_retained_pct,
        "handoff_required": r.handoff_required,
        "summary": r.summary,
    }


def _event_item(e: EventRow) -> dict:
    return {
        "event_id": e.event_id,
        "call_id": e.call_id,
        "event_type": e.event_type,
        "payload": e.payload,
        "created_at": e.created_at,
    }


@router.get("")
async def list_calls(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
    outcome: str | None = None,
    sentiment: str | None = None,
):
    filters = []
    if outcome is not None:
        filters.append(CallRow.outcome == outcome)
    if sentiment is not None:
        filters.append(CallRow.sentiment == sentiment)

    count_stmt = select(func.count(CallRow.call_id))
    list_stmt = select(CallRow).order_by(CallRow.created_at.desc()).limit(limit).offset(offset)
    if filters:
        count_stmt = count_stmt.where(*filters)
        list_stmt = list_stmt.where(*filters)

    total = (await db.execute(count_stmt)).scalar() or 0
    rows = (await db.execute(list_stmt)).scalars().all()

    return {
        "calls": [_call_list_item(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{call_id}")
async def get_call(
    call_id: str,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    result = await db.execute(select(CallRow).where(CallRow.call_id == call_id))
    call = result.scalar_one_or_none()
    if call is None:
        raise HTTPException(status_code=404, detail="Call not found")

    ev_result = await db.execute(
        select(EventRow)
        .where(EventRow.call_id == call_id)
        .order_by(EventRow.created_at.asc())
    )
    events = [_event_item(e) for e in ev_result.scalars().all()]

    return {**_call_list_item(call), "events": events}


@router.post("/log", response_model=LogCallResponse)
async def log(
    req: LogCallRequest,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    return await log_call(db, req)
