from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_api_key
from api.database import get_db
from api.models.schemas import LoadSearchRequest, LoadSearchResponse
from api.services.load_search import search_loads

router = APIRouter(prefix="/api/v1/loads", tags=["loads"])


@router.post("/search", response_model=LoadSearchResponse)
async def search(
    req: LoadSearchRequest,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(require_api_key),
):
    return await search_loads(db, req)
