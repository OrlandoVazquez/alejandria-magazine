from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Base para todos los modelos ORM
Base = declarative_base()

# Motor async
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

# Factory para sesiones
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)


async def get_session() -> AsyncSession:
    """Dependency para obtener la sesión de BD."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Crear todas las tablas."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Cerrar el engine."""
    await engine.dispose()
