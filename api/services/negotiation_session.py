"""Server-side negotiation round tracking per carrier + load."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import NegotiationSessionRow
from api.models.schemas import EvaluateOfferResponse

SESSION_TTL = timedelta(minutes=3)


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def resolve_round(
    db: AsyncSession,
    mc_number: str,
    load_id: str,
) -> tuple[int, NegotiationSessionRow | None]:
    """Return stored round for this carrier+load, or 0 after idle TTL."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(NegotiationSessionRow).where(
            NegotiationSessionRow.mc_number == mc_number,
            NegotiationSessionRow.load_id == load_id,
        )
    )
    row = result.scalar_one_or_none()

    if row is None:
        return 0, None

    if now - _utc(row.updated_at) > SESSION_TTL:
        row.current_round = 0
        return 0, row

    return row.current_round, row


async def persist_after_evaluate(
    db: AsyncSession,
    mc_number: str,
    load_id: str,
    row: NegotiationSessionRow | None,
    round_used: int,
    resp: EvaluateOfferResponse,
) -> None:
    now = datetime.now(timezone.utc)

    if resp.decision in ("accept", "reject"):
        if row is not None:
            db.delete(row)
        return

    if resp.decision != "counter":
        return

    next_round = min(round_used + 1, 2)
    if row is None:
        db.add(
            NegotiationSessionRow(
                mc_number=mc_number,
                load_id=load_id,
                current_round=next_round,
                updated_at=now,
            )
        )
    else:
        row.current_round = next_round
        row.updated_at = now
