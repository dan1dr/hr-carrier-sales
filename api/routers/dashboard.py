from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_api_key
from api.database import get_db, CallRow, NegotiationConfigRow
from api.models.schemas import DashboardMetrics, NegotiationConfig

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/metrics", response_model=DashboardMetrics)
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    total = (await db.execute(select(func.count(CallRow.call_id)))).scalar() or 0

    outcome_rows = (await db.execute(
        select(CallRow.outcome, func.count(CallRow.call_id)).group_by(CallRow.outcome)
    )).all()
    outcome_breakdown = {row[0]: row[1] for row in outcome_rows}

    sentiment_rows = (await db.execute(
        select(CallRow.sentiment, func.count(CallRow.call_id))
        .where(CallRow.sentiment.isnot(None))
        .group_by(CallRow.sentiment)
    )).all()
    sentiment_breakdown = {row[0]: row[1] for row in sentiment_rows}

    avg_margin = (await db.execute(
        select(func.avg(CallRow.margin_retained_pct))
        .where(CallRow.margin_retained_pct.isnot(None))
    )).scalar()

    avg_rounds = (await db.execute(
        select(func.avg(CallRow.negotiation_rounds))
        .where(CallRow.negotiation_rounds > 0)
    )).scalar()

    booked = outcome_breakdown.get("booked", 0)
    verified = total - outcome_breakdown.get("failed_verification", 0)
    matched = verified - outcome_breakdown.get("no_match", 0)
    negotiated = matched - outcome_breakdown.get("dropped", 0)

    return DashboardMetrics(
        total_calls=total,
        verified_carriers=verified,
        matched_loads=matched,
        entered_negotiation=negotiated,
        booked=booked,
        avg_margin_pct=round(avg_margin, 1) if avg_margin else None,
        avg_negotiation_rounds=round(avg_rounds, 1) if avg_rounds else None,
        outcome_breakdown=outcome_breakdown,
        sentiment_breakdown=sentiment_breakdown,
    )


@router.get("/config", response_model=list[NegotiationConfig])
async def get_configs(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    result = await db.execute(select(NegotiationConfigRow))
    rows = result.scalars().all()
    return [
        NegotiationConfig(
            tier=r.tier, open_pct=r.open_pct, ceiling_pct=r.ceiling_pct,
            max_rounds=r.max_rounds, urgency_boost_pct=r.urgency_boost_pct,
            escalation_sensitivity=r.escalation_sensitivity,
            offered_rate_override=r.offered_rate_override,
        )
        for r in rows
    ]


@router.put("/config", response_model=NegotiationConfig)
async def update_config(
    config: NegotiationConfig,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    result = await db.execute(
        select(NegotiationConfigRow).where(NegotiationConfigRow.tier == config.tier)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = NegotiationConfigRow(tier=config.tier)
        db.add(row)

    row.open_pct = config.open_pct
    row.ceiling_pct = config.ceiling_pct
    row.max_rounds = config.max_rounds
    row.urgency_boost_pct = config.urgency_boost_pct
    row.escalation_sensitivity = config.escalation_sensitivity
    row.offered_rate_override = config.offered_rate_override

    await db.commit()
    return config
