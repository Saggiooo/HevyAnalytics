from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class WorkoutOut(BaseModel):
    id: str
    title: str
    date: Optional[datetime]
    duration_seconds: Optional[int]
    ignored: bool
    type_id: Optional[int]

class WorkoutTypeOut(BaseModel):
    id: int
    name: str

class AssignWorkoutTypeIn(BaseModel):
    workout_id: str
    type_id: Optional[int]  # null = remove assignment

class RecordRow(BaseModel):
    exercise_title: str
    exercise_template_id: Optional[str]
    weight_kg: float
    reps: Optional[int]
    e1rm: Optional[float]
    workout_id: str
    workout_title: str
    workout_date: Optional[datetime]

class DashboardSummaryOut(BaseModel):
    year: int
    workouts_count: int
    training_days: int
    total_volume_kg: float
    unique_exercises: int
    pr_count: int
    volume_by_month: List[float]  # 12 values
    workouts_by_month: List[int]  # 12 values
