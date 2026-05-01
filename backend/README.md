# Backend - Arquitectura simplificada

Este backend mantiene una arquitectura modular (domain/application/adapters), pero con un alcance reducido para levantar rapido en Docker Compose y ejecutar el flujo principal de articulos.

## Estructura actual

```
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   ├── shared/
│   │   └── database.py
│   └── modules/
│       ├── auth/
│       │   ├── domain/
│       │   ├── application/
│       │   └── adapters/
│       └── articles/
│           ├── domain/
│           ├── application/
│           └── adapters/
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Endpoints necesarios para el flujo

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/dev/promote-reviewer` (solo DEBUG, para demo end-to-end)

### Articles
- `GET /api/v1/articles` (lista articulos del autor autenticado)
- `POST /api/v1/articles` (crear borrador)
- `GET /api/v1/articles/{id}`
- `PUT /api/v1/articles/{id}`
- `POST /api/v1/articles/{id}/submit`
- `POST /api/v1/articles/{id}/approve`
- `POST /api/v1/articles/{id}/reject`

### Health
- `GET /health`

### AI (RAG minimo con Qdrant)
- `POST /api/v1/ai/ingest`
- `POST /api/v1/ai/assist`
- `GET /api/v1/ai/models` (modelos locales Ollama)

## Ejecutar en local (sin Docker)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Ejecutar con Docker Compose

Desde la raiz del proyecto:

```bash
docker compose up --build
```

## Configuracion global

El backend carga configuracion desde `config.yaml` (archivo en la raiz del repo).

En Docker, ese archivo se monta en:
- `/app/config.yaml`

Prioridad de configuracion:
1. Variables de entorno (`ENV`)
2. `config.yaml`
3. Defaults en `app/core/config.py`

Servicios disponibles:
- API FastAPI: `http://localhost:8000`
- Docs OpenAPI: `http://localhost:8000/docs`
- Frontend HTML simple: `http://localhost:8080`
- Ollama local: `http://localhost:11434`
