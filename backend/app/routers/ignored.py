from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Workout

router = APIRouter()

@router.post("/ignored/{workout_id}")
def toggle_ignored(workout_id: str, db: Session = Depends(get_db)):
    w = db.get(Workout, workout_id)
    if not w:
        return {"ok": False, "message": "workout not found"}
    w.ignored = not bool(w.ignored)
    db.commit()
    return {"ok": True, "workout_id": workout_id, "ignored": bool(w.ignored)}
