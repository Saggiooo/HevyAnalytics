from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.db import get_db
from app.models import Exercise, ExerciseSet, Workout

router = APIRouter(prefix="/api/exercises", tags=["exercises"])

def _parse_date(s: str) -> datetime:
    try:
        # accetta YYYY-MM-DD
        return datetime.fromisoformat(s)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date: {s}. Use YYYY-MM-DD")

@router.get("/{template_id}/progress")
def exercise_progress(
    template_id: str,
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    dt_from = _parse_date(from_)
    dt_to = _parse_date(to)

    ex = (
        db.query(Exercise)
        .filter(Exercise.exercise_template_id == template_id)
        .first()
    )
    if not ex:
        # non blocchiamo se non esiste in exercises table: proviamo comunque dal sets
        ex_title = None
    else:
        ex_title = ex.exercise_title

    # workouts in range (ignora se vuoi includere anche ignored -> decidi tu)
    # io qui li includo TUTTI, poi se vuoi escludere gli ignored basta aggiungere Workout.ignored == False
    base_filter = and_(
        ExerciseSet.exercise_template_id == template_id,
        Workout.id == ExerciseSet.workout_id,
        Workout.date.isnot(None),
        Workout.date >= dt_from,
        Workout.date <= dt_to,
    )

    # (A) box: total sets
    total_sets = (
        db.query(func.count(ExerciseSet.id))
        .join(Workout, Workout.id == ExerciseSet.workout_id)
        .filter(base_filter)
        .scalar()
        or 0
    )

    # (B) box: workouts count
    workouts_count = (
        db.query(func.count(func.distinct(ExerciseSet.workout_id)))
        .join(Workout, Workout.id == ExerciseSet.workout_id)
        .filter(base_filter)
        .scalar()
        or 0
    )

    # (C) progress: prendo la serie con il PESO MASSIMO per ogni workout
    # Se a pari peso ci sono più set, prendo quello con più reps; se ancora pari, quello col set_index più alto.

    # 1) max peso per workout
    sub_max_w = (
        db.query(
            ExerciseSet.workout_id.label("workout_id"),
            func.max(ExerciseSet.weight_kg).label("max_w"),
        )
        .join(Workout, Workout.id == ExerciseSet.workout_id)
        .filter(base_filter)
        .filter(ExerciseSet.weight_kg.isnot(None))
        .group_by(ExerciseSet.workout_id)
        .subquery()
    )

    # 2) tra i set col max peso, max reps per workout
    sub_max_r = (
        db.query(
            ExerciseSet.workout_id.label("workout_id"),
            func.max(ExerciseSet.reps).label("max_r"),
        )
        .join(Workout, Workout.id == ExerciseSet.workout_id)
        .join(
            sub_max_w,
            and_(
                sub_max_w.c.workout_id == ExerciseSet.workout_id,
                sub_max_w.c.max_w == ExerciseSet.weight_kg,
            ),
        )
        .filter(base_filter)
        .group_by(ExerciseSet.workout_id)
        .subquery()
    )

    # 3) a pari (max peso, max reps), max set_index per workout
    sub_max_idx = (
        db.query(
            ExerciseSet.workout_id.label("workout_id"),
            func.max(ExerciseSet.set_index).label("max_idx"),
        )
        .join(Workout, Workout.id == ExerciseSet.workout_id)
        .join(
            sub_max_w,
            and_(
                sub_max_w.c.workout_id == ExerciseSet.workout_id,
                sub_max_w.c.max_w == ExerciseSet.weight_kg,
            ),
        )
        .join(
            sub_max_r,
            and_(
                sub_max_r.c.workout_id == ExerciseSet.workout_id,
                sub_max_r.c.max_r == ExerciseSet.reps,
            ),
        )
        .filter(base_filter)
        .group_by(ExerciseSet.workout_id)
        .subquery()
    )

    rows = (
        db.query(
            Workout.date.label("date"),
            ExerciseSet.workout_id.label("workout_id"),
            ExerciseSet.weight_kg.label("weight_kg"),
            ExerciseSet.reps.label("reps"),
            ExerciseSet.set_index.label("set_index"),
            ExerciseSet.exercise_title.label("exercise_title"),
        )
        .join(
            sub_max_w,
            and_(
                sub_max_w.c.workout_id == ExerciseSet.workout_id,
                sub_max_w.c.max_w == ExerciseSet.weight_kg,
            ),
        )
        .join(
            sub_max_r,
            and_(
                sub_max_r.c.workout_id == ExerciseSet.workout_id,
                sub_max_r.c.max_r == ExerciseSet.reps,
            ),
        )
        .join(
            sub_max_idx,
            and_(
                sub_max_idx.c.workout_id == ExerciseSet.workout_id,
                sub_max_idx.c.max_idx == ExerciseSet.set_index,
            ),
        )
        .join(Workout, Workout.id == ExerciseSet.workout_id)
        .filter(ExerciseSet.exercise_template_id == template_id)
        .filter(Workout.date.isnot(None), Workout.date >= dt_from, Workout.date <= dt_to)
        .order_by(Workout.date.asc())
        .all()
    )

    series: List[Dict[str, Any]] = []
    for r in rows:
        series.append({
            "date": r.date.isoformat() if r.date else None,
            "workout_id": r.workout_id,
            "weight_kg": float(r.weight_kg) if r.weight_kg is not None else None,
            "reps": int(r.reps) if r.reps is not None else None,
            "set_index": int(r.set_index) if r.set_index is not None else None,
        })
        if not ex_title and r.exercise_title:
            ex_title = r.exercise_title

    return {
        "exercise_template_id": template_id,
        "exercise_title": ex_title or "Senza nome",
        "from": from_,
        "to": to,
        "summary": {
            "total_sets": total_sets,
            "workouts_count": workouts_count,
        },
        "series": series,
    }