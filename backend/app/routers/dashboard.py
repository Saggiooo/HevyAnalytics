from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from app.db import get_db
from app.models import Workout, ExerciseSet
from app.schemas import DashboardSummaryOut
from app.sync_service import ensure_synced

router = APIRouter()

@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(year: int = Query(...), db: Session = Depends(get_db)):
    await ensure_synced(db)

    start = datetime(year, 1, 1)
    end = datetime(year + 1, 1, 1)

    workouts = db.execute(
        select(Workout).where(
            Workout.ignored == False,  # noqa
            Workout.date >= start,
            Workout.date < end,
        )
    ).scalars().all()

    workouts_count = len(workouts)
    training_days = len({(w.date.date() if w.date else None) for w in workouts if w.date})

    # Sets in range, non ignored
    sets = db.execute(
        select(ExerciseSet, Workout).join(Workout, Workout.id == ExerciseSet.workout_id).where(
            Workout.ignored == False,  # noqa
            Workout.date >= start,
            Workout.date < end,
        )
    ).all()

    total_volume = 0.0
    ex_names = set()
    volume_by_month = [0.0] * 12
    workouts_by_month = [0] * 12

    for w in workouts:
        if w.date:
            workouts_by_month[w.date.month - 1] += 1

    for s, w in sets:
        if s.weight_kg and s.reps:
            v = float(s.weight_kg) * int(s.reps)
            total_volume += v
            if w.date:
                volume_by_month[w.date.month - 1] += v
        if s.exercise_title:
            ex_names.add(s.exercise_title.strip().lower())

    # PR count: placeholder "numero record" calcolato lato client o con endpoint ad hoc
    pr_count = 0

    return DashboardSummaryOut(
        year=year,
        workouts_count=workouts_count,
        training_days=training_days,
        total_volume_kg=round(total_volume, 2),
        unique_exercises=len(ex_names),
        pr_count=pr_count,
        volume_by_month=[round(x, 2) for x in volume_by_month],
        workouts_by_month=workouts_by_month,
    )
