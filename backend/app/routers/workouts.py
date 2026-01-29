from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from app.db import get_db
from app.models import Workout, ExerciseSet  # <-- se il nome è diverso, cambia qui
from app.schemas import WorkoutOut, WorkoutDetailOut, ExerciseSetOut  # <-- li creiamo sotto
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
            id=w.id,
            title=w.title,
            date=w.date,
            duration_seconds=w.duration_seconds,
            ignored=bool(w.ignored),
            type_id=w.type_id,
        )
        for w in rows
    ]


@router.get("/workouts/{workout_id}", response_model=WorkoutDetailOut)
async def get_workout_detail(
    workout_id: str,
    db: Session = Depends(get_db),
):
    # opzionale: non serve sync sempre, ma utile se vuoi che un id appena arrivato sia disponibile
    await ensure_synced(db)

    w = db.execute(select(Workout).where(Workout.id == workout_id)).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")

    sets_stmt = (
        select(ExerciseSet)
        .where(ExerciseSet.workout_id == workout_id)
        .order_by(ExerciseSet.exercise_title.asc(), ExerciseSet.set_index.asc())
    )
    sets_rows = db.execute(sets_stmt).scalars().all()

    return WorkoutDetailOut(
        id=w.id,
        title=w.title,
        date=w.date,
        duration_seconds=w.duration_seconds,
        ignored=bool(w.ignored),
        type_id=w.type_id,
        sets=[
            ExerciseSetOut(
                workout_id=s.workout_id,
                exercise_title=s.exercise_title,
                exercise_template_id=s.exercise_template_id,
                set_index=s.set_index,
                reps=s.reps,
                weight_kg=float(s.weight_kg or 0),
                distance_meters=float(s.distance_meters or 0),
                duration_seconds=int(s.duration_seconds or 0),
                set_type=s.set_type,
            )
            for s in sets_rows
        ],
    )
