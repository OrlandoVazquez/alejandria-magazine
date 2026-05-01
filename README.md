# Alejandria Magazine

Version simplificada para levantar rapido con Docker Compose y ejecutar el flujo completo:
autenticacion -> redaccion -> RAG -> revision -> publicacion.

## Servicios (docker-compose)

- `postgres`: persistencia de usuarios y articulos
- `qdrant`: almacenamiento vectorial para RAG
- `ollama`: modelos LLM locales
- `backend`: API FastAPI
- `frontend`: demo HTML conectada al backend

## Estructura de carpetas (actual)

```text
alejandria_magazine/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── shared/
│   │   │   └── database.py
│   │   └── modules/
│   │       ├── auth/
│   │       │   ├── domain/
│   │       │   ├── application/
│   │       │   └── adapters/
│   │       ├── articles/
│   │       │   ├── domain/
│   │       │   ├── application/
│   │       │   └── adapters/
│   │       └── ai/
│   │           └── adapters/
│   │               └── http.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── Dockerfile
│   └── index.html
├── requirements.txt
├── config.yaml
├── infrastructure/
├── ARCHITECTURE.md
├── DESIGN.md
└── docker-compose.yml
```

## Endpoints principales

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/dev/promote-reviewer` (solo DEBUG, para demo)

### Articles
- `GET /api/v1/articles`
- `POST /api/v1/articles`
- `GET /api/v1/articles/{id}`
- `PUT /api/v1/articles/{id}`
- `POST /api/v1/articles/{id}/submit`
- `POST /api/v1/articles/{id}/approve` (reviewer/admin)
- `POST /api/v1/articles/{id}/reject` (reviewer/admin)

### AI / RAG
- `POST /api/v1/ai/ingest`
- `POST /api/v1/ai/assist` (usa Qdrant + Ollama)
- `GET /api/v1/ai/models` (modelos locales disponibles en Ollama)

### Health
- `GET /health`

## Flujo del frontend (`frontend/index.html`)

1. Registro/login de autor
2. Dashboard y listado de articulos
3. Ingesta de fuentes en Qdrant
4. Consulta RAG y sugerencias en editor
5. Crear/guardar borrador
6. Enviar a revision
7. Login de reviewer (o promocion DEBUG)
8. Aprobar o rechazar desde backend real
9. Publicacion

## Levantar proyecto

```bash
docker compose up --build
```

## Configuracion global (`config.yaml`)

Existe un archivo global `config.yaml` en la raiz para gestionar parametros y accesos:

- `app` (nombre, version, debug)
- `security` (secret, algoritmo, expiraciones)
- `access_control` (flags de acceso como promocion de reviewer)
- `database`, `qdrant`, `ollama`, `redis`, `minio`

Reglas:
- El backend lo lee al iniciar.
- Variables de entorno siguen teniendo prioridad sobre `config.yaml`.
- El root `requirements.txt` referencia `backend/requirements.txt` para mantener un archivo de dependencias global.
- En Docker se monta como `./config.yaml:/app/config.yaml:ro`.

### Cargar modelo local en Ollama (primera vez)

```bash
docker compose exec ollama ollama pull llama3.2
```

## URLs

- Frontend: `http://localhost:8080`
- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`
- Ollama: `http://localhost:11434`
- Qdrant: `http://localhost:6333`

## Persistencia

- Usuarios y articulos: volumen `postgres_data`
- Vectores RAG: volumen `qdrant_data`
- Modelos locales: volumen `ollama_data`
