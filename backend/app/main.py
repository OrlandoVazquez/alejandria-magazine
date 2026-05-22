from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database import init_db, close_db
from app.routers import auth, articles, ai

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Event handlers
@app.on_event("startup")
async def startup():
    """Ejecutar al iniciar la app."""
    await init_db()

@app.on_event("shutdown")
async def shutdown():
    """Ejecutar al cerrar la app."""
    await close_db()

# Rutas
app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(ai.router)

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": settings.VERSION}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": settings.VERSION}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
