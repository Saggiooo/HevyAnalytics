from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.sync_service import full_sync  # o ensure_synced se vuoi cooldown
from app.hevy_client import HevyClient
from app.config import HEVY_BASE_URL

router = APIRouter(prefix="/api", tags=["sync"])

@router.post("/sync")
async def sync_now(db: Session = Depends(get_db)):
    client = HevyClient(HEVY_BASE_URL)
    await full_sync(db, client)  # sync completo (per ora)
    return {"ok": True}
