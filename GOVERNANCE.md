# GOVERNANCE.md — Reglas de proyecto y guardianes de desarrollo

> Documento vinculante para todos los contribuidores (humanos y agentes IA).
> Ningún cambio al repositorio debe violar estas reglas.

---

## 1. Principios generales

1. **DESIGN.md es la fuente de verdad.** Antes de implementar cualquier módulo, su diseño debe constar en `DESIGN.md` (sección 4-5 como mínimo).
2. **AGENT.md define los límites de los agentes IA.** Ningún agente puede ejecutar acciones fuera de las declaradas en su sección correspondiente.
3. **Ningún secreto en el repositorio.** Variables de entorno, API keys, contraseñas exclusivamente en `.env` (ignorado por git). Usar `.env.example` para documentar.
4. **El dominio es puro.** Las capas `domain/` y `application/` no pueden importar de `adapters/`, `infrastructure/`, FastAPI, SQLAlchemy, ni ningún framework externo.
5. **Todo cambio de arquitectura requiere actualizar este documento y DESIGN.md.**

---

## 2. Estrategia de ramas

```
main            ← producción, siempre estable, solo merge vía PR aprobado
  └── develop   ← integración continua
        └── feature/<módulo>-<descripción-corta>   ← desarrollo activo
        └── fix/<descripción-corta>
        └── docs/<descripción-corta>
```

**Reglas:**
- `main` y `develop` tienen protección de rama activada (no push directo).
- Cada PR requiere al menos **1 review** de un humano.
- Las ramas se eliminan tras el merge.
- Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

---

## 3. Requisitos para merge a `develop`

### 3.1 Código

- [ ] Implementa exactamente lo especificado en `DESIGN.md` — no más, no menos.
- [ ] Pasa todos los tests existentes (`pytest` con > 80 % de cobertura en módulos nuevos).
- [ ] No introduce nuevas dependencias sin actualizar `requirements.txt` y justificarlas en el PR.
- [ ] No hay secrets ni credenciales hardcodeadas.
- [ ] Pasa linting: `ruff check .` y `mypy` sin errores.

### 3.2 Agentes IA

- [ ] Todo nuevo agente o herramienta está documentado en `AGENT.md` antes del PR.
- [ ] El agente tiene un fallback definido (ver sección 3 de `AGENT.md`).
- [ ] El prompt del agente incluye el bloque de protección contra prompt injection.
- [ ] Los datos del usuario están filtrados por `author_id` en todas las queries.

### 3.3 APIs

- [ ] El contrato de API está documentado en `DESIGN.md` sección 5 antes de implementarse.
- [ ] Los endpoints nuevos tienen validación de entrada con Pydantic.
- [ ] Los endpoints de IA tienen rate limit configurado en Nginx y FastAPI.

---

## 4. Guardianes de seguridad

### 4.1 Autenticación y autorización

| Regla | Implementación |
|---|---|
| Todo endpoint (excepto `/auth/*` y `/articles/*/view` público) requiere JWT válido | `Depends(get_current_user)` en FastAPI |
| El rol se verifica en el caso de uso, no solo en el router | `require_role(UserRole.REVIEWER)` en use case |
| Los tokens JWT expiran en 60 min | `JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60` en config |
| Las contraseñas se almacenan con bcrypt (cost factor ≥ 12) | `passlib[bcrypt]` |
| El refresh token se invalida en logout | Blacklist en Redis |

### 4.2 Validación de inputs

- Todos los inputs pasan por schemas Pydantic con tipos estrictos.
- Los campos de texto libre tienen longitud máxima definida en el schema.
- Los IDs de recursos se validan como UUID v4 antes de cualquier query.
- Los uploads de archivo se validan: tipo MIME, extensión y tamaño máximo (50 MB).
- Las URLs externas (para ingest) se validan contra rangos de IP bloqueados (ver `AGENT.md` sección 5).

### 4.3 Headers de seguridad (Nginx)

Configurados en `infrastructure/nginx/nginx.conf`:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy` (restrictivo)
- `Referrer-Policy: strict-origin-when-cross-origin`

### 4.4 Contenedores

- Ningún contenedor corre como `root` en producción.
- Las imágenes se fijan a versiones específicas (sin `:latest` en producción).
- Los secretos se inyectan como variables de entorno, nunca como argumentos de build.
- El acceso a Qdrant, PostgreSQL y Redis no está expuesto al exterior en producción (solo en la red Docker interna).

---

## 5. Política de uso de IA (Copilot / Agentes)

### 5.1 Copilot en desarrollo

- El código generado por Copilot debe ser **revisado y comprendido** por el desarrollador antes del commit.
- No aceptar sugerencias de Copilot que añadan dependencias no justificadas en `requirements.txt`.
- No aceptar sugerencias que salten la capa hexagonal (ej: SQL directo en un router FastAPI).

### 5.2 Agentes en producción

- Los agentes NO pueden ejecutar queries SQL directas; solo a través de repositorios.
- Los agentes NO pueden hacer `HTTP requests` a dominios no declarados en `tool_policies` de `AGENT.md`.
- Los logs de `agent_runs` son inmutables una vez creados (no `UPDATE`, solo `INSERT` + `finished_at`).
- Los tokens usados por los agentes se monitorizan; superar el umbral de `10 000 tokens/usuario/día` activa una alerta.

---

## 6. Definición de Hecho (DoD)

Un ítem de trabajo se considera **Hecho** cuando:

1. El código está implementado siguiendo los patrones de `DESIGN.md`.
2. Los tests unitarios del caso de uso tienen cobertura > 80 %.
3. El PR ha sido aprobado por al menos 1 revisor.
4. `docker compose up` levanta sin errores con el nuevo código.
5. `DESIGN.md` y/o `AGENT.md` están actualizados si el cambio lo requiere.
6. No hay warnings de `ruff` ni errores de `mypy`.

---

## 7. Versionado de la API

- La API está versionada bajo `/api/v1/`.
- Un cambio breaking (eliminar campo, cambiar tipo) requiere incrementar a `/api/v2/` con periodo de deprecación de 30 días.
- Los cambios no-breaking (añadir campos opcionales) no requieren nueva versión.

---

## 8. Gestión de dependencias

- Las versiones de dependencias se **fijan** en `requirements.txt` (sin `>=`).
- Se revisan mensualmente con `pip list --outdated`.
- Una dependencia nueva debe:
  1. Estar justificada en el PR.
  2. Tener licencia compatible (MIT, Apache 2.0, BSD).
  3. No introducir sub-dependencias con vulnerabilidades conocidas (verificar con `pip audit`).
