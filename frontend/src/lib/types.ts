export type Workout = {
  id: string;
  title: string;
  date: string | null;
  ignored: boolean;
  type_id: number | null;
};

export type DashboardSummary = {
  year: number;
  workouts: number;
  days_trained: number;
  total_volume_kg: number;
  unique_exercises: number;
  volume_by_month: { month: number; volume_kg: number }[];
  top_exercises_by_volume: { title: string; volume_kg: number }[];
};
