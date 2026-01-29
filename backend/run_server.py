import os
from pathlib import Path

import uvicorn

# Carica .env se presente (in dev e anche se il binario è dentro dist/)
def load_dotenv_if_present():
    try:
        from dotenv import load_dotenv  # python-dotenv
    except Exception:
        return

    # Cerca .env in: cwd, cartella del binario, e parent (utile con dist/)
    candidates = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent.parent / ".env",
    ]
    for p in candidates:
        if p.exists():
            load_dotenv(p)
            break

load_dotenv_if_present()

# IMPORT STATICO (evita magagne PyInstaller)
from app.main import app  # noqa: E402

def main():
    host = os.getenv("HEVY_HOST", "127.0.0.1")
    port = int(os.getenv("HEVY_PORT", "8000"))

    # hard fail se manca DATABASE_URL, così non impazzisci
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL mancante. Passala come variabile d'ambiente "
            "oppure metti un file .env vicino all'eseguibile."
        )

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )

if __name__ == "__main__":
    main()
