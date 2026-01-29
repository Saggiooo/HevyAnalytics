

export type DashboardSummary = {
  year: number;
  workouts: number;
  days_trained: number;
  total_volume_kg: number;
  unique_exercises: number;
  volume_by_month: { month: number; volume_kg: number }[];
  top_exercises_by_volume: { title: string; volume_kg: number }[];
  workouts_count: number;
  training_days: number;
  workouts_by_month: number[]; // tipicamente 12 valori
};

export type WorkoutType = {
  id: number;
  name: string; // "Allenamento A"
};

export type WorkoutSet = {
  exercise_title: string;
  exercise_template_id?: string | null;
  set_index: number;
  reps?: number | null;
  weight_kg?: number | null;
};

export type Workout = {
  id: string;
  title: string;
  date: string; // ISO
  duration_seconds?: number | null;
  ignored: boolean;
  type_id?: number | null;

  // se il backend li include:
  sets?: WorkoutSet[];
};
