from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_api_key
from api.database import get_db
from api.models.schemas import LogCallRequest, LogCallResponse
from api.services.event_logger import log_call

router = APIRouter(prefix="/api/v1/calls", tags=["calls"])


@router.post("/log", response_model=LogCallResponse)
async def log(
    req: LogCallRequest,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    return await log_call(db, req)
