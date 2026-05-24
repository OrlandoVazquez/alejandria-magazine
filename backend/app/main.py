from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
# Import models to ensure they are registered on Base.metadata
from app import models
from app.routers import auth, articles, ai, agents


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    await init_db()
    yield


app = FastAPI(title="AlexandrIA Magazine API", version="0.1.0", lifespan=lifespan)

# Permitir llamadas desde el frontend en desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(ai.router)
app.include_router(agents.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "alexandria_backend"}