# Backend — Arquitectura Hexagonal

## Estructura del proyecto

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app factory
│   ├── core/
│   │   ├── config.py              # Configuración (pydantic-settings)
│   │   └── security.py            # JWT, hashing, tokens
│   ├── shared/
│   │   └── database.py            # SQLAlchemy async, migrations
│   └── modules/
│       ├── auth/
│       │   ├── domain/            # Entidades (User, UserRole)
│       │   ├── application/       # Use cases, DTOs, Ports
│       │   └── adapters/          # HTTP (routers), Persistence (ORM + Repo)
│       ├── articles/
│       │   ├── domain/            # Entidades (Article, ArticleStatus)
│       │   ├── application/       # Use cases, DTOs, Ports
│       │   └── adapters/          # HTTP (routers), Persistence (ORM + Repo)
│       └── ai/                    # (Por implementar)
├── alembic/
│   ├── env.py                     # Configuración de migraciones
│   ├── script.py.mako             # Template para migraciones
│   └── versions/                  # Migraciones generadas
├── requirements.txt               # Dependencias Python
├── Dockerfile                     # Imagen Docker
├── .env.example                   # Variables de entorno
├── .gitignore                     # Archivos ignorados por Git
└── README.md                      # Este archivo
```

## Principios de arquitectura

### 1. **Hexagonal (Ports & Adapters)**

La dependencia siempre va desde afuera hacia adentro:

```
Adaptadores (HTTP, BD) → Application → Domain
```

- **Domain**: Lógica pura, sin dependencias externas
- **Application**: Use cases, DTOs, Ports (interfaces)
- **Adapters**: Implementaciones concretas (FastAPI, SQLAlchemy)

### 2. **Por módulo**

Cada módulo (Auth, Articles, AI) es independiente y autosuficiente:
- Su propia lógica de dominio
- Sus propios casos de uso
- Sus propias interfaces (ports)
- Sus propias implementaciones (adapters)

### 3. **Inyección de dependencias**

Los repositorios se inyectan en los casos de uso, no se importan directamente. Ejemplo:

```python
class LoginUseCase:
    def __init__(self, user_repository: IUserRepository):
        self.user_repository = user_repository  # Inyectado
```

## Endpoints básicos (Fase 1)

### Auth
- `POST /api/v1/auth/register` → Registrar usuario
- `POST /api/v1/auth/login` → Login (tokens JWT)
- `GET /api/v1/auth/me` → Info del usuario autenticado

### Articles
- `POST /api/v1/articles` → Crear artículo (draft)
- `GET /api/v1/articles/{id}` → Obtener artículo
- `PUT /api/v1/articles/{id}` → Actualizar borrador
- `POST /api/v1/articles/{id}/submit` → Enviar a revisión
- `POST /api/v1/articles/{id}/approve` → Aprobar (reviewer)
- `POST /api/v1/articles/{id}/reject` → Rechazar con comentario

### Health
- `GET /health` → Estado del sistema

## Instalación y desarrollo

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Crear virtual env
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Crear BD (solo para development local)
# Usa alembic o crea las tablas automáticamente al iniciar

# 5. Ejecutar servidor
uvicorn app.main:app --reload --port 8000
```

## Uso con Docker

```bash
# Desde el root del proyecto
docker compose up

# La API estará en http://localhost/api/v1
# Docs en http://localhost/docs
```

## Próximos pasos (Fase 2)

- [ ] Módulo AI (WritingAssistantAgent, RAGIngest)
- [ ] Integración con Ollama y Qdrant
- [ ] Celery tasks para ingesta asíncrona
- [ ] Generación de portadas
- [ ] Exportación a PDF/DOCX
- [ ] Tests unitarios e integración
