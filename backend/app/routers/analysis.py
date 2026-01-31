# backend/app/routers/analysis.py
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Workout, ExerciseSet, Exercise, Muscle, exercise_muscles

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _day_bounds(d: date):
    start = datetime(d.year, d.month, d.day, 0, 0, 0)
    end = start + timedelta(days=1)
    return start, end


def _range_bounds(d_from: date, d_to: date):
    # inclusivo su d_to: facciamo < end_of_day+1
    start = datetime(d_from.year, d_from.month, d_from.day, 0, 0, 0)
    end = datetime(d_to.year, d_to.month, d_to.day, 0, 0, 0) + timedelta(days=1)
    return start, end


def _group_for_radar(muscle: str) -> str:
    m = muscle.lower().strip()

    if m == "petto":
        return "petto"
    if m == "schiena":
        return "schiena"
    if m == "spalle":
        return "spalle"
    if m == "addome":
        return "addome"

    # BRACCIA
    if m in {"bicipiti", "tricipiti", "avambracci"}:
        return "braccia"

    # GAMBE
    if m in {"quadricipiti", "femorali", "glutei", "polpacci"}:
        return "gambe"

    # se arriva roba non prevista, ignoriamo
    return "altro"


def _default_radar_dict() -> Dict[str, int]:
    return {
        "petto": 0,
        "schiena": 0,
        "spalle": 0,
        "braccia": 0,
        "addome": 0,
        "gambe": 0,
    }


def _compute_counts(db: Session, start_dt: datetime, end_dt: datetime) -> Dict[str, Any]:
    """\
    Conta i muscoli allenati (per workout) nel range [start_dt, end_dt).

    Logica:
    - prendo i workout non ignorati nel range
    - collego i set -> esercizio (per exercise_template_id)
    - collego l'esercizio ai muscoli via association table exercise_muscles
    - aggrego per workout (un muscolo conta max 1 volta per workout)

    Nota: se un esercizio non ha muscoli assegnati, non contribuisce.
    """

    q = (
        select(
            Workout.id,
            Muscle.name,
        )
        .select_from(Workout)
        .join(ExerciseSet, ExerciseSet.workout_id == Workout.id)
        .join(
            Exercise,
            Exercise.exercise_template_id == ExerciseSet.exercise_template_id,
        )
        .join(
            exercise_muscles,
            exercise_muscles.c.exercise_id == Exercise.id,
        )
        .join(
            Muscle,
            Muscle.id == exercise_muscles.c.muscle_id,
        )
        .where(
            and_(
                Workout.date.is_not(None),
                Workout.date >= start_dt,
                Workout.date < end_dt,
                (Workout.ignored == False),  # noqa: E712
                ExerciseSet.exercise_template_id.is_not(None),
                Muscle.name.is_not(None),
            )
        )
    )

    rows = db.execute(q).all()

    # workout_id -> set(muscles)
    per_workout: Dict[str, set[str]] = {}

    for workout_id, muscle_name in rows:
        if not muscle_name:
            continue
        m = str(muscle_name).strip().lower()
        if not m:
            continue

        s = per_workout.get(workout_id)
        if s is None:
            s = set()
            per_workout[workout_id] = s
        s.add(m)

    muscle_counts: Dict[str, int] = {}
    radar = _default_radar_dict()

    for mset in per_workout.values():
        for m in mset:
            muscle_counts[m] = muscle_counts.get(m, 0) + 1
            grp = _group_for_radar(m)
            if grp in radar:
                radar[grp] += 1

    return {
        "muscle_counts": muscle_counts,
        "radar": radar,
        "workouts_count": len(per_workout),
    }


@router.get("/summary")
def analysis_summary(
    db: Session = Depends(get_db),
    d_from: date = Query(..., alias="from"),
    d_to: date = Query(..., alias="to"),
):
    # range attuale
    start_dt, end_dt = _range_bounds(d_from, d_to)

    # range precedente: stesso numero di giorni, subito prima del from
    days = (d_to - d_from).days + 1
    prev_to = d_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=days - 1)
    prev_start_dt, prev_end_dt = _range_bounds(prev_from, prev_to)

    cur = _compute_counts(db, start_dt, end_dt)
    prev = _compute_counts(db, prev_start_dt, prev_end_dt)

    return {
        "from": str(d_from),
        "to": str(d_to),
        "previous_from": str(prev_from),
        "previous_to": str(prev_to),
        "muscle_counts": cur["muscle_counts"],
        "radar": {
            "attuale": cur["radar"],
            "precedente": prev["radar"],
        },
        "meta": {
            "workouts_attuale": cur["workouts_count"],
            "workouts_precedente": prev["workouts_count"],
        },
    }