from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.database import init_db
from core.scheduler import start_scheduler, shutdown_scheduler
from routers import tasks, logs, points, rewards, auth, analytics, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    shutdown_scheduler()

app = FastAPI(title="FamBoard API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(tasks.router,     prefix="/api/tasks",     tags=["tasks"])
app.include_router(logs.router,      prefix="/api/logs",      tags=["logs"])
app.include_router(points.router,    prefix="/api/points",    tags=["points"])
app.include_router(rewards.router,   prefix="/api/rewards",   tags=["rewards"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(admin.router,     prefix="/api/admin",     tags=["admin"])

@app.get("/api/health")
def health():
    return {"status": "ok"}
