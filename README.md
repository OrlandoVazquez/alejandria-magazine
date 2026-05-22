# 🏛️ AlexandrIA Magazine

**Plataforma agéntica de redacción científica asistida por IA.**

AlexandrIA Magazine es un ecosistema editorial inteligente diseñado para investigadores y editores. Tras loguearse, cada usuario accede a su propio **espacio de trabajo personal**, donde en lugar de usar un flujo rígido y predefinido, dispone de un panel interactivo (**Flow Designer**) para diseñar, secuenciar y modular la ruta del enjambre multi-agente antes de su ejecución. Toda la orquestación y el paso de estados dinámicos se gestionan en el backend mediante **LangGraph**.

**Características clave:**
- 🎨 **Diseño de Flujo Dinámico (Flow Designer):** El usuario arrastra, activa y secuencia los agentes disponibles a su medida antes de lanzar el proceso.
- 🤖 **Ecosistema Multi-Agente:** 5 agentes especialistas a disposición del usuario (`Investigador`, `Redactor`, `Revisor`, `Formateador`, `Publicador`).
- 🔄 **Orquestación Flexible con LangGraph:** Compilación dinámica del grafo en el backend basándose en la configuración de nodos y enlaces provista por el frontend.
- 🔍 **RAG de Conocimiento Local:** Recuperación de información contextualizada e indexación semántica mediante Qdrant + Ollama.
- 📚 **Ciclo de Vida Editorial:** Gestión estricta del estado de los documentos (`draft` → `in_review` → `approved` → `published`).
- 🔐 **Autenticación y Aislamiento por Token:** Seguridad mediante JWT con control estricto de roles (`author`, `reviewer`, `admin`).
- ⚡ **Stack Moderno y Asíncrono:** Backend con FastAPI (Python), Frontend interactivo con React (Vite), PostgreSQL y Qdrant Vector DB.
- ⚙️ **Configuración Unificada:** Parámetros y umbrales globales de los agentes centralizados en un archivo `config.yaml`.
- 🐳 **Entorno Determinista:** Despliegue unificado de toda la infraestructura local mediante `docker compose`.

---

## 🤖 El Espacio Agéntico Personal (Orquestación LangGraph Dinámica)

Al iniciar sesión en el Dashboard, el usuario dispone de una caja de herramientas de IA (*Toolbox*). El usuario selecciona qué nodos se activan y traza la ruta de ejecución que se inyectará al backend de manera asíncrona.

| Agente | Nodo en el Canvas del Usuario | Input Técnico | Output Técnico |
|---|---|---|---|
| **🔍 Investigador** | Examina palabras clave, extrae fuentes e indexa contexto en el RAG. | `article_id`, `keywords` | `research_data`, `sources[]` |
| **✍️ Redactor** | Genera borradores científicos, expande ideas y aplica mejoras estructurales. | `article_id`, `research_data` | `draft_text`, `suggestions[]` |
| **👁️ Revisor** | Evalúa la veracidad, detecta sesgos y mide el cumplimiento de políticas. | `article_id`, `draft_text` | `feedback[]`, `approval_score` |
| **📋 Formateador** | Adapta la sintaxis y citas al estándar científico requerido (APA, IEEE, etc.). | `article_id`, `format_type` | `formatted_text` |
| **🚀 Publicador** | Genera metadatos de indexación, congela el estado final y publica el artículo. | `article_id` | `published_url`, `metadata` |
| **🎭 Orquestador** | Construye el grafo dinámicamente con LangGraph y rutea según la secuencia del usuario. | `State` + `flow_sequence` | Siguiente nodo dinámico |

### 🔄 Ejemplos de Configuración de Flujos

Gracias al constructor modular, el usuario puede parametrizar y ejecutar flujos según la necesidad del artículo:

* **Flujo Completo E estándar:**
    `[START] ➔ Investigador ➔ Redactor ➔ Revisor ➔ Formateador ➔ Publicador ➔ [END]`
* **Flujo Rápido de Curación y Formateo (Para textos ya escritos):**
    `[START] ➔ Revisor ➔ Formateador ➔ [END]`
* **Flujo de Investigación Profunda:**
    `[START] ➔ Investigador ➔ Redactor ➔ [END]`

El **Orquestador basado en LangGraph** lee la secuencia enviada por el cliente y gestiona de forma nativa los *Feedback Loops* condicionales (ej. Revisor ➔ Redactor si el `approval_score` es bajo) solo en los nodos que participan en el diseño actual.

---

## 🛠️ Servicios del Sistema (`docker-compose.yml`)

| Servicio | Puerto | Componente del Stack | Propósito del Entorno |
|---|---|---|---|
| `postgres` | 5432 | PostgreSQL (Asyncpg) | Persistencia relacional de usuarios, artículos y trazas dinámicas del grafo. |
| `qdrant` | 6333 | Qdrant Vector DB | Almacenamiento y búsqueda semántica de vectores para el pipeline RAG. |
| `ollama` | 11434 | Ollama (Local LLM) | Inferencia local y privada de los modelos de lenguaje (ej. `llama3.2`). |
| `backend` | 8000 | FastAPI Server | Endpoints REST asíncronos, inyección de dependencias y motor de LangGraph. |
| `frontend` | 8080 | React + Vite Dashboard | Canvas de diseño interactivo de agentes, Panel IA y editor de texto. |

---

## 📂 Estructura del Repositorio

```text
alejandria-magazine/
├── README.md                        # Este archivo (Guía general de la plataforma)
├── CLAUDE.md                        # Instrucciones operativas y comandos rápidos para el desarrollo con CLI
├── design.md                        # Especificaciones de arquitectura técnica y flujos lógicos de IA
├── config.yaml                      # Parámetros, modelos de LLM y umbrales de configuración global
│
├── .claude/                         # Configuración, contexto y gobernanza para asistentes de código
│   ├── settings.json                # Permisos del agente de desarrollo
│   ├── rules/
│   │   ├── fastapi-style.md         # Reglas de desarrollo: async, Pydantic v2, routers limpios
│   │   ├── react-rules.md           # Reglas de diseño: hooks funcionales, canvas interactivo, Tailwind
│   │   └── state-machine.md         # Definición de los estados del ciclo de vida del artículo
│   └── agents/                      # Prompts de sistema que definen los perfiles de los agentes virtuales
│       ├── investigador.md
│       ├── redactor.md
│       ├── revisor.md
│       ├── formateador.md
│       ├── publicador.md
│       └── orquestador.md
│
├── backend/                         # Servidor de Aplicación (FastAPI + LangGraph)
│   ├── app/
│   │   ├── main.py                  # Punto de entrada de FastAPI, Middlewares CORS y registro de rutas
│   │   ├── models.py                # Modelos consolidados de DB (SQLAlchemy) y DTOs/Validaciones (Pydantic)
│   │   ├── core/                    # Configuración estricta (pydantic-settings) y seguridad (JWT, Hasheo)
│   │   ├── shared/                  # Conexiones compartidas de infraestructura (Base de datos, Qdrant)
│   │   ├── agents/                  # IMPLEMENTACIÓN DEL MOTOR MULTI-AGENTE (Nodos LangGraph)
│   │   │   ├── __init__.py
│   │   │   ├── orquestador.py       # Compilación DINÁMICA del grafo basada en la secuencia de entrada
│   │   │   ├── investigador.py
│   │   │   ├── redactor.py
│   │   │   ├── revisor.py
│   │   │   ├── formateador.py
│   │   │   └── publicador.py
│   │   └── routers/                 # Controladores y Endpoints de la API REST
│   │       ├── auth.py              # Gestión de sesiones, login, registro y tokens
│   │       ├── articles.py          # Operaciones CRUD e interacciones del artículo
│   │       ├── agents.py            # Endpoints para inyectar la configuración y disparar el grafo personalizado
│   │       └── ai.py                # Primitivas RAG, embeddings e ingesta directa de documentos
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                        # Cliente Web de la Revista (React + Vite)
│   ├── src/
│   │   ├── components/              # Componentes de UI (Lienzo/Canvas de agentes, Editor, Configuración)
│   │   ├── pages/                   # Vistas principales: Login, Dashboard personal, FlowDesignerPage
│   │   ├── services/                # Capa de red y consumo de datos (Instancia Axios + Interceptores JWT)
│   │   ├── App.jsx                  # Configuración de rutas de la aplicación (React Router)
│   │   └── main.jsx                 # Punto de montaje del árbol DOM
│   ├── package.json
│   └── index.html
│
└── docker-compose.yml               # Manifiesto de orquestación de contenedores locales

---
## Endpoints de la API Principal

🔐 Autenticación (/api/v1/auth)
POST /register: Registra un nuevo usuario en la plataforma (email, password, full_name).

POST /login: Valida credenciales y expide el access_token JWT.

GET /me: Recupera la información del perfil del usuario autenticado en sesión.

📝 Artículos (/api/v1/articles)
GET /: Lista los artículos pertenecientes exclusivamente al espacio del autor logueado.

POST /: Inicializa un nuevo registro de artículo.

GET /{id} / PUT /{id}: Consulta y edición del cuerpo o metadatos del borrador.

🤖 Espacio Multi-Agente / RAG (/api/v1/ai & /api/v1/agents)
POST /ai/ingest: Sube y procesa documentos de referencia/fuentes directamente en la colección de Qdrant.

POST /ai/assist: Solicita sugerencias puntuales al copiloto usando Ollama + Qdrant de forma síncrona.

POST /agents/{article_id}/run: Despierta y orquesta el espacio personal. Inicia la ejecución del grafo asíncrono de LangGraph inyectando el diseño estructurado por el usuario.

Estructura del Payload para Ejecución Dinámica:
JSON
{
  "flow_sequence": [
    "investigador",
    "revisor",
    "formateador"
  ],
  "agent_settings": {
    "revisor": { "strict_mode": true },
    "formateador": { "style": "APA" }
  }
}
🔄 Flujo del Usuario End-to-End (Flow Designer)
[Login / Registro] ➔ Acceso al Dashboard Personal ➔ Seleccionar Artículo
                                                          │
   ┌──────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┐
   ▼                                                      ▼                                                      ▼
[1. Preparación Contextual]                [2. Diseñar el Enjambre (Canvas)]                      [3. Ejecución Directa (LangGraph)]
Carga de fuentes bibliográficas            Arrastrar/seleccionar agentes a usar                   Disparar flujo estructurado a medida
(POST /ai/ingest)                          Configurar orden de la secuencia                       (POST /agents/{id}/run)
Autenticación e Ingreso: El usuario se loguea en el frontend; el token JWT aísla todas las peticiones a su propio espacio de trabajo.

Fase de Diseño del Flujo: Desde la interfaz del editor, el usuario accede a la sección del Enjambre. Configura qué agentes intervienen (ej. Activa únicamente Investigador y Revisor) y ajusta los parámetros específicos de cada uno.

Invocación del Grafo Dinámico: Al hacer clic en "Lanzar Flujo Personalizado", el frontend envía la secuencia exacta de nodos en un JSON estructurado. El backend compila el flujo en LangGraph sobre la marcha, iluminando en la UI los nodos de la red dinámica en tiempo real según avanza el procesamiento local.

Reporte e Historial: La pantalla de revisión recopila el feedback agrupado exclusivamente por los agentes que participaron en la ejecución, permitiendo al usuario guardar el flujo como plantilla o reajustar los nodos.

🚀 Cómo Levantar el Proyecto en Local
Asegúrate de tener instalados Docker y Docker Compose V2 en tu máquina:

Bash
# 1. Clonar el repositorio oficial
git clone [https://github.com/luxinopanyvino/alejandria-magazine.git](https://github.com/luxinopanyvino/alejandria-magazine.git)
cd alejandria-magazine

# 2. Construir y levantar todos los servicios en segundo plano
docker compose up --build -d

# 3. Descargar el modelo de lenguaje local en el contenedor de Ollama
docker compose exec ollama ollama pull llama3.2
URLs de Acceso Local
Dashboard Web (Frontend + Canvas): http://localhost:8080

Documentación Interactiva (Swagger UI): http://localhost:8000/docs

Panel de Control de Vectores (Qdrant UI): http://localhost:6333/dashboard

## ⚙️ Configuración Global (config.yaml)
Parámetros globales por defecto leídos dinámicamente por backend/app/config.py:

YAML
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
  vector_size: 1536                 # Ajustado al modelo de embedding estándar

ollama:
  base_url: "http://localhost:11434"
  default_model: "llama3.2"
  temperature: 0.3                 # Temperatura baja para garantizar rigor científico

editorial_rules:
  min_approval_score: 80           # Umbral que exige el Revisor si está activo en el flujo
  allow_custom_topology: true      # Permite al frontend inyectar ordenación libre de agentes
Prioridad de carga: Variables de entorno (.env) > Archivo config.yaml > Valores por defecto de los modelos.

# Nota de desarrollo: Este repositorio cuenta con configuraciones nativas para asistentes agénticos de desarrollo. Revisa siempre las directrices de diseño en design.md y las especificaciones de comandos en CLAUDE.md antes de enviar un Pull Request o solicitar cambios de código.