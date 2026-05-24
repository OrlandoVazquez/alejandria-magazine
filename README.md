# 🏛️ AlexandrIA Magazine

> Plataforma agéntica de redacción científica asistida por IA.

**AlexandrIA Magazine** es un ecosistema editorial inteligente diseñado para investigadores y editores.  
Cada usuario dispone de un **espacio de trabajo personal** donde puede diseñar, secuenciar y modular flujos multi-agente mediante un panel visual interactivo (**Flow Designer**).

Toda la orquestación y gestión de estados se ejecuta dinámicamente en el backend usando **LangGraph**.

---

# ✨ Características Principales

- 🎨 **Flow Designer dinámico**
  Construcción visual de flujos personalizados mediante nodos y conexiones.

- 🤖 **Ecosistema multi-agente**
  - Investigador
  - Redactor
  - Revisor
  - Formateador
  - Publicador

- 🔄 **Orquestación flexible con LangGraph**
  El backend compila el grafo dinámicamente según la configuración enviada por el frontend.

- 🔍 **RAG local con Qdrant + Ollama**
  Recuperación contextual e indexación semántica privada.

- 📚 **Ciclo de vida editorial**

```text
draft → in_review → approved → published
```

- 🔐 **Autenticación basada en JWT**
  - `author`
  - `reviewer`
  - `admin`

- ⚡ **Stack moderno**
  - FastAPI
  - React + Vite
  - PostgreSQL
  - Qdrant
  - Ollama

- ⚙️ **Configuración centralizada**
  Todos los parámetros globales viven en `config.yaml`.

- 🐳 **Infraestructura reproducible**
  Entorno completo mediante `docker compose`.

---

# 🤖 Arquitectura Agéntica

Al iniciar sesión, el usuario accede a un entorno de trabajo donde puede construir su propio flujo de IA desde el **Flow Designer**.

## Agentes Disponibles

| Agente | Función | Input | Output |
|---|---|---|---|
| 🔍 **Investigador** | Extrae fuentes y construye contexto RAG | `article_id`, `keywords` | `research_data`, `sources[]` |
| ✍️ **Redactor** | Genera y mejora borradores científicos | `article_id`, `research_data` | `draft_text`, `suggestions[]` |
| 👁️ **Revisor** | Verifica calidad, sesgos y cumplimiento | `article_id`, `draft_text` | `feedback[]`, `approval_score` |
| 📋 **Formateador** | Adapta el artículo a formatos científicos | `article_id`, `format_type` | `formatted_text` |
| 🚀 **Publicador** | Publica y genera metadatos | `article_id` | `published_url`, `metadata` |
| 🎭 **Orquestador** | Construye y ejecuta el grafo dinámico | `State`, `flow_sequence` | Siguiente nodo |

---

# 🔄 Ejemplos de Flujos

## Flujo Editorial Completo

```text
[START]
   ↓
Investigador
   ↓
Redactor
   ↓
Revisor
   ↓
Formateador
   ↓
Publicador
   ↓
[END]
```

## Flujo de Curación

```text
[START]
   ↓
Revisor
   ↓
Formateador
   ↓
[END]
```

## Flujo de Investigación

```text
[START]
   ↓
Investigador
   ↓
Redactor
   ↓
[END]
```

El orquestador basado en **LangGraph** soporta:

- Loops condicionales
- Reintentos
- Validaciones
- Ruteo dinámico entre nodos

Ejemplo:

```text
Revisor → Redactor
(si approval_score < threshold)
```

---

# 🛠️ Servicios (`docker-compose.yml`)

| Servicio | Puerto | Tecnología | Propósito |
|---|---|---|---|
| `postgres` | `5432` | PostgreSQL | Persistencia relacional |
| `qdrant` | `6333` | Qdrant | Vector DB para RAG |
| `ollama` | `11434` | Ollama | Inferencia local LLM |
| `backend` | `8000` | FastAPI | API REST + LangGraph |
| `frontend` | `8080` | React + Vite | Dashboard y Flow Designer |

---

# 📂 Estructura del Proyecto

```text
alejandria-magazine/
├── README.md
├── CLAUDE.md
├── design.md
├── config.yaml
│
├── .claude/
│   ├── settings.json
│   ├── rules/
│   │   ├── fastapi-style.md
│   │   ├── react-rules.md
│   │   └── state-machine.md
│   └── agents/
│       ├── investigador.md
│       ├── redactor.md
│       ├── revisor.md
│       ├── formateador.md
│       ├── publicador.md
│       └── orquestador.md
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── core/
│   │   ├── shared/
│   │   ├── agents/
│   │   │   ├── orquestador.py
│   │   │   ├── investigador.py
│   │   │   ├── redactor.py
│   │   │   ├── revisor.py
│   │   │   ├── formateador.py
│   │   │   └── publicador.py
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── articles.py
│   │       ├── agents.py
│   │       └── ai.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── index.html
│
└── docker-compose.yml
```

---

# 🔌 API Principal

## 🔐 Autenticación

Base path:

```text
/api/v1/auth
```

### Endpoints
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/register` | Registro de nuevo usuario y generación de JWT inicial |
| `POST` | `/login` | Validación de credenciales y generación de JWT de acceso |
| `GET` | `/me` | Retorna los datos y rol del perfil del usuario autenticado |

### 🔄 Flujo de Autenticación y Autorización
El backend implementa un flujo de autenticación seguro y sin estado mediante JSON Web Tokens (JWT):

1. **Generación del Token**:
   Al registrarse o iniciar sesión con éxito, se genera un token de acceso firmado con el algoritmo **HS256** y una clave secreta (`SECRET_KEY`).
   La estructura del payload del token incluye los siguientes campos (claims):
   - `user_id`: Identificador único (UUID) del usuario.
   - `email`: Correo electrónico del usuario.
   - `role`: Rol del usuario (`author`, `reviewer`, `admin`).
   - `type`: Tipo de token (`access`).
   - `jti`: Identificador de JWT único (UUIDv4) generado dinámicamente para garantizar la unicidad absoluta de cada token emitido.
   - `exp`: Tiempo de expiración calculado dinámicamente (por defecto, 30 minutos).

2. **Envío y Validación**:
   - El cliente recibe el token y lo almacena para sus posteriores peticiones.
   - Para acceder a recursos protegidos, el cliente debe incluir el token en la cabecera HTTP:
     ```text
     Authorization: Bearer <JWT_TOKEN>
     ```
   - El backend valida el token decodificándolo y verificando la firma. A través de la dependencia `get_current_user`, comprueba la integridad y expiración del token, inyectando los datos de identidad y el rol en las rutas protegidas.

---

## 📝 Artículos

Base path:

```text
/api/v1/articles
```

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/` | Lista artículos del usuario |
| `POST` | `/` | Crear artículo |
| `GET` | `/{id}` | Obtener artículo |
| `PUT` | `/{id}` | Actualizar artículo |

---

## 🤖 IA y Orquestación

Base paths:

```text
/api/v1/ai
/api/v1/agents
```

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/ai/ingest` | Ingesta documental hacia Qdrant |
| `POST` | `/ai/assist` | Asistencia síncrona con Ollama |
| `POST` | `/agents/{article_id}/run` | Ejecutar flujo LangGraph |

---

# 📦 Payload de Ejecución Dinámica

```json
{
  "flow_sequence": [
    "investigador",
    "revisor",
    "formateador"
  ],
  "agent_settings": {
    "revisor": {
      "strict_mode": true
    },
    "formateador": {
      "style": "APA"
    }
  }
}
```

---

# 🔄 Flujo End-to-End

```text
Login / Registro
        ↓
Dashboard Personal
        ↓
Seleccionar Artículo
        ↓
┌──────────────────────────────────────────────┐
│ 1. Ingesta Contextual                       │
│    POST /ai/ingest                          │
└──────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────┐
│ 2. Diseñar Enjambre                         │
│    Flow Designer                            │
└──────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────┐
│ 3. Ejecutar Flujo                           │
│    POST /agents/{id}/run                    │
└──────────────────────────────────────────────┘
        ↓
Reporte + Historial
```

---

# 🚀 Desarrollo Local

## Requisitos

- Docker
- Docker Compose V2

---

## Levantar el Entorno

### 1. Clonar el repositorio

```bash
git clone https://github.com/luxinopanyvino/alejandria-magazine.git
cd alejandria-magazine
```

### 2. Construir servicios

```bash
docker compose up --build -d
```

### 3. Descargar modelo Ollama

```bash
docker compose exec ollama ollama pull llama3.2
```

---

# 🌐 URLs Locales

| Servicio | URL |
|---|---|
| Frontend | `http://localhost:8080` |
| Swagger UI | `http://localhost:8000/docs` |
| Qdrant Dashboard | `http://localhost:6333/dashboard` |

---

# ⚙️ Configuración Global (`config.yaml`)

```yaml
app:
  name: "Alejandria Magazine"
  version: "0.1.0"
  api_prefix: "/api/v1"
  debug: false

security:
  algorithm: "HS256"
  access_token_expire_minutes: 30

database:
  url: "postgresql+asyncpg://postgres:password@localhost:5432/alejandria"

qdrant:
  url: "http://localhost:6333"
  collection: "rag_docs"
  vector_size: 1536

ollama:
  base_url: "http://localhost:11434"
  default_model: "llama3.2"
  temperature: 0.3

editorial_rules:
  min_approval_score: 80
  allow_custom_topology: true
```

## Prioridad de Configuración

```text
.env > config.yaml > valores por defecto
```

---

# 🧠 Notas de Desarrollo

Este repositorio incluye configuración nativa para asistentes agénticos de desarrollo.

Antes de contribuir:

1. Revisar `design.md`
2. Revisar `CLAUDE.md`
3. Validar reglas en `.claude/rules`
4. Verificar convenciones de FastAPI y React

---

# 📜 Licencia


```text
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright (c) 2026 AlexandrIA Magazine

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.

You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
