# Ejemplos de uso de la API

## 1. Registro e login

### Registrar usuario
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "author@example.com",
    "password": "secure123",
    "full_name": "Luis García"
  }'

# Response 200
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### Login
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "author@example.com",
    "password": "secure123"
  }'

# Response 200 (tokens)
```

### Obtener info del usuario
```bash
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response 200
{
  "id": "uuid",
  "email": "author@example.com",
  "full_name": "Luis García",
  "role": "author",
  "is_active": true
}
```

## 2. Artículos

### Crear artículo (draft)
```bash
curl -X POST "http://localhost:8000/api/v1/articles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Mi primer artículo",
    "body": "# Introducción\n\nEste es el cuerpo del artículo..."
  }'

# Response 201
{
  "id": "uuid",
  "title": "Mi primer artículo",
  "body": "# Introducción\n\nEste es el cuerpo del artículo...",
  "status": "draft",
  "scientific_format": "none",
  "author_id": "uuid",
  "created_at": "2024-05-01T12:00:00",
  "updated_at": "2024-05-01T12:00:00"
}
```

### Actualizar borrador
```bash
curl -X PUT "http://localhost:8000/api/v1/articles/{article_id}" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Mi primer artículo (editado)",
    "body": "# Introducción\n\nContenido actualizado...",
    "scientific_format": "apa"
  }'

# Response 200
```

### Enviar a revisión
```bash
curl -X POST "http://localhost:8000/api/v1/articles/{article_id}/submit" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response 200
# status cambia a "in_review"
```

### Obtener artículo
```bash
curl -X GET "http://localhost:8000/api/v1/articles/{article_id}" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response 200
```

## 3. Flujo de revisión (Reviewer)

### Primero, registrar un revisor
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "reviewer@example.com",
    "password": "secure123",
    "full_name": "María Revisora"
  }'

# Nota: Necesitarás actualizar el rol a "reviewer" en BD directamente (por ahora)
```

### Aprobar artículo
```bash
curl -X POST "http://localhost:8000/api/v1/articles/{article_id}/approve" \
  -H "Authorization: Bearer REVIEWER_TOKEN"

# Response 200
# status cambia a "approved" → "published" (automático)
```

### Rechazar artículo
```bash
curl -X POST "http://localhost:8000/api/v1/articles/{article_id}/reject" \
  -H "Authorization: Bearer REVIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Necesita revisar la metodología en la sección 3"
  }'

# Response 200
# status cambia a "rejected", article vuelve a "draft"
```

## 4. Health check
```bash
curl "http://localhost:8000/health"

# Response 200
{
  "status": "ok",
  "version": "0.1.0"
}
```

## Cómo extender con nuevos módulos

### 1. Crear estructura del módulo

```
backend/app/modules/new_module/
├── domain/
│   ├── __init__.py
│   └── entities.py           # Entidades de dominio
├── application/
│   ├── __init__.py
│   ├── ports.py              # Interfaces (ej: IMyRepository)
│   ├── dtos.py               # DTOs
│   └── use_cases.py          # Casos de uso
└── adapters/
    ├── __init__.py
    ├── persistence.py        # Modelos ORM
    ├── repository.py         # Implementaciones de repositories
    └── http.py               # Routers FastAPI
```

### 2. Implementar entities.py
```python
# domain/entities.py
class MyEntity:
    def __init__(self, id: UUID, name: str):
        self.id = id
        self.name = name
```

### 3. Implementar ports.py
```python
# application/ports.py
from abc import ABC, abstractmethod

class IMyRepository(ABC):
    @abstractmethod
    async def get_by_id(self, entity_id: UUID):
        pass
```

### 4. Implementar use_cases.py
```python
# application/use_cases.py
class GetMyEntityUseCase:
    def __init__(self, repository: IMyRepository):
        self.repository = repository
    
    async def execute(self, entity_id: UUID):
        return await self.repository.get_by_id(entity_id)
```

### 5. Implementar adapters
```python
# adapters/persistence.py
from sqlalchemy import Column, String
from app.shared.database import Base

class MyEntityORM(Base):
    __tablename__ = "my_entities"
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String(255))

# adapters/repository.py
class MyRepositoryImpl(IMyRepository):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, entity_id: UUID):
        # Implementar lógica
        pass

# adapters/http.py
from fastapi import APIRouter
router = APIRouter(prefix="/api/v1/my-entities")

@router.get("/{entity_id}")
async def get_entity(entity_id: UUID):
    # Usar use case
    pass
```

### 6. Registrar router en main.py
```python
# app/main.py
from app.modules.new_module.adapters.http import router as new_module_router

app.include_router(new_module_router)
```

## Testing

(Próximamente: Ejemplos de tests unitarios y de integración)
