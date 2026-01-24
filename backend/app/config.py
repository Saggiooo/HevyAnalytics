import os
from dotenv import load_dotenv

from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "")
HEVY_API_KEY = os.getenv("HEVY_API_KEY", "")
TZ = os.getenv("TZ", "Europe/Rome")
SYNC_COOLDOWN_SECONDS = int(os.getenv("SYNC_COOLDOWN_SECONDS", "300"))

HEVY_API_KEY = os.getenv("HEVY_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
TZ = os.getenv("TZ", "Europe/Rome")
SYNC_COOLDOWN_SECONDS = int(os.getenv("SYNC_COOLDOWN_SECONDS", "300"))
HEVY_BASE_URL = "https://api.hevyapp.com"
DEFAULT_PAGE_SIZE = 10
