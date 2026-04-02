from fastapi import APIRouter, Depends

from api.auth import require_api_key
from api.models.schemas import EvaluateOfferRequest, EvaluateOfferResponse
from api.services.negotiation_engine import evaluate_offer

router = APIRouter(prefix="/api/v1/negotiate", tags=["negotiate"])


@router.post("/evaluate", response_model=EvaluateOfferResponse)
async def evaluate(
    req: EvaluateOfferRequest,
    _key: str = Depends(require_api_key),
):
    return evaluate_offer(req)
