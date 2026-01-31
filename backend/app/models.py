from sqlalchemy import (
    Column, String, Integer, DateTime, Boolean, ForeignKey, Text, Float, UniqueConstraint, BigInteger, SmallInteger, Table
)
from sqlalchemy.orm import relationship
from app.db import Base

# --- association tables ---
exercise_muscles = Table(
    "exercise_muscles",
    Base.metadata,
    Column("exercise_id", BigInteger, ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True),
    Column("muscle_id", SmallInteger, ForeignKey("muscles.id", ondelete="CASCADE"), primary_key=True),
)

exercise_equipment = Table(
    "exercise_equipment",
    Base.metadata,
    Column("exercise_id", BigInteger, ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True),
    Column("equipment_id", SmallInteger, ForeignKey("equipment.id", ondelete="CASCADE"), primary_key=True),
)

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    exercise_title = Column(String(255), nullable=False)
    exercise_template_id = Column(String(64), nullable=True, unique=True, index=True)

    muscles = relationship("Muscle", secondary=exercise_muscles, back_populates="exercises", lazy="selectin")
    equipment = relationship("Equipment", secondary=exercise_equipment, back_populates="exercises", lazy="selectin")


class Muscle(Base):
    __tablename__ = "muscles"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False, unique=True)

    exercises = relationship("Exercise", secondary=exercise_muscles, back_populates="muscles", lazy="selectin")


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False, unique=True)

    exercises = relationship("Exercise", secondary=exercise_equipment, back_populates="equipment", lazy="selectin")

class WorkoutType(Base):
    __tablename__ = "workout_types"
    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False)

class Workout(Base):
    __tablename__ = "workouts"
    id = Column(String(64), primary_key=True)  # workout_id/uuid
    title = Column(String(255), nullable=False, default="")
    date = Column(DateTime, nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    ignored = Column(Boolean, nullable=False, default=False)
    raw_json = Column(Text, nullable=True)

    type_id = Column(Integer, ForeignKey("workout_types.id"), nullable=True)
    type = relationship("WorkoutType")

class ExerciseSet(Base):
    __tablename__ = "exercise_sets"
    id = Column(Integer, primary_key=True, autoincrement=True)

    workout_id = Column(String(64), ForeignKey("workouts.id"), nullable=False, index=True)
    exercise_title = Column(String(255), nullable=False, default="")
    exercise_template_id = Column(String(64), nullable=True, index=True)
    set_index = Column(Integer, nullable=False)
    reps = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    distance = Column(Float, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    set_type = Column(String(64), nullable=True)
    raw_json = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("workout_id", "exercise_template_id", "set_index", name="uq_set_key"),
    )

class SyncState(Base):
    __tablename__ = "sync_state"
    id = Column(Integer, primary_key=True, default=1)
    last_sync_ts = Column(DateTime, nullable=True)
