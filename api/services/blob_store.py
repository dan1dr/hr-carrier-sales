"""Azure Blob Storage client — uploads call event JSON as immutable audit trail.

Gracefully degrades: if the connection string is empty or the upload fails,
the call is still logged to the local DB and the error is printed (not raised).
"""

import json
import logging
from datetime import datetime, timezone

from azure.storage.blob import BlobServiceClient

from api.config import settings

logger = logging.getLogger(__name__)

_client: BlobServiceClient | None = None


def _get_client() -> BlobServiceClient | None:
    global _client
    if _client is not None:
        return _client
    if not settings.azure_storage_connection_string:
        return None
    _client = BlobServiceClient.from_connection_string(
        settings.azure_storage_connection_string
    )
    return _client


def upload_call_event(call_id: str, payload: dict) -> str | None:
    """Upload a call event JSON to Azure Blob Storage.

    Returns the blob path on success, None on skip/failure.
    """
    client = _get_client()
    if client is None:
        return None

    now = datetime.now(timezone.utc)
    blob_path = f"call-logs/{now:%Y/%m/%d}/{call_id}.json"

    try:
        container = client.get_container_client(settings.azure_storage_container)
        container.upload_blob(
            name=blob_path,
            data=json.dumps(payload, default=str, indent=2),
            content_type="application/json",
            overwrite=True,
        )
        logger.info("Uploaded %s to Azure Blob Storage", blob_path)
        return blob_path
    except Exception:
        logger.exception("Failed to upload %s to Azure Blob Storage", blob_path)
        return None
