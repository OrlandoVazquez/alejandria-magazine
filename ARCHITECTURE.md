# Arquitectura Implementada — Fase 1

## Status
**Backend** — Arquitectura hexagonal LISTA  
**Frontend** — Estructura base lista, código por hacer  
**AI Module** — Puertos definidos, implementación en Fase 2  

---

## Estructura completa

```
ALEJANDRÍA MAGAZINE
│
├─── BACKEND (IMPLEMENTADO)
│    │
│    ├── app/
│    │   ├── main.py                    FastAPI app factory
│    │   │
│    │   ├── core/
│    │   │   ├── config.py              Pydantic settings
│    │   │   └── security.py            JWT + password hashing
│    │   │
│    │   ├── shared/
│    │   │   └── database.py            SQLAlchemy async
│    │   │
│    │   └── modules/
│    │       │
│    │       ├── AUTH 
│    │       │   ├── domain/entities.py
│    │       │   ├── application/use_cases.py (Register, Login, GetUser)
│    │       │   └── adapters/
│    │       │       ├── persistence.py (ORM)
│    │       │       ├── repository.py  (Impl)
│    │       │       └── http.py        (3 endpoints)
│    │       │
│    │       ├── ARTICLES 
│    │       │   ├── domain/entities.py (Article, ArticleStatus)
│    │       │   ├── application/use_cases.py (7 use cases)
│    │       │   └── adapters/
│    │       │       ├── persistence.py
│    │       │       ├── repository.py
│    │       │       └── http.py (6 endpoints)
│    │       │
│    │       └── AI 
│    │           ├── domain/ports.py (ILLMProvider, IVectorStore, IWebSearch)
│    │           ├── application/use_cases.py (Por hacer)
│    │           └── adapters/ (Por hacer)
│    │
│    ├── alembic/                       Migraciones (no generadas aún)
│    ├── requirements.txt                (FastAPI, SQLAlchemy, etc)
│    ├── Dockerfile                      Imagen Docker
│    ├── .env.example
│    └── README.md + EXAMPLES.md
│
├─── FRONTEND (POR HACER)
│    ├── src/
│    │   ├── components/
│    │   │   ├── common/ (Button, Modal, Spinner)
│    │   │   ├── editor/ (RichTextEditor, AIAssistantPanel)
│    │   │   ├── article/ (ArticleCover)
│    │   │   └── layout/ (Navbar, Sidebar)
│    │   ├── pages/
│    │   │   ├── Login/
│    │   │   ├── Dashboard/
│    │   │   ├── Editor/
│    │   │   ├── Review/
│    │   │   └── ArticleView/
│    │   ├── services/ (API calls)
│    │   ├── store/ (Redux)
│    │   └── types/
│    └── package.json (Por crear)
│
├─── INFRASTRUCTURE
│    ├── nginx/nginx.conf               Reverse proxy
│    ├── ollama/models.txt              Modelos LLM
│    └── postgres/init/                 Scripts de BD
│
├─── DOCKER-COMPOSE
│    └── Todos los servicios configurados:
│        ├── PostgreSQL 16
│        ├── Qdrant (vector DB)
│        ├── Redis
│        ├── MinIO (object storage)
│        ├── Ollama (LLM local)
│        ├── FastAPI Backend
│        ├── React Frontend
│        ├── Nginx
│        ├── Celery Worker
│        └── Flower (monitoring)
│
└─── DOCUMENTACIÓN
     ├── DESIGN.md (Especificación completa)
     ├── AGENT.md (Sistema de agentes)
     ├── GOVERNANCE.md (Roles y permisos)
     ├── README.md (Este proyecto)
     ├── backend/README.md (Cómo desarrollar)
     └── backend/EXAMPLES.md (API examples)
```

---

## Endpoints implementados

### AUTH (3 endpoints)
```
POST   /api/v1/auth/register     → Registrar usuario
POST   /api/v1/auth/login        → Login con JWT
GET    /api/v1/auth/me           → Info usuario autenticado
```

### ARTICLES (6 endpoints)
```
POST   /api/v1/articles          → Crear artículo (draft)
GET    /api/v1/articles/{id}     → Obtener artículo
PUT    /api/v1/articles/{id}     → Actualizar draft
POST   /api/v1/articles/{id}/submit  → Enviar a revisión
POST   /api/v1/articles/{id}/approve → Aprobar (reviewer)
POST   /api/v1/articles/{id}/reject  → Rechazar
```

### HEALTH (1 endpoint)
```
GET    /health                   → Status del sistema
```

---

## 🔄 Flujo completo implementado

```
1. REGISTRO
   POST /register → JWT (access + refresh)

2. REDACCIÓN
   POST /articles → Crea draft
   PUT /articles/{id} → Edita draft

3. ENVÍO A REVISIÓN
   POST /articles/{id}/submit → status = in_review

4. REVISIÓN
   GET /articles → Listar artículos en revisión (por hacer)
   POST /approve → status = published
   POST /reject → status = draft + comentario

5. PUBLICACIÓN (automática al aprobar)
   GET /articles/{id} → Vista pública
```

---

## Tecnologías

| Capa | Tecnología | Versión |
|---|---|---|
| **API** | FastAPI | 0.104.1 |
| **ORM** | SQLAlchemy | 2.0.23 |
| **BD** | PostgreSQL | 16 |
| **Auth** | JWT (python-jose) | 3.3.0 |
| **Async** | asyncpg | 0.29.0 |
| **Validación** | Pydantic | 2.5.0 |
| **Hashing** | Passlib + bcrypt | - |

---

## Próximas prioridades

### Fase 1 (AHORA)
- [x] Arquitectura hexagonal base
- [x] Auth (register, login)
- [x] Articles CRUD + flujo de aprobación
- [ ] **Frontend** — Componentes React + integración
- [ ] **Tests** — Unitarios e integración
- [ ] **Deployment** — Docker Compose local

### Fase 2 (POST-Fase 1)
- [ ] AI Module: WritingAssistantAgent
- [ ] AI Module: RAGIngestAgent  
- [ ] Integración Ollama + Qdrant
- [ ] Celery tasks
- [ ] Generación de portadas
- [ ] Export PDF/DOCX

---

## Quick Start

```bash
# 1. Clonar y entrar
git clone https://github.com/luxinopanyvino/alejandria-magazine.git
cd alejandria_magazine

# 2. Iniciar Docker (requiere PostgreSQL, Redis, etc)
docker compose up -d

# 3. Crear DB y migrar
docker exec ap_backend alembic upgrade head

# 4. La API estará en:
# http://localhost/api/v1
# Docs: http://localhost/docs
```

---

## Documentación

- [Backend README](backend/README.md) — Cómo desarrollar
- [API Examples](backend/EXAMPLES.md) — Ejemplos curl
- [DESIGN.md](DESIGN.md) — Especificación técnica
- [AGENT.md](AGENT.md) — Sistema de agentes

---

## Contribuir

La arquitectura es modular y escalable:

1. **Nuevo módulo** → Copiar estructura de `auth/` o `articles/`
2. **Implementar** → domain → application → adapters
3. **Registrar router** en `app/main.py`
4. **Test** con curl o Postman
5. **Commit** a rama `feature/...`

Ejemplo: [backend/EXAMPLES.md](backend/EXAMPLES.md#cómo-extender-con-nuevos-módulos)

---

## Principios clave

1. **Hexagonal**: Domain ← Application ← Adapters
2. **Modular**: Cada módulo es independiente
3. **Testeable**: Sin dependencias de framework en domain
4. **Type-safe**: Pydantic + SQLAlchemy types
5. **Async-first**: asyncio + AsyncSession
6. **Clean code**: Nombres descriptivos, pequeños archivos

---

**Estado actual:** Backend 90% Fase 1 ✅ | Frontend por iniciar | AI puertos definidos 🔜

*Última actualización: 1 de mayo de 2026*
