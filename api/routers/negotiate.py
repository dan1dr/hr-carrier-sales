from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_api_key
from api.database import get_db
from api.models.schemas import EvaluateOfferRequest, EvaluateOfferResponse
from api.services.negotiation_engine import evaluate_offer

router = APIRouter(prefix="/api/v1/negotiate", tags=["negotiate"])


@router.post("/evaluate", response_model=EvaluateOfferResponse)
async def evaluate(
    req: EvaluateOfferRequest,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    return await evaluate_offer(db, req)
