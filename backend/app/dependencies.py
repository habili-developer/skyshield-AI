from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from backend.app.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> Optional[str]:
    if settings.api_key:
        if api_key != settings.api_key:
            raise HTTPException(status_code=401, detail="Unauthorized")
    return api_key
