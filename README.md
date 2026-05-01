# AI Article Platform

Plataforma agentica simple para la **generación asistida de artículos científicos** con IA local (Ollama), RAG y flujo de revisión y publicación.

---

## Flujo de usuario

```
Login
  │
  ▼
Dashboard
  │
  ├─► Editor de artículo
  │     ├─ Redacción libre (rich text)
  │     ├─ Asistente IA (Ollama + RAG + fuentes externas)  ◄── núcleo agentico
  │     └─ Formateador científico (APA / IEEE / custom)
  │
  ▼
Enviar a revisión
  │
  ▼
Panel de revisión (otro usuario)
  ├─ Aprobar  ──► Publicación automática
  └─ Rechazar ──► Artículo vuelve a borrador con comentarios
                  │
                  ▼
            Vista de artículo publicado
            (portada generada + cuerpo formateado)
```

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Redux Toolkit + Vite |
| Backend API | FastAPI (Python 3.12) |
| Base de datos | PostgreSQL 16 |
| LLM local | **Ollama** (llama3.2, mistral, etc.) — sin API externa obligatoria |
| Embeddings | sentence-transformers (local) |
| Vector Store | **Qdrant** (open-source, autoalojado) |
| RAG | LangChain + Qdrant |
| Cache | Redis 7 |
| Almacenamiento | **MinIO** (S3-compatible: portadas, archivos, fuentes) |
| Tareas async | Celery + Redis broker |
| Contenedores | Docker + Docker Compose |
| Reverse proxy | Nginx (rate limiting, headers de seguridad, compresión) |
| IA externa (opt.) | Tavily / Bing Search API (fuentes externas para RAG) |

---

## Arquitectura: Hexagonal Modular

El backend aplica **Ports & Adapters** por módulo. El dominio es Python puro: nunca depende de FastAPI, SQLAlchemy ni Ollama directamente.

```
módulo/
├── domain/                  # Entidades, value objects — sin dependencias de framework
├── application/
│   └── use_cases/           # Lógica de negocio; depende solo de puertos (interfaces)
├── adapters/
│   ├── http/                # Routers FastAPI (adaptador de entrada)
│   └── output/              # Repositorios, clientes Ollama, MinIO (adaptadores de salida)
└── infrastructure/          # Config del framework, IoC
```

Beneficio clave: el módulo `ai` puede **escalar a un sistema multi-agente** simplemente añadiendo nuevos adaptadores de salida (`ollama_adapter`, `openai_adapter`) sin tocar los casos de uso.

---

## Estructura de carpetas

```
example_/
├── backend/
│   ├── app/
│   │   ├── main.py                          # FastAPI app factory
│   │   ├── core/
│   │   │   ├── config.py                    # Settings via pydantic-settings
│   │   │   ├── security.py                  # JWT + password hashing
│   │   │   └── dependencies.py              # DI: repositorios, servicios
│   │   ├── shared/
│   │   │   ├── database/                    # SQLAlchemy async session
│   │   │   ├── cache/                       # Redis client
│   │   │   └── storage/                     # MinIO client
│   │   └── modules/
│   │       ├── auth/                        # Login, registro, JWT refresh
│   │       │   ├── domain/
│   │       │   ├── application/use_cases/
│   │       │   └── adapters/ http/ persistence/
│   │       ├── users/                       # Perfil de usuario, roles
│   │       │   └── [misma estructura]
│   │       ├── articles/                    # Ciclo de vida del artículo
│   │       │   ├── domain/
│   │       │   │   ├── entities.py          # Article, ArticleVersion
│   │       │   │   └── value_objects.py     # ArticleStatus: draft|in_review|published|rejected
│   │       │   ├── application/use_cases/
│   │       │   │   ├── create_draft.py
│   │       │   │   ├── update_draft.py
│   │       │   │   ├── submit_for_review.py
│   │       │   │   ├── approve_article.py
│   │       │   │   ├── reject_article.py
│   │       │   │   └── publish_article.py
│   │       │   └── adapters/ http/ persistence/
│   │       └── ai/                          # Asistente IA + RAG
│   │           ├── domain/
│   │           │   ├── entities.py          # RAGQuery, Chunk, EmbeddingDoc
│   │           │   └── ports.py             # ILLMProvider, IVectorStore, IWebSearch
│   │           ├── application/use_cases/
│   │           │   ├── assist_writing.py    # Asistencia con contexto RAG
│   │           │   ├── rag_retrieve.py      # Pipeline de recuperación
│   │           │   └── ingest_source.py     # Indexar documento en Qdrant
│   │           ├── adapters/
│   │           │   ├── http/router.py       # POST /api/v1/ai/assist, /ingest, /search
│   │           │   └── output/
│   │           │       ├── ollama_adapter.py      # ILLMProvider → Ollama
│   │           │       ├── qdrant_store.py        # IVectorStore → Qdrant
│   │           │       └── web_search.py          # IWebSearch → Tavily / Bing
│   │           └── infrastructure/
│   │               └── prompts/
│   │                   ├── writing_assistant.txt
│   │                   └── scientific_format.txt
│   ├── alembic/versions/                    # Migraciones de DB
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── common/     Button/ Modal/ Spinner/
│       │   ├── layout/     Navbar/ Sidebar/
│       │   ├── editor/
│       │   │   ├── RichTextEditor/          # TipTap o similar
│       │   │   ├── AIAssistantPanel/        # Panel lateral de IA (chat-like)
│       │   │   └── ScientificFormatter/     # Toolbar de formato científico
│       │   └── article/
│       │       └── ArticleCover/            # Portada generada
│       ├── pages/
│       │   ├── Login/
│       │   ├── Dashboard/                   # Lista de artículos propios
│       │   ├── Editor/                      # Redacción + asistente IA
│       │   ├── Review/                      # Panel de revisión (rol reviewer)
│       │   └── ArticleView/                 # Vista pública del artículo publicado
│       ├── services/
│       │   ├── api.ts                       # Axios instance con interceptores JWT
│       │   ├── auth.service.ts
│       │   ├── articles.service.ts
│       │   └── ai.service.ts
│       └── store/slices/
│
├── infrastructure/
│   ├── nginx/nginx.conf                     # Reverse proxy + rate limiting + sec headers
│   ├── ollama/models.txt                    # Lista de modelos a descargar al iniciar
│   └── postgres/init/                       # Scripts SQL de inicialización (extensiones)
│
├── docker-compose.yml
├── backend/.env.example
└── README.md
```

---

## APIs (FastAPI)

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/v1/auth/login` | Obtener tokens JWT |
| POST | `/api/v1/auth/register` | Registrar usuario |
| POST | `/api/v1/auth/refresh` | Renovar access token |
| GET/POST | `/api/v1/articles` | Listar / crear artículo (borrador) |
| PUT | `/api/v1/articles/{id}` | Actualizar borrador |
| POST | `/api/v1/articles/{id}/submit` | Enviar a revisión |
| POST | `/api/v1/articles/{id}/approve` | Aprobar (rol: reviewer) |
| POST | `/api/v1/articles/{id}/reject` | Rechazar con comentario |
| POST | `/api/v1/articles/{id}/publish` | Publicar artículo aprobado |
| GET | `/api/v1/articles/{id}/view` | Vista pública del artículo |
| POST | `/api/v1/ai/assist` | Asistencia IA con RAG |
| POST | `/api/v1/ai/ingest` | Indexar fuente en Qdrant |
| POST | `/api/v1/ai/format` | Formatear texto como paper científico |
| GET | `/api/v1/health` | Estado del sistema |

---

## Estados del artículo

```
draft ──► in_review ──► approved ──► published
  ▲            │
  └────────────┘ (rechazado vuelve a draft con comentarios)
```

---

## Inicio rápido

### Requisitos

- Docker 24+ y Docker Compose v2
- (Opcional) GPU NVIDIA para Ollama con aceleración

### Levantar

```bash
# 1. Clonar
git clone <repo-url> && cd example_

# 2. Variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores reales

# 3. Levantar toda la plataforma
docker compose up -d

# 4. Descargar el modelo LLM local
docker exec ap_ollama ollama pull llama3.2
docker exec ap_ollama ollama pull nomic-embed-text

# 5. Ejecutar migraciones
docker exec ap_backend alembic upgrade head
```

La plataforma estará disponible en:
- **App**: http://localhost (Nginx)
- **API docs**: http://localhost/docs
- **MinIO console**: http://localhost:9001
- **Celery monitor**: http://localhost:5555

### Desarrollo local (backend)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env        # Ajustar URLs a localhost
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Desarrollo local (frontend)

```bash
cd frontend
npm install
npm run dev
```

---

## Sistema RAG (Retrieval-Augmented Generation)

El asistente de escritura usa RAG sobre **Qdrant** (vector DB open-source dedicada, alto rendimiento ANN):

```
Usuario escribe/consulta
        │
        ▼
  ai/assist_writing.py
        │
   ┌────┴────────────────────┐
   │                         │
   ▼                         ▼
rag_retrieve.py        web_search.py
(Qdrant + embeddings)  (Tavily/Bing — opcional)
   │                         │
   └──────── contexto ───────┘
                │
                ▼
        ollama_adapter.py
        (llama3.2 local)
                │
                ▼
        Respuesta al editor
```

El usuario también puede **ingestar fuentes** (PDF, URLs) que quedan indexadas en Qdrant y disponibles para futuras consultas.

---

## Roles de usuario

| Rol | Permisos |
|---|---|
| `author` | Crear/editar borradores, solicitar asistencia IA, enviar a revisión |
| `reviewer` | Ver artículos en revisión, aprobar o rechazar con comentarios |
| `admin` | Todo lo anterior + gestión de usuarios |

---

## Roadmap

- [x] Arquitectura hexagonal modular — fase 1
- [x] Módulo `ai` con RAG local (Ollama + Qdrant)
- [ ] Implementar `assist_writing` y `rag_retrieve` use cases
- [ ] Editor rico con panel de IA integrado (TipTap)
- [ ] Generación automática de portada (Pillow)
- [ ] Multi-agente: `ResearchAgent` + `WritingAgent` en pipeline LangGraph
- [ ] Soporte multi-modelo (llama3.2, mistral, gemma3)
- [ ] Exportación a PDF/DOCX (formato científico via Pandoc)

---

## Licencia

MIT
