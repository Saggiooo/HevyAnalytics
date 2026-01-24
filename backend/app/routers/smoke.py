from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.models import Workout

router = APIRouter(prefix="/api", tags=["smoke"])

@router.get("/smoke")
def smoke(db: Session = Depends(get_db)):
    total = db.query(func.count(Workout.id)).scalar() or 0
    last_date = db.query(func.max(Workout.date)).scalar()
    return {
        "workouts_count": int(total),
        "last_workout_date": last_date.isoformat() if last_date else None,
    }
