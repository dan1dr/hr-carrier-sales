"""Event logging service — stores call events and post-call extraction."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from api.database import CallRow, EventRow
from api.models.schemas import LogCallRequest, LogCallResponse


async def log_call(db: AsyncSession, req: LogCallRequest) -> LogCallResponse:
    call_id = req.call_id or str(uuid.uuid4())

    call = CallRow(
        call_id=call_id,
        mc_number=req.mc_number,
        carrier_name=req.carrier_name,
        requested_origin=req.requested_origin,
        requested_destination=req.requested_destination,
        equipment_type=req.equipment_type,
        recommended_load_id=req.recommended_load_id,
        loadboard_rate=req.loadboard_rate,
        initial_carrier_ask=req.initial_carrier_ask,
        final_rate=req.final_rate,
        negotiation_rounds=req.negotiation_rounds,
        margin_retained_pct=req.margin_retained_pct,
        outcome=req.outcome,
        sentiment=req.sentiment,
        handoff_required=req.handoff_required,
        call_duration_seconds=req.call_duration_seconds,
        summary=req.summary,
    )
    db.add(call)

    event = EventRow(
        call_id=call_id,
        event_type="call_completed",
        payload=req.model_dump(),
    )
    db.add(event)

    await db.commit()
    return LogCallResponse(call_id=call_id)


async def log_event(db: AsyncSession, call_id: str, event_type: str, payload: dict | None = None) -> str:
    event_id = str(uuid.uuid4())
    event = EventRow(
        event_id=event_id,
        call_id=call_id,
        event_type=event_type,
        payload=payload,
    )
    db.add(event)
    await db.commit()
    return event_id
