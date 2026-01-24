from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.config import HEVY_BASE_URL, DEFAULT_PAGE_SIZE, SYNC_COOLDOWN_SECONDS
from app.hevy_client import HevyClient
from app.models import Workout, ExerciseSet, SyncState
from app.normalizer import pick, iso_to_dt, workout_duration_seconds


async def ensure_synced(db: Session) -> None:
    """
    Sync con cooldown: se hai syncato "da poco" non riscarica tutto.
    """
    state = db.get(SyncState, 1)
    now = datetime.now(timezone.utc)

    if not state:
        state = SyncState(id=1, last_sync_ts=None)
        db.add(state)
        db.commit()
        db.refresh(state)

    if state.last_sync_ts:
        last = state.last_sync_ts
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if (now - last).total_seconds() < SYNC_COOLDOWN_SECONDS:
            return

    client = HevyClient(HEVY_BASE_URL)
    await full_sync(db, client)

    state.last_sync_ts = now
    db.commit()


async def full_sync(db: Session, client: HevyClient) -> None:
    page = 1
    page_count = 1

    while page <= page_count:
        data = await client.get("/v1/workouts", {"page": page, "pageSize": DEFAULT_PAGE_SIZE})
        page_count = int(data.get("page_count") or data.get("pageCount") or 1)
        workouts = data.get("workouts") or []

        for w in workouts:
            workout_id = pick(w, ["id", "workout_id", "uuid"])
            if not workout_id:
                continue
            workout_id = str(workout_id)

            title = pick(w, ["title", "name"]) or ""
            start_time = iso_to_dt(w.get("start_time"))
            end_time = iso_to_dt(w.get("end_time"))
            date = iso_to_dt(pick(w, ["start_time", "startTime", "date", "performed_at", "created_at"])) or end_time
            dur = workout_duration_seconds(w)

            existing = db.get(Workout, workout_id)
            if not existing:
                existing = Workout(id=workout_id)

            existing.title = title
            existing.start_time = start_time
            existing.end_time = end_time
            existing.date = date
            existing.duration_seconds = dur
            existing.raw_json = json.dumps(w, ensure_ascii=False)

            db.add(existing)
            db.flush()

            exercises = pick(w, ["exercises", "items", "workout_exercises"]) or []
            for ex in exercises:
                ex_title = pick(ex, ["title", "name", "exercise_title"]) or ""
                template_id = pick(ex, ["exercise_template_id", "exerciseTemplateId", "template_id", "exercise_id"])
                template_id = str(template_id) if template_id else None

                sets = pick(ex, ["sets", "exercise_sets"]) or []
                for idx, s in enumerate(sets):
                    reps = _to_int(pick(s, ["reps", "rep_count", "repetitions"]))
                    weight = _to_float(pick(s, ["weight_kg", "weightKg", "weight", "kg"]))
                    distance = _to_float(pick(s, ["distance", "distance_m", "meters"]))
                    dur_s = _to_int(pick(s, ["duration_seconds", "durationSeconds", "seconds", "duration"]))
                    set_type = pick(s, ["type", "set_type", "kind"])

                    row = ExerciseSet(
                        workout_id=workout_id,
                        exercise_title=ex_title,
                        exercise_template_id=template_id,
                        set_index=idx + 1,
                        reps=reps,
                        weight_kg=weight,
                        distance=distance,
                        duration_seconds=dur_s,
                        set_type=str(set_type) if set_type else None,
                        raw_json=json.dumps(s, ensure_ascii=False),
                    )

                    # Inserimento semplice: se duplica (uq_set_key) ignora
                    try:
                        db.add(row)
                        db.flush()
                    except Exception:
                        db.rollback()

        db.commit()
        page += 1


def _to_int(v: Optional[object]) -> Optional[int]:
    try:
        if v is None or v == "":
            return None
        return int(float(v))
    except Exception:
        return None


def _to_float(v: Optional[object]) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None
