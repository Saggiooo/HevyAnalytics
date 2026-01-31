from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.sync_service import ensure_synced, full_sync
from app.hevy_client import HevyClient
from app.config import HEVY_BASE_URL

router = APIRouter(prefix="/api", tags=["sync"])

@router.post("/sync")
async def sync_now(
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    """
    force=false -> usa ensure_synced (cooldown)
    force=true  -> forza full_sync completo
    """
    if force:
        client = HevyClient(HEVY_BASE_URL)
        await full_sync(db, client)
    else:
        await ensure_synced(db)

    return {"ok": True, "forced": force}