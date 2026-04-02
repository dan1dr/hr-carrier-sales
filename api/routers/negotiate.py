from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_api_key
from api.database import get_db, NegotiationConfigRow
from api.models.schemas import (
    EvaluateOfferRequest,
    EvaluateOfferResponse,
    PricingParamsRequest,
    PricingParamsResponse,
)
from api.services.negotiation_engine import evaluate_offer

router = APIRouter(prefix="/api/v1/negotiate", tags=["negotiate"])


@router.post("/params", response_model=PricingParamsResponse)
async def get_pricing_params(
    req: PricingParamsRequest,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    result = await db.execute(
        select(NegotiationConfigRow).where(NegotiationConfigRow.tier == req.tier)
    )
    row = result.scalar_one_or_none()

    if row is None:
        return PricingParamsResponse(
            tier=req.tier, open_pct=0.85, ceiling_pct=1.00,
        )

    return PricingParamsResponse(
        tier=row.tier,
        open_pct=row.open_pct,
        ceiling_pct=row.ceiling_pct,
        offered_rate_override=row.offered_rate_override,
    )


@router.post("/evaluate", response_model=EvaluateOfferResponse)
async def evaluate(
    req: EvaluateOfferRequest,
    _key: str = Depends(require_api_key),
):
    return evaluate_offer(req)
