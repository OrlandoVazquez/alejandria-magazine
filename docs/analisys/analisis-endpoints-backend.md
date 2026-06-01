# Análisis de Endpoints del Backend — AlexandrIA Magazine

> Documento técnico de análisis y diseño de la superficie de API.
> Ubicación: `docs/analisys/analisis-endpoints-backend.md`
> Fecha: 2026-06-01 · Rama base: `develop`

---

## 1. Resumen ejecutivo

AlexandrIA Magazine es una plataforma editorial asistida por IA: los autores redactan artículos científicos, un pipeline multi-agente LangGraph (investigador, escritor, revisor, formateador, publicador) los procesa con RAG sobre Qdrant y Ollama, y un flujo de revisión humano-en-el-bucle aprueba y publica. El backend (FastAPI) tiene **hoy 33 endpoints de dominio cableados más `GET /health`** (8 routers vivos en `backend/app/routers/*`), pero su estado es el de un **refactor a medio terminar con deuda de seguridad grave**.

El hallazgo principal es que la superficie viva contiene fallos de control de acceso explotables: **todo el router AI (`/ai/models|assist|ingest|format`) es 100% público** (abuso de LLM y envenenamiento del RAG sin autenticación), `GET /articles/{id}` **no exige auth ni ownership** (cualquiera lee borradores ajenos por UUID), `approve`/`reject` solo exigen estar logueado (cualquier autor publica o rechaza artículos de otros), y `PUT /agents/claude-defs/{name}` junto a `PUT /config` permiten **escrituras de archivos arbitrarias guiadas por el cliente** (path traversal y manipulación de los prompts del pipeline). Además, **la máquina de estados declarada se viola**: el estado `approved` nunca se usa, `reject` deja un callejón sin salida, y la transición `publish` no tiene endpoint (la realiza el agente publicador escribiendo la BD directamente, saltándose el gate humano de ADR-004).

Existe asimismo una **dualidad arquitectónica**: un árbol hexagonal completo en `app/modules/*` que **no está cableado** (código muerto) y duplica `auth`/`articles`/`ai` con DTOs y semántica distintas, además de declarar su propia capa ORM sobre una `Base` diferente. El RBAC es puramente declarativo (los roles `author`/`reviewer`/`admin` existen en el modelo pero ningún endpoint ramifica por rol; `admin` nunca se asigna; `reviewer` solo se obtiene por auto-promoción de desarrollo). Este documento clasifica **60+ endpoints en 15 dominios** marcando lo que **Existe**, lo **Parcial** (existe con defecto) y lo que **Falta**, con prioridades para cerrar primero las brechas de seguridad y alinear la máquina de estados.

---

## 2. Metodología y alcance

El análisis se construyó en tres pasadas:

1. **Inventario y síntesis.** Se consolidaron seis inventarios independientes (routers, clientes frontend, modelo de dominio, máquina de estados declarada, documentación de diseño y features de fase) en una superficie de endpoints recomendada por dominio.
2. **Verificación adversarial contra el código real.** Tres verificaciones cruzadas revisaron los 8 routers vivos (`backend/app/routers/*.py`), `main.py`, los modelos (`backend/app/models.py`), el agente publicador (`backend/app/agents/publicador.py`) y los clientes frontend (`frontend/src/api/*.js`). Las afirmaciones críticas se confirmaron a nivel de línea.
3. **Integración de correcciones.** Las imprecisiones detectadas (p. ej. `GET /auth/me` ya está cableado y solo falla con UUID malformado; `GET /users/reviewers` y `PUT /users/{id}/role` deben ser prioridad Alta porque son la raíz del RBAC; falta un endpoint de consulta de un run por `run_id`; el flag de promoción dev está activado por defecto) se incorporaron directamente al diseño final.

**Dentro de alcance:** la superficie HTTP de la API (`/api/v1/*`), su autenticación/autorización, su alineación con la máquina de estados y el modelo de dominio, y las discrepancias frontend↔backend. **Fuera de alcance:** implementación interna de los agentes LangGraph, despliegue/infra (más allá de notas transversales), y la calidad del RAG salvo donde afecta a la forma o seguridad del endpoint.

**Convenciones de estado usadas:**

| Estado | Significado |
|---|---|
| **Existe** | Cableado y correcto (o con defecto cosmético menor). |
| **Parcial** | Cableado pero con defecto de auth, estado, forma o consulta. |
| **Falta** | No existe; requerido por frontend, modelo, máquina de estados o docs. |

---

## 3. Arquitectura actual

### 3.1 Backend — dualidad routers vivos vs módulos hexagonales muertos

```
backend/app/
├── main.py                  # ÚNICO punto de cableado (include_router)
├── routers/                 # ★ VIVO — la única superficie servida
│   ├── auth.py              #   register, login, me, dev/promote-reviewer
│   ├── articles.py          #   CRUD + transiciones + assign-reviewer
│   ├── ai.py                #   models, assist, ingest, format  (SIN AUTH)
│   ├── agents.py            #   run, runs, stream(SSE), definitions, claude-defs
│   ├── flows.py             #   CRUD saved_flows (patrón de ownership correcto)
│   ├── config.py            #   GET/PUT config.yaml (sin gate admin)
│   ├── notifications.py     #   list, {id}/read
│   └── checkpoints.py       #   POST, /latest
├── models.py                # UserModel/ArticleModel… sobre app.database.Base  ← materializada
└── modules/                 # ✗ MUERTO — NO cableado (cero include_router)
    ├── auth/  articles/      #   domain + application(use_cases) + adapters
    │   └── …                 #   UserORM/ArticleORM sobre app.shared.database.Base ← nunca migrada
    └── ai/                   #   incompleto (puertos/adaptadores stub, sin use cases reales)
```

El árbol hexagonal `app/modules/*` está **completo** para `auth`/`articles` (con casos de uso `RegisterUseCase`, `CreateArticleUseCase`, `ApproveArticleUseCase` que ya separa approve+publish, entidad `Article` con lógica de transición) e **incompleto** para `ai` (puertos y adaptadores en stub, sin casos de uso reales). El SDD (DESIGN §3.1) prevé además un módulo `users` que **no existe** en el código. Sin embargo, **nadie lo importa**: `main.py` solo cablea `app/routers/*`. Hay además un **cisma de persistencia**: los módulos declaran ORMs propios (`UserORM`/`ArticleORM`) sobre `app.shared.database.Base`, con el mismo nombre de tabla que los modelos vivos sobre `app.database.Base`; `init_db` solo materializa la Base viva, por lo que las tablas del módulo nunca se crean. Convivir con ambos árboles induce a error y arriesga divergencia de esquema y de máquina de estados.

**Violación de capa.** La regla `.claude/rules/fastapi-style.md` ("evitar lógica de negocio en routers; usar casos de uso en `application`") se incumple ampliamente: acceso a BD, IO de archivos, parsing YAML, emisión de tokens, creación de notificaciones, extracción de keywords y transiciones de estado viven dentro de los routers.

### 3.2 Frontend React + diseñador de flujos

SPA React con clientes API en `frontend/src/api/*` (interceptor de token Bearer en `client.js`). Páginas relevantes: `AuthPage`, `DashboardPage`, `ArticlesPage`, `ArticleDetailPage`, `FlowDesignerPage`/`FlowsPage` (diseñador visual React-Flow), `ExecutionPage` (consume SSE vía `EventSource`), `AgentsPage`, `ConfigPage`. El auto-guardado del diseñador ocurre en `localStorage` (`flowStore.js`), no contra el backend.

### 3.3 Pipeline de agentes IA (LangGraph)

El pipeline se lanza como `BackgroundTask` desde `POST /agents/{article_id}/run` y emite progreso por SSE. El `flow_sequence` recibido se ejecuta, pero `agent_settings` **nunca se reenvía** al `Orchestrator.run`, y el estado in-process `active_streams` rompe en multi-worker.

**Diagrama — flujo editorial (estado DECLARADO vs estado REAL):**

```
DECLARADO (.claude/rules/state-machine.md)
  draft ──submit──▶ in_review ──approve──▶ approved ──publish──▶ published
    ▲                   │
    └──── (resubmit) ───┤──reject──▶ rejected
                        ▼
REAL (código actual)
  draft ──submit──▶ in_review ──approve──▶ PUBLISHED         (¡salta 'approved'!)
                        │
                        └──reject──▶ rejected  ✗ sin salida (dead-end)
  approved: NUNCA usado     publish: SIN endpoint (lo hace el agente publicador en BD)
```

**Diagrama — pipeline de agentes:**

```
POST /agents/{id}/run  (BackgroundTask)
        │  flow_sequence=[...]   (agent_settings ← IGNORADO)
        ▼
 ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌────────────┐
 │investigador│─▶│ escritor │─▶│ revisor  │─▶│ formateador │─▶│ publicador │
 │ (RAG Qdrant│  │ (Ollama) │  │          │  │ APA/IEEE/…  │  │ escribe BD │
 └────────────┘  └──────────┘  └──────────┘  └─────────────┘  │ status=    │
        │  cada paso → AgentRunModel (run_id)                   │ PUBLISHED  │ ← sin gate
        ▼  progreso → SSE (active_streams, in-process)          └────────────┘
   GET /agents/{id}/stream?token=...
```

---

## 4. Modelo de dominio

### 4.1 Entidades principales

| Entidad | Campos relevantes | Notas |
|---|---|---|
| **User** | `id`, `email`, `hashed_password`, `full_name`, `role` (`author`/`reviewer`/`admin`), `is_active`, `created_at`, `updated_at` | Soporta CRUD/roles completos, pero solo hay `register`/`login`/`me`/`dev-promote`. `admin` nunca se asigna ni se chequea. |
| **Article** | `id`, `title`, `body`, `author_id`, `reviewer_id`, `status`, `scientific_format`, `rejection_comment`, `cover_url(1024)`, `created_at`, `updated_at`, `published_at` | `cover_url` es **columna huérfana** (ningún endpoint/agente la escribe). `reviewer_id` se asigna pero **nunca se consulta** (no hay cola de revisión). El agente publicador genera `published_url`/`metadata`, pero **no son columnas** y **no se persisten** (se descartan al terminar el run; el SDD prevé `slug`, tampoco implementado). |
| **AgentRun** | `run_id` (PK), `agent_name`, `article_id`, `author_id`, `status`, `input_payload`, `output_payload`, `error_message`, `tokens_used`, `started_at`/`finished_at` | `tokens_used` existe en columna y en `AgentRunDetailResponse` pero **nunca se popula** (siempre 0). Crece sin cota. |
| **SavedFlow** | `id`, `author_id`, `name`, `nodes`, `edges`, `flow_sequence` | Subdominio mejor implementado; ownership correcto. |
| **Notification** | `id`, `user_id`, `message`, `read`, `created_at` | Solo se crean dentro de `assign_reviewer`. No se emiten en approve/reject/publish. |
| **Checkpoint** | `id`, `author_id`, `article_id?`, `state_json`, `created_at` | FK `article_id` se guarda pero nunca se consulta para lookup. |

### 4.2 Máquina de estados y dónde el código la viola

Estados declarados: `draft`, `in_review`, `approved`, `published`, `rejected`. Transiciones: `submit_for_review`, `approve`, `reject`, `publish`.

| Transición declarada | Comportamiento real | Violación |
|---|---|---|
| `submit_for_review`: `draft`/`rejected` → `in_review` | Solo acepta `draft` (`articles.py:136`); `rejected` queda atascado | **Dead-end:** un artículo rechazado no puede reenviarse. |
| `approve`: `in_review` → `approved` | Salta directo a `PUBLISHED` (`articles.py:164`), nunca usa `ArticleStatus.APPROVED` | **Colapsa approve+publish; `approved` nunca existe.** El docstring (`articles.py:153`) incluso dice "in_review → approved → published" pero el código solo asigna `PUBLISHED`. |
| `reject`: `in_review` → `rejected` | Pone `REJECTED` (`articles.py:193`) | **Ambigüedad de origen:** el docstring del backend **y DESIGN §2.3** dicen `in_review → draft` (lo que cerraría el resubmit), pero el código diverge a `REJECTED` terminal (estado que sí existe en el enum). Hay que reconciliar diseño y código. |
| `publish`: `approved` → `published` | **Sin endpoint.** Lo hace el agente publicador (`publicador.py:41-42`) escribiendo `status=PUBLISHED` y `published_at` directo en BD (vía `app.shared.database`, otra `Base`), sin precondición de `approved` ni gate humano | **Incumple ADR-004 (human-in-the-loop):** un agente publica sin el `approve` de un revisor. Por DESIGN, publish es automático **tras** el approve humano; aquí no hay approve previo. |

Defectos adicionales de guarda de estado: `PUT /articles/{id}` no restringe por estado (edita `IN_REVIEW`/`PUBLISHED`); `assign-reviewer` mueve **cualquier** estado (incluso `PUBLISHED`) a `in_review` sin validar el estado ni el rol del destinatario.

---

## 5. Inventario de endpoints EXISTENTES

> Todos bajo el prefijo `/api/v1` salvo `/health`. Auth = `Depends(get_current_user)` (Bearer) salvo indicación contraria.

### Router `auth` (`backend/app/routers/auth.py`)

| Método | Ruta | Auth | Request | Response | Notas / Issues |
|---|---|---|---|---|---|
| POST | `/auth/register` | Pública | `{email, password(min6), full_name}` | `TokenResponse {access_token}` | **Parcial.** Lógica de negocio inline; auto-login sin verificación de email; **no emite `refresh_token`** aunque el modelo lo soporta. |
| POST | `/auth/login` | Pública | `{email, password}` | `TokenResponse {access_token}` | **Parcial.** **No emite `refresh_token`** hoy; sin rate-limit/anti-brute-force; lógica inline. El JWT sí lleva `role`. No hay enumeración de usuarios (correcto). |
| GET | `/auth/me` | Bearer | — | `UserResponse` | **Parcial (cableado y funcional).** Único defecto: `UUID(token['user_id'])` malformado lanza **500 en vez de 401**. |
| POST | `/auth/dev/promote-reviewer` | Bearer + flag | — | `UserResponse` | **Parcial.** Auto-promoción a `REVIEWER`; **el flag `ENABLE_DEV_ROLE_PROMOTION` está ON por defecto** → escalada de privilegios por diseño. Forzar a DEBUG estricto. |

### Router `articles` (`backend/app/routers/articles.py`)

| Método | Ruta | Auth | Request | Response | Notas / Issues |
|---|---|---|---|---|---|
| GET | `/articles` | Bearer (scoped `author_id`) | `?status&skip=0&limit=100` | `ArticleListResponse` | **Parcial.** `total=len(scalars().all())` (**O(n)**); el count **ignora el filtro `status`** (total/pages erróneos); **`ZeroDivisionError`→500 con `limit=0`** en *dos* divisiones (`page` y `pages`). |
| POST | `/articles` | Bearer (owner=caller) | `{title, body}` | `ArticleResponse` (201) | **Existe.** Correcto (status `draft` por defecto). |
| GET | `/articles/{id}` | **NINGUNA** | — | `ArticleResponse` | **Parcial — ACCESO ROTO.** Sin `Depends` ni ownership: cualquier anónimo lee borradores/in_review/rejected ajenos por UUID. El frontend lo consume autenticado. |
| PUT | `/articles/{id}` | Bearer + ownership | `{title?, body?, scientific_format?}` | `ArticleResponse` | **Parcial.** Ownership correcto, pero **sin guarda de estado**: edita `IN_REVIEW`/`PUBLISHED` saltándose el workflow. |
| POST | `/articles/{id}/submit` | Bearer + ownership | — | `ArticleResponse` | **Parcial.** Solo `draft`→`in_review`; **no acepta `rejected`** (dead-end). |
| POST | `/articles/{id}/approve` | **solo logueado** | — | `ArticleResponse` | **Parcial.** Salta `in_review`→**`PUBLISHED`** (omite `approved`); sin rol/ownership; `published_at = __import__('datetime').datetime.utcnow()` (import inline ofuscado + `utcnow()` deprecado). |
| POST | `/articles/{id}/reject` | **solo logueado** | **`?comment`** (query) | `ArticleResponse` | **Parcial.** `comment` es **query param obligatorio**, pero el frontend lo envía en el **body** → el comentario nunca llega. Sin rol/ownership. Docstring dice `draft`, el código pone `REJECTED`. |
| POST | `/articles/{id}/assign-reviewer` | Bearer + ownership | `{reviewer_email}` (DTO inline) | `ArticleResponse` | **Parcial.** Sin guarda de estado (mueve incluso `PUBLISHED`→`in_review`); **no valida que el destinatario tenga rol `REVIEWER`**; `NotificationModel` creado inline. |

### Router `ai` (`backend/app/routers/ai.py`) — **TODO PÚBLICO (sin `Depends`)**

| Método | Ruta | Auth | Request | Response | Notas / Issues |
|---|---|---|---|---|---|
| GET | `/ai/models` | **NINGUNA** | — | `{models:[…]}` (sin `response_model`) | **Parcial.** Expone inventario de infra a cualquiera. |
| POST | `/ai/assist` | **NINGUNA** | `{article_id, user_prompt, selected_text?, article_context?}` | `AIAssistResponse {suggestion, sources, tokens_used, run_id, status}` | **Parcial.** Generación LLM libre/ilimitada; **RAG no-op** (`contexts=[]`); ignora `selected_text`/`article_context`/`article_id`. |
| POST | `/ai/ingest` | **NINGUNA** | `{article_id, source_id, text}` | `{status, task_id}` (sin `response_model`) | **Parcial.** Cualquiera escribe vectores arbitrarios en el Qdrant compartido (**envenenamiento RAG**); vectorizer no-semántico (hash de chars); respuesta `queued/task_id` engañosa (es síncrono). |
| POST | `/ai/format` | **NINGUNA** | `{article_id, text, format}` | `AIFormatResponse {formatted_text}` | **Parcial.** Llamada LLM sin auth; `article_id` aceptado pero no usado. **Existe en routers** (el inventario de docs lo daba por ausente). |

### Router `agents` (`backend/app/routers/agents.py`)

| Método | Ruta | Auth | Request | Response | Notas / Issues |
|---|---|---|---|---|---|
| POST | `/agents/{id}/run` | Bearer + ownership | `{flow_sequence:[str], agent_settings:dict}` | `{status:accepted}` (sin `response_model`) | **Parcial.** **`agent_settings` nunca se reenvía** al Orchestrator; `flow_sequence` sin allowlist; devuelve 200 (debería 202); no cambia a `in_review`. |
| GET | `/agents/{id}/runs` | Bearer + ownership | — | `AgentRunListResponse` | **Parcial.** Sin paginación; `tokens_used` siempre 0. |
| GET | `/agents/{id}/stream` | **`?token=`** + ownership | `?token` | SSE `text/event-stream` | **Parcial.** Token en query (fuga en logs); `active_streams` global in-process (rompe multi-worker); cola sin cota. |
| GET | `/agents/definitions` | Bearer | — | `dict` (sin `response_model`) | **Existe.** Correcto; el frontend no lo invoca (agentes hardcodeados). |
| GET | `/agents/claude-defs` | Bearer | — | `list` (sin `response_model`) | **Parcial.** IO de filesystem acoplado; directorio por rutas relativas dependientes del CWD; `try/except` que traga errores. |
| PUT | `/agents/claude-defs/{name}` | **solo logueado** | `{content}` | `dict` (sin `response_model`) | **Parcial — GRAVE.** `name` sin sanear en `agents_dir/f'{name}.md'` (**path traversal**); escritura guiada por cliente de los prompts del pipeline (prompt-injection/supply-chain); sin gate admin. |

### Router `flows` (`backend/app/routers/flows.py`) — patrón de ownership a replicar

| Método | Ruta | Auth | Request | Response | Notas / Issues |
|---|---|---|---|---|---|
| GET | `/flows` | Bearer (scoped) | — | `[SavedFlowResponse]` | **Parcial.** Solo falta paginación. |
| POST | `/flows` | Bearer (owner=caller) | `{name, nodes, edges, flow_sequence(≥1)}` | `SavedFlowResponse` (201) | **Existe.** Correcto. |
| GET | `/flows/{id}` | Bearer + ownership | — | `SavedFlowResponse` | **Existe.** **Patrón de ownership correcto** (404 si no es dueño) — replicar en `GET /articles/{id}`. |
| PUT | `/flows/{id}` | Bearer + ownership | parcial | `SavedFlowResponse` | **Existe.** Correcto. |
| DELETE | `/flows/{id}` | Bearer + ownership | — | 204 | **Existe.** Correcto. |

### Routers `config`, `notifications`, `checkpoints`, infra

| Método | Ruta | Auth | Request | Response | Notas / Issues |
|---|---|---|---|---|---|
| GET | `/config` | **solo logueado** | — | `dict` (sin `response_model`) | **Parcial.** Cualquier author lee config global con **posibles secretos** (`SECRET_KEY`, `DATABASE_URL`); ruta dependiente del CWD. Debe ser admin y redactar secretos. |
| PUT | `/config` | **solo logueado** | `dict` (sin validar) | `dict` (sin `response_model`) | **Parcial — GRAVE.** Sobreescribe config global con dict arbitrario sin schema, replicando a varias rutas (blast radius/DoS). Debe ser admin + schema Pydantic. |
| GET | `/notifications` | Bearer (scoped) | — | `[NotificationResponse]` | **Parcial.** Sin paginación. |
| POST | `/notifications/{id}/read` | Bearer + ownership | — | `NotificationResponse` | **Parcial.** 404 si ajena (correcto); `POST` para mutar un campo (PATCH sería más REST). |
| POST | `/checkpoints` | Bearer (owner=caller) | `{article_id?:UUID, state_json:dict}` | `CheckpointResponse` (201) | **Parcial.** **No valida** que `article_id` pertenezca al caller; sin retención. |
| GET | `/checkpoints/latest` | Bearer (scoped) | — | `CheckpointResponse` | **Parcial.** No filtra por `article_id`. |
| GET | `/health` | Pública | — | `{status, service}` | **Existe.** Fuera de `/api/v1` (cosmético). |

> **Transversal confirmado:** `main.py:22-28` configura CORS con `allow_origins=['*']` **y** `allow_credentials=True` (combinación inválida/insegura por spec CORS), y `SECRET_KEY` tiene default hardcodeado.

---

## 6. Consumo del frontend y discrepancias

| Llamada frontend | Endpoint backend | Estado | Discrepancia |
|---|---|---|---|
| `articlesApi.reject` envía `{comment}` en **body** (`articles.js:10`) | `POST /articles/{id}/reject` lee `comment` como **query** | **Roto** | El comentario nunca llega al backend (o el query obligatorio falla). Migrar backend a DTO de body. |
| `notificationsApi.markAllRead` → `POST /notifications/read-all` (`config.js:11`) | **No existe** | **Roto (404)** | Ruta inexistente; **404 garantizado** al usarse. Crear el endpoint. |
| `articlesApi.assignReviewer` envía `{reviewer_email}` (`articles.js:12`) | `POST /articles/{id}/assign-reviewer` | **Forma OK / semántica rota** | El backend **no valida rol `REVIEWER`** del destinatario ni el estado; DTO inline. |
| `articlesApi.get` (autenticado, con interceptor de token) | `GET /articles/{id}` (**sin auth**) | **Roto (seguridad)** | El frontend espera recurso protegido; el backend lo sirve público. |
| `authApi` (no maneja 401/refresh en `client.js`) | `POST /auth/refresh` | **Falta en ambos lados** | `create_refresh_token`/`REFRESH_TOKEN_EXPIRE_DAYS` existen, pero no hay endpoint ni `refresh_token` emitido → la sesión se cae al expirar. |
| `ArticleDetailPage` escribe el email del reviewer a mano | `GET /users/reviewers` | **Falta** | Sin lista de revisores; entrada manual frágil. |
| (ninguna llamada a `/api/v1/ai/*` en `frontend/src`) | `/ai/*` | **Superficie sin consumidor** | Router AI huérfano de UI (las docs Fase 1 lo requieren) **y** sin auth. |
| Auto-save del diseñador → `localStorage` (`flowStore.js`) | `/checkpoints`, `/checkpoints/latest` | **Sin consumidor** | Divergencia de estrategia (server vs cliente). |
| `agentsApi.getDefinitions` definido pero **nunca invocado** | `GET /agents/definitions` | **Deuda de cliente** | Agentes hardcodeados en 3 sitios; el endpoint funciona. |
| `agentsApi.getRuns` no se usa para rehidratar tras F5 | `GET /agents/{id}/runs` | **Deuda de cliente** | `ExecutionPage` queda sin pasos al recargar; el dato existe. |
| (sin lectura pública) | `/articles/{id}/view` + `/feed` | **Falta en ambos lados** | DESIGN §5.2 define `GET /articles/{id}/view` (`ArticlePublicView`) público; no existe, y hoy ese rol lo cumple —de forma insegura— `GET /articles/{id}`. |

---

## 7. Superficie de endpoints PROPUESTA por dominio

### 7.1 Autenticación

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| POST | `/auth/register` | Parcial | Pública | Registrar (rol `author`), devolver token + `refresh_token` | Media |
| POST | `/auth/login` | Parcial | Pública | Autenticar y emitir `access_token` + `refresh_token` | Media |
| GET | `/auth/me` | Parcial | Bearer | Perfil del usuario (incluye `role` para gating de UI) | Alta |
| POST | `/auth/refresh` | **Falta** | Refresh token | Rotar refresh → nuevo access (+refresh) | **Alta** |
| POST | `/auth/logout` | **Falta** | Bearer | Invalidar refresh/`jti` actual (denylist) | Media |
| POST | `/auth/dev/promote-reviewer` | Parcial | Bearer + flag DEBUG | Auto-promoción dev a reviewer | Media |

**Justificación.** `/auth/refresh` es **Alta**: las primitivas ya existen (`create_refresh_token`, `REFRESH_TOKEN_EXPIRE_DAYS`), DESIGN.md/fase1 lo especifican y hoy la sesión se cae al expirar el access token (el frontend no maneja 401). `login`/`register` deben emitir `refresh_token` (hoy ninguno lo hace). `dev/promote-reviewer` debe restringirse a DEBUG estricto (el flag está **ON por defecto**) y reemplazarse en producción por `PUT /users/{id}/role`. Toda la lógica inline debe moverse a `application/use_cases` (los `RegisterUseCase`/login del módulo muerto son reutilizables).

### 7.2 Usuarios

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/users/reviewers` | **Falta** | author/reviewer/admin | Listar reviewers para el selector de asignación | **Alta** |
| PUT | `/users/{id}/role` | **Falta** | admin | Asignar `reviewer`/`admin` a un usuario | **Alta** |
| GET | `/users` | Falta | admin | Listar usuarios con filtro/paginación SQL | Media |
| GET | `/users/{id}` | Falta | admin | Detalle de usuario | Baja |
| PATCH | `/users/{id}` | Falta | self o admin | Editar `full_name`/`email`/`is_active` | Baja |
| DELETE | `/users/{id}` | Falta | admin | Desactivar/eliminar usuario | Baja |

**Justificación.** `GET /users/reviewers` y `PUT /users/{id}/role` se elevan a **Alta** porque son la **raíz del RBAC**: hoy `reviewer` solo se obtiene por auto-escalada dev y `admin` es **inasignable**, de modo que toda la cadena de endpoints gateados por rol (approve/reject/publish/config/claude-defs) es inejecutable sin una vía legítima de asignar roles. `GET /users/reviewers` es además **co-requisito directo** de `assign-reviewer`, que hoy acepta cualquier email sin validar rol y obliga al frontend a escribir el email a ciegas.

### 7.3 Artículos (CRUD)

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/articles` | Parcial | Bearer (scoped) | Listar propios con filtro/paginación SQL | Alta |
| POST | `/articles` | Existe | Bearer (owner) | Crear artículo (`draft`) | Alta |
| GET | `/articles/{id}` | Parcial | Bearer + owner/reviewer asignado | Obtener artículo privado | **Alta** |
| PUT | `/articles/{id}` | Parcial | Bearer + ownership | Editar (solo `draft`/`rejected`) | Alta |
| DELETE | `/articles/{id}` | Falta | Bearer + ownership | Eliminar/archivar propio en `draft`/`rejected` | Baja |

**Justificación.** `GET /articles/{id}` es **Alta**: control de acceso roto (cualquier anónimo lee artículos ajenos). Debe scoparse como `GET /flows/{id}` (ownership en el `WHERE`, 404 si no es dueño o reviewer asignado); la lectura pública va por el **feed**, no por aquí. `PUT` necesita **guarda de estado** (solo `draft`/`rejected`) para no alterar texto publicado en silencio. `GET /articles` debe migrar a `select(func.count())` respetando filtros y validar `limit≥1`.

### 7.4 Flujo editorial / Revisión (máquina de estados + cola por rol)

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| POST | `/articles/{id}/submit` | Parcial | Bearer + ownership | `draft`/`rejected` → `in_review` (resubmit) | Alta |
| POST | `/articles/{id}/approve` | Parcial | reviewer/admin + asignado | `in_review` → **`approved`** (no publica) | Alta |
| POST | `/articles/{id}/reject` | Parcial | reviewer/admin + asignado | `in_review` → `rejected` con comentario (**body**) | Alta |
| POST | `/articles/{id}/publish` | **Falta** | reviewer/admin | `approved` → `published` (sella `published_at`) | **Alta** |
| POST | `/articles/{id}/assign-reviewer` | Parcial | Bearer + ownership | Asignar reviewer (validar rol) → `in_review` | Alta |
| POST | `/articles/{id}/request-changes` | **Falta** | reviewer/admin + asignado | Devolver al autor (`in_review` → `draft`) con feedback | Media |
| GET | `/reviews/queue` | **Falta** | reviewer/admin | Cola de `in_review` asignados (o todos para admin) | **Alta** |
| GET | `/articles/{id}/history` | Falta | owner/reviewer/admin | Historial auditable de transiciones | Baja |

**Justificación.** Este dominio concentra las violaciones de `state-machine.md`. `approve` debe parar en **`approved`** (no `PUBLISHED`) y gatearse por rol reviewer + `reviewer_id` asignado. `publish` (**Falta, Alta**) materializa `approved`→`published`: por DESIGN §2.3/§6.2 puede modelarse como **automático tras el `approve` humano** o como endpoint explícito; en **ambos** casos la publicación solo debe ocurrir tras un `approve` humano —hoy el agente publicador escribe `PUBLISHED` directo saltándose ese gate (**incumple ADR-004**). `reject` debe leer `comment` del **body** (corrige la discrepancia frontend); su estado destino debe reconciliarse (DESIGN dice `→ draft`; el código usa `→ rejected`). En cualquiera de las dos opciones, `submit` debe aceptar **resubmit** (desde `rejected` y/o `draft`) para cerrar el ciclo. `assign-reviewer` debe validar que el destinatario tenga rol `REVIEWER` y restringirse a `draft`/`rejected`. `GET /reviews/queue` (**Alta**) es imprescindible: `list_articles` está hard-scopeado a `author_id`, así que **hoy un reviewer no puede ver artículos ajenos** y el workflow de revisión carece de superficie de lectura. Se añade `request-changes` para diferenciar "pedir correcciones" (vuelta a `draft`) de "rechazar".

### 7.5 Asistencia IA (assist / ingest / format)

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/ai/models` | Parcial | Bearer | Listar modelos Ollama locales | Alta |
| POST | `/ai/assist` | Parcial | Bearer + ownership `article_id` | Sugerencia con RAG real + Ollama | Alta |
| POST | `/ai/ingest` | Parcial | Bearer + ownership `article_id` | Ingerir/vectorizar fuentes a Qdrant | Alta |
| POST | `/ai/format` | Parcial | Bearer | Reformatear a APA/IEEE/Vancouver | Alta |
| GET | `/ai/sources` | Falta | Bearer + ownership | Listar fuentes RAG por artículo | Baja |
| DELETE | `/ai/sources/{id}` | Falta | Bearer + ownership | Eliminar fuente RAG (limpiar Qdrant) | Baja |

**Justificación.** **Todo el router debe cerrar auth** (`Depends(get_current_user)`): hoy es público (abuso de LLM y, en `/ingest`, envenenamiento del Qdrant compartido para cualquier `article_id`). `/assist` y `/ingest` deben validar **ownership del `article_id`**; `/assist` debe implementar recuperación RAG real (hoy `contexts=[]`); aplicar **rate-limit** según docs (assist 20/10min, format 10/10min). El módulo hexagonal ya hace RAG real pero está muerto.

### 7.6 Agentes & Ejecución de pipeline

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| POST | `/agents/{id}/run` | Parcial | Bearer + ownership | Lanzar pipeline (BackgroundTask) | Alta |
| GET | `/agents/{id}/runs` | Parcial | Bearer + ownership | Historial de ejecuciones (paginado) | Media |
| GET | `/agents/{id}/runs/{run_id}` | **Falta** | Bearer + ownership | Estado/resultado de UN run por `run_id` | **Alta** |
| GET | `/agents/{id}/stream` | Parcial | Bearer (no en query) + ownership | SSE de progreso | Media |
| GET | `/agents/definitions` | Existe | Bearer | Definiciones estáticas de los 5 agentes | Baja |
| GET | `/agents/claude-defs` | Parcial | admin | Leer definiciones editables `.claude/agents/*.md` | Media |
| PUT | `/agents/claude-defs/{name}` | Parcial | **admin** | Actualizar definición (sanear `name`) | **Alta** |
| POST | `/agents/{id}/runs/{run_id}/cancel` | Falta | Bearer + ownership | Cancelar ejecución en curso | Baja |

**Justificación.** `GET /agents/{id}/runs/{run_id}` (**Falta, Alta**) es un hueco directo del modelo: `AgentRunModel` tiene `run_id` como PK con `status`/`output_payload`/`error_message`, y `assist`/`format` devuelven un `run_id` (`models.py:179,219`), pero **no hay forma de resolverlo** (solo el listado completo). `PUT /agents/claude-defs/{name}` (**Alta**) es la brecha más grave del router: `name` sin sanear permite **path traversal** y la escritura reescribe los prompts del pipeline; sanear con allowlist, gatear por **admin** y sacar IO/YAML a un servicio. En `run`, reenviar `agent_settings` al Orchestrator, validar `flow_sequence` contra allowlist y devolver **202**. Migrar el SSE a auth por cookie/subprotocol (fuera de la query) y a un bus Redis para multi-worker.

### 7.7 Flujos guardados (saved_flows)

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/flows` | Parcial | Bearer (scoped) | Listar propios (añadir paginación) | Baja |
| POST | `/flows` | Existe | Bearer (owner) | Crear flujo | Media |
| GET | `/flows/{id}` | Existe | Bearer + ownership | Obtener flujo propio | Media |
| PUT | `/flows/{id}` | Existe | Bearer + ownership | Actualizar parcial | Media |
| DELETE | `/flows/{id}` | Existe | Bearer + ownership | Eliminar flujo | Media |

**Justificación.** Subdominio mejor implementado; solo falta paginación en el listado. Su patrón de ownership (`WHERE author_id`, 404 si no es dueño) es el **modelo a replicar** en `GET /articles/{id}`.

### 7.8 Checkpoints

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| POST | `/checkpoints` | Parcial | Bearer (owner) + ownership `article_id` | Guardar checkpoint | Baja |
| GET | `/checkpoints/latest` | Parcial | Bearer (scoped) | Recuperar el más reciente (acepta `article_id?`) | Baja |
| GET | `/checkpoints` | Falta | Bearer + ownership | Listar (filtrable por `article_id`) | Baja |

**Justificación.** El frontend auto-guarda en `localStorage`, así que estos endpoints no tienen consumidor. Si se migra el auto-save al backend, `POST` debe validar que `article_id` pertenece al caller y conviene `list`/filtro por artículo (la FK existe pero nunca se consulta).

### 7.9 Notificaciones

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/notifications` | Parcial | Bearer (scoped) | Listar propias (paginado, `unread?`) | Media |
| POST | `/notifications/{id}/read` | Parcial | Bearer + ownership | Marcar una como leída | Media |
| POST | `/notifications/read-all` | **Falta** | Bearer (scoped) | Marcar todas como leídas | Media |
| GET | `/notifications/unread-count` | Falta | Bearer (scoped) | Conteo para el badge de la campana | Media |

**Justificación.** `read-all` (**Falta**) corrige una discrepancia real: el frontend llama `POST /notifications/read-all` (`config.js:11`) y hoy recibe **404**. Falta `unread-count` para el badge sin traer la lista completa. Además, las transiciones approve/reject/publish deben **emitir notificaciones** al autor (hoy solo `assign_reviewer` las crea).

### 7.10 Configuración

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/config` | Parcial | **admin** | Leer config runtime (secretos redactados) | Alta |
| PUT | `/config` | Parcial | **admin** | Actualizar config (schema Pydantic) | Alta |

**Justificación.** Ambos solo exigen estar logueado: cualquier author lee config global (incluido `SECRET_KEY`) y la sobreescribe con un dict arbitrario replicado a varias rutas (blast radius/DoS). Gatear por **admin**, validar con schema, **no devolver `SECRET_KEY` en claro** y resolver la ruta de forma independiente del CWD.

### 7.11 Publicación / Feed público

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/articles/{id}/view` | **Falta** | Pública (404 si no `published`) | Vista pública de un artículo (`ArticlePublicView`, DESIGN §5.2) | **Alta** |
| GET | `/feed` | **Falta** | Pública | Listar publicados de todos los autores (`q?`, paginado) | **Alta** |

**Justificación.** Hoy **no hay lectura pública**: `list_articles` está hard-scopeado a `author_id` y `GET /articles/{id}` es público pero sirve **cualquier** estado (inseguro). DESIGN §5.2 ya define `GET /articles/{id}/view` → `ArticlePublicView` (solo si `published`, con `author_name` desnormalizado); implementarlo y **reemplazar** con él el uso inseguro de `GET /articles/{id}` para lectura pública. `GET /feed` (lista pública paginada) es un añadido natural **no** presente en DESIGN. La búsqueda se resuelve con el query param `q` en estos listados en vez de un endpoint `/search` dedicado.

### 7.12 Media (portada `cover_url`)

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| POST | `/articles/{id}/cover` | Falta | Bearer + ownership | Subir portada (MinIO) y setear `cover_url` | Media |
| DELETE | `/articles/{id}/cover` | Falta | Bearer + ownership | Eliminar portada | Baja |

**Justificación.** `cover_url` es columna persistida pero **nunca escrita** por ningún endpoint/agente (huérfana); MinIO ya está configurado. Necesaria para que el feed muestre portadas reales.

### 7.13 Dashboard / Métricas

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/dashboard/stats` | Falta | Bearer (scoped) | KPIs: conteo por estado, runs recientes, no leídas | Media |
| GET | `/metrics/agents` | Falta | Bearer (propio) / admin | Agregar `tokens_used`, runs, duraciones, fallos | Baja |

**Justificación.** `DashboardPage` carece de KPIs. `/metrics/agents` requiere **primero poblar `tokens_used`** en `make_node_wrapper` (hoy siempre 0), o el dato será inútil.

### 7.14 Búsqueda

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| (param `q`) | en `/articles`, `/reviews/queue`, `/feed` | Falta | según endpoint | Búsqueda server-side por título/cuerpo | Baja |

**Justificación.** En lugar de un `GET /search` que sobredimensiona la superficie (el modelo no tiene tabla full-text), se recomienda añadir el query param `q` a los listados existentes. `ArticlesPage` hoy busca solo en cliente.

### 7.15 Salud / Infra

| Método | Ruta | Estado | Auth/Rol | Propósito | Prioridad |
|---|---|---|---|---|---|
| GET | `/health` | Existe | Pública | Health check | Baja |
| GET | `/readiness` | Falta | Pública | Comprobar BD/Ollama/Qdrant | Baja |

**Justificación.** `/health` está fuera de `/api/v1` (cosmético). Añadir `/readiness` que verifique dependencias.

---

## 8. Brechas críticas y nuevos endpoints recomendados (priorizado)

**P0 — Seguridad explotable (cerrar primero):**

1. **Cerrar auth de todo el router AI** (`/ai/models|assist|ingest|format`) — público hoy; abuso de LLM y envenenamiento RAG. Añadir `Depends` + ownership de `article_id` + rate-limit.
2. **`GET /articles/{id}` con ownership** — anónimos leen artículos ajenos. Scopear como `GET /flows/{id}`.
3. **`PUT /agents/claude-defs/{name}`: sanear `name` (allowlist) + gate admin** — path traversal y tamper de prompts del pipeline.
4. **`GET`/`PUT /config`: gate admin + schema + redacción de secretos** — lectura/escritura de config global por cualquier author.
5. **Gatear `approve`/`reject`/`assign-reviewer`/`publish` por rol reviewer + reviewer asignado** — hoy cualquier logueado publica/rechaza.
6. **Endurecer CORS** (`allow_origins` explícito sin `*` con credentials) y `SECRET_KEY` sin default.

**P1 — Coherencia funcional y RBAC:**

7. **`PUT /users/{id}/role` + `GET /users/reviewers` (Alta)** — raíz del RBAC; sin esto nada gateado por rol es ejecutable, y `assign-reviewer` no puede validar al destinatario.
8. **Alinear máquina de estados:** `approve`→`approved` (no directo a `published`); materializar `approved`→`published` (endpoint `POST /articles/{id}/publish` **o** auto tras approve, per DESIGN §2.3), **siempre tras un approve humano**; `submit` acepta resubmit; el agente publicador deja de escribir `PUBLISHED` directo (ADR-004).
9. **`GET /reviews/queue` (Alta)** — sin esto el reviewer no ve artículos ajenos para revisarlos.
10. **`POST /auth/refresh` (Alta)** + emitir `refresh_token` en login/register — la sesión se cae al expirar.
11. **`POST /notifications/read-all`** — corrige 404 garantizado; añadir `unread-count`.
12. **`reject` lee `comment` del body** — corrige la discrepancia frontend (comentario perdido).
13. **`GET /agents/{id}/runs/{run_id}` (Alta)** — resolver un run individual (hoy imposible).
14. **`GET /feed` + `GET /articles/{id}/view` (Alta)** — cara pública del producto (DESIGN §5.2, `ArticlePublicView`); reemplaza el uso inseguro de `GET /articles/{id}`.

**P2 — Completitud y observabilidad:**

15. Guarda de estado en `PUT /articles` y `assign-reviewer` (solo `draft`/`rejected`); validar rol del reviewer destinatario.
16. `POST/DELETE /articles/{id}/cover` (MinIO) para portadas reales en el feed.
17. `/dashboard/stats` y `/metrics/agents` (tras **poblar `tokens_used`**).
18. Paginación real en `flows`, `notifications`, `agent_runs`, `checkpoints`.
19. `/articles/{id}/history` y `request-changes`; `runs/{run_id}/cancel`; retención/purga de `agent_runs`.

---

## 9. Recomendaciones de arquitectura

- **Unificar routers vs módulos (una sola implementación).** No dejar ambos árboles: induce a error, duplica la máquina de estados y arriesga divergencia de esquema. **Opción pragmática B (recomendada dado el estado):** borrar `app/modules/*` y los shims `app/{auth,articles,ai}`, quedarse con `app/routers/*` (que además tiene endpoints que el módulo no replica: `assign-reviewer` con notificaciones, `/ai/format`, filtros por status). **Opción A:** completar la migración (dotar de use cases a `ai`, unificar a una sola `Base`, portar endpoints faltantes, cablear los routers del módulo y borrar los viejos). Cualquiera, pero **una sola**.
- **Capa de casos de uso** (regla `fastapi-style.md`). Introducir `application/use_cases` entre routers y persistencia; sacar de los routers el acceso a BD, IO de archivos, parsing YAML, mint de tokens, creación de notificaciones, extracción de keywords y transiciones de estado. Los use cases del módulo muerto (`RegisterUseCase`, `ApproveArticleUseCase` con approve+publish separados, etc.) son reutilizables si se migra.
- **RBAC por rol.** Crear dependencias reutilizables `require_role('reviewer'|'admin')` y `require_owner_or_role`, y aplicarlas a approve/reject/publish (reviewer/admin + reviewer asignado), claude-defs PUT y `/config` (admin), `/users/*` (admin). Reemplazar `/auth/dev/promote-reviewer` por `PUT /users/{id}/role` en producción; restringir el endpoint dev a DEBUG estricto (hoy está **ON por defecto**).
- **Máquina de estados centralizada.** Validar transiciones en un servicio de dominio (la entidad `Article` del módulo muerto ya tiene esta lógica). Reintroducir `approved`; el agente publicador debe *proponer/encolar*, no publicar.
- **Paginación real.** Migrar `list_articles` a `select(func.count())` respetando filtros y validar `limit≥1`; añadir paginación a flows, notifications, agent_runs y checkpoints.
- **Feed público y media.** Añadir `/feed*` (solo `published`) y subida de portada a MinIO (`cover_url` huérfana).
- **Ejecución/estado de agentes y multi-worker.** Mover el pub/sub SSE a **Redis** (ya contemplado en DESIGN.md) y el token fuera de la query; añadir consulta por `run_id`. Reenviar `agent_settings` al Orchestrator y validar `flow_sequence` contra allowlist.
- **Métricas.** Poblar `tokens_used` en `make_node_wrapper` antes de exponer dashboard/métricas, o el dato será siempre 0.
- **Config unificada.** El `config.yaml` **raíz** declara `qdrant.vector_size: 1536` (embeddings tipo `nomic-embed-text`), pero el fallback de `core/config.py` es `RAG_VECTOR_SIZE=64` y `backend/config.yaml` está **vacío**; además el `_vectorize_text` de `ai.py` es un hash de caracteres no-semántico (no produce embeddings reales). Unificar la fuente de verdad y el tamaño de vector **antes** de activar embeddings reales en `/ai/ingest`, o las dimensiones no cuadrarán con la colección Qdrant.
- **Tipado OpenAPI.** Añadir `response_model` a `/health`, `/ai/models`, `/ai/ingest`, `/agents/definitions`, `/agents/claude-defs[/{name}]`, `/agents/{id}/run`, `/config` GET+PUT.

---

## 10. Roadmap sugerido por fases

| Fase | Objetivo | Endpoints / cambios | Estado origen |
|---|---|---|---|
| **P0 — Seguridad** | Cerrar brechas explotables | Auth en todo `/ai/*`; ownership en `GET /articles/{id}`; sanear+admin en `PUT claude-defs/{name}`; admin+schema+redacción en `GET/PUT /config`; gate de rol en approve/reject/assign/publish; endurecer CORS y `SECRET_KEY` | Parcial → corregido |
| **P0 — RBAC base** | Habilitar autorización por rol | `PUT /users/{id}/role`, `GET /users/reviewers`; `require_role`/`require_owner_or_role`; restringir dev-promote a DEBUG | Falta (Alta) |
| **P1 — Máquina de estados** | Alinear con `state-machine.md` | `approve`→`approved`; **`POST /articles/{id}/publish`**; `submit` resubmit desde `rejected`; guardas de estado en `PUT`/`assign`; agente publicador deja de publicar directo; `request-changes` | Parcial + Falta |
| **P1 — Revisión & sesión** | Workflow de reviewer y sesión estable | `GET /reviews/queue`; `POST /auth/refresh` + emitir `refresh_token`; `GET /agents/{id}/runs/{run_id}`; emitir notificaciones en transiciones | Falta (Alta) |
| **P1 — Discrepancias FE↔BE** | Cerrar contratos rotos | `reject` body `{comment}`; `POST /notifications/read-all` + `unread-count`; validar rol en `assign-reviewer` | Parcial/Falta |
| **P1 — Público** | Cara pública del producto | `GET /feed`, `GET /articles/{id}/view` (solo `published`) | Falta (Alta) |
| **P2 — Completitud** | Cerrar el modelo de dominio | `/users` CRUD; `DELETE /articles/{id}`; `/articles/{id}/cover` (MinIO); `/ai/sources*`; `/checkpoints` list; `/articles/{id}/history`; `runs/{run_id}/cancel` | Falta |
| **P2 — Observabilidad** | KPIs y métricas | Poblar `tokens_used`; `/dashboard/stats`; `/metrics/agents`; `/readiness` | Falta |
| **P2 — Calidad** | Consultas y tipado | Paginación SQL real; `response_model` en todos; param `q` en listados; SSE sobre Redis | Parcial |

---

## 11. Anexo: convenciones

- **Versionado.** Todas las rutas bajo `/api/v1`. Reubicar `/health` (y nuevo `/readiness`) bajo el prefijo o documentar explícitamente la excepción.
- **Autenticación.** `Authorization: Bearer <access_token>`. Access token de vida corta + `refresh_token` (rotación vía `POST /auth/refresh`). El JWT incluye `user_id`, `role` y `jti` (para denylist en logout). **Nunca** pasar tokens en la query string (migrar el SSE a cookie/subprotocol).
- **Autorización.** Dependencias `require_role('reviewer'|'admin')` y `require_owner_or_role`. Recursos privados devuelven **404** (no 403) cuando el solicitante no es dueño ni tiene rol, para no filtrar existencia (patrón ya correcto en `flows`).
- **Formato de errores.** Respuesta JSON consistente: `{ "detail": "<mensaje>", "code": "<slug>" }`. Mapear: `401` (sin/inválido token, incluido UUID malformado en `/auth/me`), `403` (rol insuficiente), `404` (no encontrado/ajeno), `409` (transición de estado inválida), `422` (validación Pydantic), `429` (rate-limit IA).
- **Paginación.** Query `?skip=0&limit=N` (validar `1 ≤ limit ≤ 100`). Respuesta envolvente `{ items, total, page, size, pages }` con `total` calculado vía `select(func.count())` **respetando los filtros aplicados**.
- **Rate-limiting (IA).** `/ai/assist` 20/10min, `/ai/format` 10/10min por usuario (según docs Fase 1).
- **Estados de artículo.** `draft` → `in_review` → `approved` → `published`; `in_review` → `rejected`; `rejected`/`draft` → `in_review` (resubmit). La publicación es **siempre** acción humana (`POST /articles/{id}/publish`), nunca efecto colateral de un agente.
- **Tipado.** Todo endpoint declara `response_model`; los DTOs viven en `schemas/`, no inline en routers.

---

*Fin del documento.*