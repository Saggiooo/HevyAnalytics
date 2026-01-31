from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Exercise, Muscle, Equipment
from app.schemas import ExerciseOut, ExerciseUpdateIn

router = APIRouter(prefix="/api/exercises", tags=["exercises"])

@router.get("", response_model=list[ExerciseOut])
def list_exercises(db: Session = Depends(get_db)):
    rows = (
        db.query(Exercise)
        .options(selectinload(Exercise.muscles), selectinload(Exercise.equipment))
        .order_by(Exercise.exercise_title.asc())
        .all()
    )
    out = []
    for e in rows:
        out.append({
            "id": e.id,
            "exercise_title": e.exercise_title,
            "exercise_template_id": e.exercise_template_id,
            "muscles": [m.name for m in e.muscles],
            "equipment": [x.name for x in e.equipment],
        })
    return out

@router.patch("/{exercise_id}", response_model=ExerciseOut)
def update_exercise(exercise_id: int, payload: ExerciseUpdateIn, db: Session = Depends(get_db)):
    ex = (
        db.query(Exercise)
        .options(selectinload(Exercise.muscles), selectinload(Exercise.equipment))
        .get(exercise_id)
    )
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")

    if payload.muscles is not None:
        muscles = []
        for name in payload.muscles:
            name = name.strip().lower()
            if not name:
                continue
            m = db.query(Muscle).filter(Muscle.name == name).first()
            if not m:
                m = Muscle(name=name)
                db.add(m)
                db.flush()
            muscles.append(m)
        ex.muscles = muscles

    if payload.equipment is not None:
        equipment = []
        for name in payload.equipment:
            name = name.strip().lower()
            if not name:
                continue
            eq = db.query(Equipment).filter(Equipment.name == name).first()
            if not eq:
                eq = Equipment(name=name)
                db.add(eq)
                db.flush()
            equipment.append(eq)
        ex.equipment = equipment

    db.add(ex)
    db.commit()
    db.refresh(ex)

    return {
        "id": ex.id,
        "exercise_title": ex.exercise_title,
        "exercise_template_id": ex.exercise_template_id,
        "muscles": [m.name for m in ex.muscles],
        "equipment": [x.name for x in ex.equipment],
    }