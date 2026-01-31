from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, smoke
from app.routers import sync
from app.routers import exercises
from app.routers.exercise_detail import router as exercise_detail_router




from app.routers import workouts, ignored, records, dashboard, analysis
from app.db import init_db

app = FastAPI(title="Hevy Analytics API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

app.include_router(workouts.router, prefix="/api", tags=["workouts"])
app.include_router(ignored.router, prefix="/api", tags=["ignored"])
app.include_router(records.router, prefix="/api", tags=["records"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(health.router)
app.include_router(smoke.router)
app.include_router(sync.router)
app.include_router(exercises.router)
app.include_router(analysis.router)
app.include_router(exercise_detail_router)

@app.get("/health")
def health():
    return {"ok": True}

