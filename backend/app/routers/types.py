from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.models import WorkoutType, Workout
from app.schemas import WorkoutTypeOut, AssignWorkoutTypeIn

router = APIRouter()

@router.get("/workout-types", response_model=list[WorkoutTypeOut])
def list_types(db: Session = Depends(get_db)):
    rows = db.execute(select(WorkoutType).order_by(WorkoutType.name.asc())).scalars().all()
    return [WorkoutTypeOut(id=t.id, name=t.name) for t in rows]

@router.post("/workout-types/assign")
def assign_type(payload: AssignWorkoutTypeIn, db: Session = Depends(get_db)):
    w = db.get(Workout, payload.workout_id)
    if not w:
        return {"ok": False, "message": "workout not found"}
    w.type_id = payload.type_id
    db.commit()
    return {"ok": True}

from sqlalchemy import func

@router.get("/workout-title-types", response_model=list[str])
def list_title_types(db: Session = Depends(get_db)):
    # titoli distinti, ordinati
    rows = db.execute(
        select(Workout.title)
        .where(Workout.title.isnot(None))
        .group_by(Workout.title)
        .order_by(func.lower(Workout.title).asc())
    ).all()

    return [r[0] for r in rows if r[0]]
