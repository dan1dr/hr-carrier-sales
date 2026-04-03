from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_api_key
from api.database import get_db, CarrierRow

router = APIRouter(prefix="/api/v1/carrier", tags=["carrier"])


@router.get("/lookup/{mc_number}")
async def lookup_carrier(
    mc_number: str,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    result = await db.execute(
        select(CarrierRow).where(CarrierRow.mc_number == mc_number)
    )
    carrier = result.scalar_one_or_none()

    if carrier is None:
        return {
            "mc_number": mc_number,
            "found": False,
            "eligible_to_book": False,
            "tier": "new",
        }

    return {
        "mc_number": carrier.mc_number,
        "legal_name": carrier.legal_name,
        "carrier_status": carrier.carrier_status,
        "insurance_status": carrier.insurance_status,
        "safety_rating": carrier.safety_rating,
        "out_of_service": carrier.out_of_service,
        "eligible_to_book": carrier.eligible_to_book,
        "tier": carrier.tier,
        "found": True,
    }
