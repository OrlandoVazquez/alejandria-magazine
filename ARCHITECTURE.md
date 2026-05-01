# Arquitectura - Version simplificada

## Objetivo

Reducir complejidad para poder levantar y probar el flujo principal con `docker compose up --build` sin dependencias extra.

## Runtime actual

```
frontend (HTML estatico) --> backend (FastAPI) --> postgres
                                         |
                                         +--> qdrant (RAG)
                                         |
                                         +--> ollama (modelos locales)
```

Servicios en `docker-compose.yml`:
1. `postgres`
2. `qdrant`
3. `ollama`
4. `backend`
5. `frontend`

## Arquitectura de backend

Se conserva un enfoque modular inspirado en hexagonal:

```
app/
├── core/                 # config y seguridad
├── shared/               # database/session
└── modules/
    ├── auth/
    │   ├── domain/
    │   ├── application/
    │   └── adapters/
    └── articles/
        ├── domain/
        ├── application/
        └── adapters/
```

Regla de dependencias:

```
adapters -> application -> domain
```

## Endpoints del flujo

Auth:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/dev/promote-reviewer` (solo DEBUG)

Articles:
- `GET /api/v1/articles`
- `POST /api/v1/articles`
- `GET /api/v1/articles/{id}`
- `PUT /api/v1/articles/{id}`
- `POST /api/v1/articles/{id}/submit`
- `POST /api/v1/articles/{id}/approve`
- `POST /api/v1/articles/{id}/reject`

Health:
- `GET /health`

AI:
- `POST /api/v1/ai/ingest`
- `POST /api/v1/ai/assist`
- `GET /api/v1/ai/models`

## Flujo frontend replicado desde `fase1.html`

1. Login / registro
2. Dashboard
3. Fuentes RAG (indexar y consultar)
4. Redaccion en editor
5. Asistencia IA y aplicacion de sugerencias
6. Formato cientifico y guardado de borrador
7. Envio a revision
8. Revision (aprobar/rechazar)
9. Publicacion

Implementacion actual:
- Integracion real con backend para auth, articulos y RAG.
- Revision y publicacion usan backend real con token reviewer (sin fallback local).
- El frontend permite elegir modelos locales de Ollama para el endpoint `assist`.
