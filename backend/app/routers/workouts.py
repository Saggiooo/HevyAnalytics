from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from app.db import get_db
from app.models import Workout, ExerciseSet
from app.schemas import WorkoutOut, WorkoutDetailOut, ExerciseSetOut
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

    workout_ids = [w.id for w in rows]
    agg_by_workout: dict[str, dict[str, float | int]] = {wid: {"sets": 0, "volume": 0.0, "exercises": 0} for wid in workout_ids}

    if workout_ids:
        seen_exercises: dict[str, set[str]] = {wid: set() for wid in workout_ids}

        sets_full = db.execute(
            select(
                ExerciseSet.workout_id,
                ExerciseSet.exercise_title,
                ExerciseSet.weight_kg,
                ExerciseSet.reps,
            ).where(ExerciseSet.workout_id.in_(workout_ids))
        ).all()

        for wid, title, weight, reps in sets_full:
            agg_by_workout[wid]["sets"] += 1
            if title:
                seen_exercises[wid].add(title)
            w = float(weight or 0)
            r = int(reps or 0)
            agg_by_workout[wid]["volume"] += w * r

        for wid in workout_ids:
            agg_by_workout[wid]["exercises"] = len(seen_exercises[wid])

    return [
        WorkoutOut(
            id=w.id,
            title=w.title,
            date=w.date,
            duration_seconds=w.duration_seconds,
            ignored=bool(w.ignored),
            type_id=w.type_id,
            exercises_count=int(agg_by_workout[w.id]["exercises"]) if w.id in agg_by_workout else 0,
            sets_count=int(agg_by_workout[w.id]["sets"]) if w.id in agg_by_workout else 0,
            volume_kg=float(agg_by_workout[w.id]["volume"]) if w.id in agg_by_workout else 0.0,
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
