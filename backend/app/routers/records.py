from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from app.db import get_db
from app.models import ExerciseSet, Workout
from app.schemas import RecordRow
from app.sync_service import ensure_synced

router = APIRouter()

def epley_e1rm(weight: float, reps: int) -> float:
    # Epley: 1RM = w * (1 + reps/30)
    return weight * (1.0 + (reps / 30.0))

@router.get("/records", response_model=list[RecordRow])
async def records(
    metric: str = Query(default="max_weight"),  # max_weight | e1rm | max_weight_at_reps
    reps: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    await ensure_synced(db)

    # base: join sets->workout and exclude ignored
    base = (
        select(
            ExerciseSet.exercise_title,
            ExerciseSet.exercise_template_id,
            ExerciseSet.weight_kg,
            ExerciseSet.reps,
            Workout.id.label("workout_id"),
            Workout.title.label("workout_title"),
            Workout.date.label("workout_date"),
        )
        .join(Workout, Workout.id == ExerciseSet.workout_id)
        .where(Workout.ignored == False)  # noqa
        .where(ExerciseSet.weight_kg.isnot(None))
        .where(ExerciseSet.weight_kg > 0)
    )

    rows = db.execute(base).all()

    best = {}
    for r in rows:
        title = r.exercise_title or ""
        key = (r.exercise_template_id or title.strip().lower() or "unknown")

        w = float(r.weight_kg or 0)
        rep = int(r.reps) if r.reps is not None else None
        e1 = epley_e1rm(w, rep) if rep and rep > 0 else None

        if metric == "max_weight_at_reps":
            if reps is None:
                continue
            if rep != reps:
                continue
            score = w
        elif metric == "e1rm":
            if e1 is None:
                continue
            score = e1
        else:
            score = w

        curr = best.get(key)
        if not curr or score > curr["score"]:
            best[key] = {
                "score": score,
                "exercise_title": title,
                "exercise_template_id": r.exercise_template_id,
                "weight_kg": w,
                "reps": rep,
                "e1rm": e1,
                "workout_id": r.workout_id,
                "workout_title": r.workout_title,
                "workout_date": r.workout_date,
            }

    out = [RecordRow(**v) for v in best.values()]
    # ordina “più forte prima” in base a metric
    out.sort(key=lambda x: (x.e1rm if metric == "e1rm" else x.weight_kg), reverse=True)
    return out
