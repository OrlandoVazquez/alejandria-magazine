# DESIGN.md — Software Design Document (SDD)

> **Versión:** 1.0 | **Estado:** borrador activo  
> Este documento es la fuente de verdad para el diseño técnico de la plataforma.
> Todo cambio de arquitectura debe reflejarse aquí **antes** de ser implementado.

---

## 1. Contexto y objetivos

### 1.1 Problema

Los investigadores y redactores carecen de una plataforma integrada que combine:
- Redacción asistida por IA con contexto propio (RAG sobre sus fuentes).
- Formato científico estructurado (APA, IEEE, Vancouver).
- Flujo de revisión y publicación controlado con trazabilidad.

### 1.2 Objetivos de la Fase 1

| Objetivo | Métrica de éxito |
|---|---|
| El usuario puede redactar un artículo asistido por IA | Integración `WritingAssistantAgent` funcional end-to-end |
| El usuario puede ingestar fuentes propias para RAG | `RAGIngestAgent` indexa PDF/URL en Qdrant |
| Flujo draft → review → published funciona | Al menos un ciclo completo sin intervención manual de DB |
| La plataforma corre en un único `docker compose up` | Todos los servicios levantan con healthchecks |

### 1.3 Fuera de alcance — Fase 1

- Pipeline multi-agente autónomo (Fase 2).
- Exportación a PDF/DOCX (Fase 2).
- Sistema de comentarios en artículos publicados.
- Multi-tenancy / organizaciones.

---

## 2. Modelo de dominio

### 2.1 Entidades principales

```
┌─────────────────────────┐         ┌──────────────────────────┐
│         User            │         │         Article          │
├─────────────────────────┤1      *├──────────────────────────┤
│ id: UUID                │────────│ id: UUID                 │
│ email: str              │        │ title: str               │
│ hashed_password: str    │        │ body: str (Markdown)     │
│ role: UserRole          │        │ status: ArticleStatus    │
│ full_name: str          │        │ author_id: UUID FK       │
│ is_active: bool         │        │ reviewer_id: UUID FK?    │
│ created_at: datetime    │        │ cover_url: str?          │
└─────────────────────────┘        │ scientific_format: str?  │
                                   │ rejection_comment: str?  │
                                   │ created_at: datetime     │
                                   │ updated_at: datetime     │
                                   │ published_at: datetime?  │
                                   └──────────────────────────┘
                                              │ 1
                                              │
                                              │ *
                                   ┌──────────────────────────┐
                                   │       AgentRun           │
                                   ├──────────────────────────┤
                                   │ run_id: UUID             │
                                   │ agent_name: str          │
                                   │ article_id: UUID FK      │
                                   │ author_id: UUID FK       │
                                   │ status: RunStatus        │
                                   │ tokens_used: int         │
                                   │ input_payload: JSONB     │
                                   │ output_payload: JSONB    │
                                   │ started_at: datetime     │
                                   │ finished_at: datetime?   │
                                   └──────────────────────────┘
```

### 2.2 Value Objects

```python
class UserRole(str, Enum):
    AUTHOR   = "author"
    REVIEWER = "reviewer"
    ADMIN    = "admin"

class ArticleStatus(str, Enum):
    DRAFT       = "draft"
    IN_REVIEW   = "in_review"
    APPROVED    = "approved"
    PUBLISHED   = "published"
    REJECTED    = "rejected"

class ScientificFormat(str, Enum):
    APA       = "apa"
    IEEE      = "ieee"
    VANCOUVER = "vancouver"
    NONE      = "none"

class RunStatus(str, Enum):
    RUNNING   = "running"
    COMPLETED = "completed"
    FALLBACK  = "fallback"
    FAILED    = "failed"
```

### 2.3 Máquina de estados del artículo

```
         submit()             approve()
DRAFT ──────────► IN_REVIEW ────────────► APPROVED ──► PUBLISHED
  ▲                   │                                    (publish() automático)
  │                   │ reject(comment)
  └───────────────────┘
```

**Transiciones válidas:**

| Estado actual | Acción | Estado siguiente | Rol requerido |
|---|---|---|---|
| `draft` | `submit_for_review` | `in_review` | `author` (propietario) |
| `in_review` | `approve` | `approved` | `reviewer` |
| `in_review` | `reject` | `draft` | `reviewer` |
| `approved` | `publish` | `published` | Sistema (automático) |

---

## 3. Arquitectura de módulos

### 3.1 Mapa de dependencias

```
frontend
    │
    │ HTTP / REST
    ▼
nginx (reverse proxy)
    │
    ▼
backend/app  (FastAPI)
    │
    ├── modules/auth         → postgres (users)
    ├── modules/users        → postgres (users)
    ├── modules/articles     → postgres (articles) + minio (covers)
    ├── modules/ai           → ollama + qdrant + redis (short-term memory)
    │       │
    │       └── tasks/       → celery worker (ingest async)
    │
    └── shared/
            ├── database/    → postgres (pool async SQLAlchemy)
            ├── cache/       → redis
            └── storage/     → minio
```

### 3.2 Regla de dependencia (hexagonal)

```
domain  ←  application  ←  adapters  ←  infrastructure
   ▲            │
   │            └── depende de interfaces (ports), nunca de implementaciones
   │
   └── nunca importa de ninguna capa superior
```

---

## 4. Esquema de base de datos

### 4.1 Tabla `users`

```sql
CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(16)  NOT NULL DEFAULT 'author'
                    CHECK (role IN ('author','reviewer','admin')),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### 4.2 Tabla `articles`

```sql
CREATE TABLE articles (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(512) NOT NULL,
    body                TEXT         NOT NULL DEFAULT '',
    status              VARCHAR(16)  NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','in_review','approved','published','rejected')),
    scientific_format   VARCHAR(16)  DEFAULT 'none'
                        CHECK (scientific_format IN ('apa','ieee','vancouver','none')),
    author_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id         UUID         REFERENCES users(id) ON DELETE SET NULL,
    cover_url           VARCHAR(1024),
    rejection_comment   TEXT,
    slug                VARCHAR(512) UNIQUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    published_at        TIMESTAMPTZ
);

CREATE INDEX idx_articles_author    ON articles(author_id);
CREATE INDEX idx_articles_status    ON articles(status);
CREATE INDEX idx_articles_slug      ON articles(slug) WHERE slug IS NOT NULL;
```

### 4.3 Tabla `agent_runs`

```sql
CREATE TABLE agent_runs (
    run_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name      VARCHAR(64)  NOT NULL,
    article_id      UUID         REFERENCES articles(id) ON DELETE SET NULL,
    author_id       UUID         REFERENCES users(id)    ON DELETE SET NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','completed','fallback','failed')),
    input_payload   JSONB        NOT NULL DEFAULT '{}',
    output_payload  JSONB,
    tokens_used     INTEGER      NOT NULL DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX idx_agent_runs_author  ON agent_runs(author_id);
CREATE INDEX idx_agent_runs_article ON agent_runs(article_id);
CREATE INDEX idx_agent_runs_status  ON agent_runs(status);
```

---

## 5. Contratos de API

### 5.1 Auth

```
POST /api/v1/auth/register
  Body:  { email, password, full_name }
  200:   { access_token, refresh_token, token_type }
  422:   ValidationError

POST /api/v1/auth/login
  Body:  { email, password }
  200:   { access_token, refresh_token, token_type }
  401:   Unauthorized

POST /api/v1/auth/refresh
  Body:  { refresh_token }
  200:   { access_token }
```

### 5.2 Articles

```
GET  /api/v1/articles
  Query: status?, page?, size?
  200:   PaginatedResponse[ArticleResponse]

POST /api/v1/articles
  Body:  CreateArticleDTO { title, body? }
  201:   ArticleResponse

GET  /api/v1/articles/{id}
  200:   ArticleResponse
  404:   Not Found

PUT  /api/v1/articles/{id}
  Body:  UpdateArticleDTO { title?, body?, scientific_format? }
  200:   ArticleResponse

POST /api/v1/articles/{id}/submit
  200:   ArticleResponse (status=in_review)
  409:   Conflict si el articulo no está en draft

POST /api/v1/articles/{id}/approve
  Role:  reviewer
  200:   ArticleResponse (status=approved → triggers publish)

POST /api/v1/articles/{id}/reject
  Role:  reviewer
  Body:  { comment: str }
  200:   ArticleResponse (status=draft)

GET  /api/v1/articles/{id}/view
  Public (no auth requerido si published)
  200:   ArticlePublicView
```

### 5.3 AI

```
POST /api/v1/ai/assist
  Auth:  Bearer token
  Body:  { article_id, user_prompt, selected_text?, article_context? }
  200:   { run_id, suggestion, sources[], tokens_used, status }
  429:   Rate limit exceeded

POST /api/v1/ai/ingest
  Auth:  Bearer token
  Body:  multipart/form-data { article_id, file? } | { article_id, url? }
  202:   { task_id, status: "queued" }  (async, via Celery)

POST /api/v1/ai/format
  Auth:  Bearer token
  Body:  { article_id, text, format: "apa"|"ieee"|"vancouver" }
  200:   { run_id, formatted_text, status }
```

### 5.4 Response schemas comunes

```python
class ArticleResponse(BaseModel):
    id: UUID
    title: str
    body: str
    status: ArticleStatus
    scientific_format: ScientificFormat
    author_id: UUID
    cover_url: str | None
    rejection_comment: str | None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None

class ArticlePublicView(BaseModel):
    id: UUID
    title: str
    body: str              # Markdown renderizado
    cover_url: str | None
    scientific_format: ScientificFormat
    published_at: datetime
    author_name: str       # Desnormalizado para la vista pública

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int
```

---

## 6. Flujos de secuencia

### 6.1 Flujo: asistencia IA durante redacción

```
Usuario          Frontend          Backend/AI          Ollama          Qdrant
   │                │                  │                  │               │
   │ escribe texto  │                  │                  │               │
   │ ──────────────►│                  │                  │               │
   │ clic "Asistir" │                  │                  │               │
   │ ──────────────►│ POST /ai/assist  │                  │               │
   │                │ ────────────────►│                  │               │
   │                │                  │ embed(prompt)    │               │
   │                │                  │ ────────────────►│               │
   │                │                  │◄─ vector         │               │
   │                │                  │ search(vector)   │               │
   │                │                  │ ────────────────────────────────►│
   │                │                  │◄─ chunks relevantes              │
   │                │                  │ build_prompt(chunks + historial) │
   │                │                  │ generate(prompt) │               │
   │                │                  │ ────────────────►│               │
   │                │                  │◄─ texto generado │               │
   │                │                  │ save AgentRun    │               │
   │                │◄── 200 {suggestion, sources} ──────┤               │
   │◄──────────────-│                  │                  │               │
```

### 6.2 Flujo: submit → review → publish

```
Autor            Backend/Articles     Revisor          Backend/Articles
  │                    │                 │                    │
  │ POST /submit       │                 │                    │
  │ ──────────────────►│                 │                    │
  │                    │ status=in_review│                    │
  │◄── 200 ────────────│                 │                    │
  │                    │                 │ GET /articles      │
  │                    │                 │(filter: in_review) │
  │                    │                 │ ──────────────────►│
  │                    │                 │◄── [articles]──────│
  │                    │                 │ POST /approve      │
  │                    │                 │ ──────────────────►│
  │                    │                 │                    │ status=approved
  │                    │                 │                    │ → publish()
  │                    │                 │                    │ status=published
  │                    │                 │◄── 200 ────────────│
```

---

## 7. Decisiones de arquitectura (ADR)

### ADR-001: Qdrant como vector store

**Contexto:** Se necesita búsqueda semántica para RAG.  
**Decisión:** Qdrant (open-source, autoalojado) en lugar de pgvector.  
**Razón:** Vector DB dedicada con HNSW nativo, filtros de payload sin JOIN, dashboard incluido, Apache 2.0.  
**Consecuencia:** Servicio adicional en docker-compose; la interfaz `IVectorStore` permite migrar sin tocar dominio.

### ADR-002: Ollama para LLM local

**Contexto:** Costo y privacidad de los datos de los autores.  
**Decisión:** Ollama como servidor LLM local dentro del compose.  
**Razón:** Sin envío de datos a APIs externas; intercambiable vía `ILLMProvider`; modelos descargables sin código.  
**Consecuencia:** Requiere GPU o CPU potente; modelos externos opcionales como Tavily para búsqueda web.

### ADR-003: Arquitectura hexagonal por módulo

**Contexto:** El sistema debe poder agentizarse en fases posteriores.  
**Decisión:** Cada módulo con Domain / Ports / Adapters propios.  
**Razón:** El dominio no depende de FastAPI ni de Ollama → los agentes se añaden como adaptadores sin romper contratos.  
**Consecuencia:** Más archivos iniciales; compensado por facilidad de testing y extensión.

### ADR-004: Human-in-the-loop obligatorio en publicación

**Contexto:** Los agentes no deben publicar contenido de forma autónoma.  
**Decisión:** El agente nunca llama a `publish()`; siempre requiere `POST /articles/{id}/approve` de un revisor humano.  
**Razón:** Calidad editorial, responsabilidad legal, confianza del usuario.  
**Consecuencia:** Flujo más lento, pero trazable y auditable.

---

## 8. Requisitos no funcionales

| Atributo | Objetivo | Cómo se garantiza |
|---|---|---|
| **Latencia AI** | < 5s p95 para `/ai/assist` | Timeout 60s Ollama; prompt size < 4 000 chars; fallback rápido |
| **Disponibilidad** | 99% en horario de uso | Docker restart policies; healthchecks; Celery retry backoff |
| **Seguridad** | OWASP Top 10 cubierto | JWT, bcrypt, rate limiting, CSP headers, prompt injection guard |
| **Escalabilidad** | Horizontal de workers Celery | `celery_worker` réplicas independientes en compose o K8s |
| **Observabilidad** | Traza completa de AgentRun | Tabla `agent_runs` + logs JSON estructurados |
| **Privacidad** | Datos del autor aislados | Filtro `author_id` en todas las queries Qdrant y DB |

---

## 9. Checklist SDD — antes de implementar un módulo

Antes de escribir código de implementación para cualquier módulo, verificar:

- [ ] Entidades y value objects definidos en `domain/`
- [ ] Puertos de entrada/salida (`IRepository`, `IService`) definidos como ABCs en `application/ports/`
- [ ] Casos de uso listados con firma de método y DTO de entrada/salida
- [ ] Esquema de tabla SQL documentado en este archivo (sección 4)
- [ ] Contrato de API documentado en sección 5
- [ ] Agente/tarea async correspondiente documentado en `AGENT.md` si aplica
- [ ] Test unitario del caso de uso planificado (mocks de puertos)
