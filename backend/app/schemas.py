from pydantic import BaseModel
from datetime import datetime


class DashboardTopExerciseRow(BaseModel):
    exercise_title: str
    volume_kg: float

#non serve più DashboardMonthRow(BaseModel):
class DashboardMonthRow(BaseModel):
    month: int  # 1..12
    workout_count: int
    volume_kg: float


class DashboardSummaryOut(BaseModel):
    year: int

    # Top cards
    workouts_count: int
    training_days: int
    total_volume_kg: float
    unique_exercises: int
    pr_count: int = 0

    # Charts (Jan..Dec)
    workouts_by_month: list[int] = []
    volume_by_month: list[float] = []
    top_exercises_by_volume: list[DashboardTopExerciseRow] = []
    class Config:
        from_attributes = True
    

class RecordRow(BaseModel):
    exercise_title: str
    metric: str  # es: "max_weight", "e1rm", "max_weight_at_reps"
    value: float
    reps: int | None = None
    date: datetime | None = None
    workout_id: str | None = None
    workout_title: str | None = None
    exercise_template_id: str | None = None

    class Config:
        from_attributes = True
# --- Workouts (summary) ---
class WorkoutOut(BaseModel):
    id: str
    title: str
    date: datetime
    duration_seconds: int | None = None
    ignored: bool
    type_id: int | None = None

    # aggregati calcolati dal DB
    exercises_count: int = 0
    sets_count: int = 0
    volume_kg: float = 0.0

    class Config:
        from_attributes = True


# --- Workout Types ---
class WorkoutTypeOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class AssignWorkoutTypeIn(BaseModel):
    workout_id: str
    type_id: int | None = None


# --- Sets / Detail ---
class ExerciseSetOut(BaseModel):
    workout_id: str
    exercise_title: str
    exercise_template_id: str | None = None
    set_index: int | None = None
    reps: int | None = None
    weight_kg: float | None = None
    distance_meters: float | None = None
    duration_seconds: int | None = None
    set_type: str | None = None

    class Config:
        from_attributes = True


class WorkoutDetailOut(WorkoutOut):
    sets: list[ExerciseSetOut] = []
