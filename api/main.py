from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import settings
from api.database import init_db
from api.routers import carrier, loads, negotiate, calls, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Carrier Sales API",
    description="Backend for HappyRobot inbound carrier sales automation",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(carrier.router)
app.include_router(loads.router)
app.include_router(negotiate.router)
app.include_router(calls.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
