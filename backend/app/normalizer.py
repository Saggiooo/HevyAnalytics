from datetime import datetime
from typing import Any, Optional

def pick(obj: dict, keys: list[str]) -> Any:
    for k in keys:
        if k in obj and obj[k] is not None:
            return obj[k]
    return None

def iso_to_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except Exception:
        return None

def workout_duration_seconds(w: dict) -> Optional[int]:
    s = iso_to_dt(w.get("start_time"))
    e = iso_to_dt(w.get("end_time"))
    if s and e:
        sec = int((e - s).total_seconds())
        return max(0, sec)
    return None
