from fastapi import APIRouter
from app.db import engine
from sqlalchemy import text

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"ok": True}
