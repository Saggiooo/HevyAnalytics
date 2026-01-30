from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

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
    year: int | None = Query(default=None),
    metric: str = Query(default="max_weight"),  # max_weight | e1rm | max_weight_at_reps
    reps: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    await ensure_synced(db)

    # Base query: join sets -> workout, exclude ignored, keep only valid weights
    stmt = (
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

    # Optional filter by year
    if year is not None:
        start = datetime(year, 1, 1)
        end = datetime(year + 1, 1, 1)
        stmt = stmt.where(Workout.date >= start, Workout.date < end)

    rows = db.execute(stmt).all()

    # Pick best per exercise (template_id preferred, else normalized title)
    best: dict[str, dict] = {}

    for r in rows:
        title = (r.exercise_title or "").strip()
        key = (r.exercise_template_id or title.lower() or "unknown")

        w = float(r.weight_kg or 0.0)
        rep = int(r.reps) if r.reps is not None else None

        # Score selection
        if metric == "max_weight_at_reps":
            # only include exact reps if provided
            if reps is None or rep is None or rep != reps:
                continue
            score = w
        elif metric == "e1rm":
            if rep is None or rep <= 0:
                continue
            score = epley_e1rm(w, rep)
        else:
            # default: max_weight
            score = w

        curr = best.get(key)
        if curr is None or score > float(curr["value"]):
            best[key] = {
                # REQUIRED by RecordRow
                "exercise_title": title or "Unknown",
                "metric": metric,
                "value": float(score),
                # optional fields
                "reps": rep,
                "date": r.workout_date,
                "workout_id": r.workout_id,
                "workout_title": r.workout_title,
                "exercise_template_id": r.exercise_template_id,
            }

    out = [RecordRow(**v) for v in best.values()]

    # Sort by "value" desc (works for all metrics because value = chosen score)
    out.sort(key=lambda x: (x.value or 0.0), reverse=True)
    return out