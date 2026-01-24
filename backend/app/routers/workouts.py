from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from app.db import get_db
from app.models import Workout
from app.schemas import WorkoutOut
from app.sync_service import ensure_synced

router = APIRouter()

@router.get("/workouts", response_model=list[WorkoutOut])
async def list_workouts(
    year: int | None = Query(default=None),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
    includeIgnored: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    await ensure_synced(db)

    stmt = select(Workout)
    if not includeIgnored:
        stmt = stmt.where(Workout.ignored == False)  # noqa

    if year:
        start = datetime(year, 1, 1)
        end = datetime(year + 1, 1, 1)
        stmt = stmt.where(Workout.date >= start, Workout.date < end)

    if date_from:
        stmt = stmt.where(Workout.date >= datetime.fromisoformat(date_from))
    if date_to:
        stmt = stmt.where(Workout.date <= datetime.fromisoformat(date_to))

    stmt = stmt.order_by(Workout.date.desc())
    rows = db.execute(stmt).scalars().all()

    return [
        WorkoutOut(
            id=w.id, title=w.title, date=w.date,
            duration_seconds=w.duration_seconds,
            ignored=bool(w.ignored),
            type_id=w.type_id,
        )
        for w in rows
    ]
