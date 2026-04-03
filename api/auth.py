"""API key authentication middleware."""

from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from api.config import settings

_api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)


async def require_api_key(api_key: str | None = Security(_api_key_header)) -> str:
    if not api_key or api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return api_key
