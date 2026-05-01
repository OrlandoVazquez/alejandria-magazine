# Guía rápida — Desarrollo local

## Checklist para empezar

### 1. Clonar y configurar
- [ ] `git clone https://github.com/luxinopanyvino/alejandria-magazine.git`
- [ ] `cd alejandria_magazine`
- [ ] `git checkout develop`
- [ ] `cp backend/.env.example backend/.env`
- [ ] Editar `backend/.env` con valores locales

### 2. Backend (Python)
- [ ] `cd backend`
- [ ] `python -m venv venv`
- [ ] `source venv/bin/activate` (Windows: `venv\Scripts\activate`)
- [ ] `pip install -r requirements.txt`
- [ ] `cd ..`

### 3. Frontend (Node)
- [ ] `cd frontend`
- [ ] `npm install` (o crear package.json)
- [ ] `cd ..`

### 4. Docker (servicios)
- [ ] Instalar Docker Desktop
- [ ] `docker compose up -d`
- [ ] Esperar a que levanten:
  - PostgreSQL (puerto 5432)
  - Redis (puerto 6379)
  - Qdrant (puerto 6333)
  - Ollama (puerto 11434)
  - MinIO (puerto 9000, console 9001)

### 5. Ejecutar backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
Docs en: http://localhost:8000/docs

### 6. Ejecutar frontend
```bash
cd frontend
npm run dev
```
Debería estar en: http://localhost:3000

---

## Troubleshooting

### Error: "Connection refused" en PostgreSQL
```bash
# Verificar que postgres está corriendo
docker ps | grep postgres

# Si no está, levantar
docker compose up postgres -d

# Ver logs
docker compose logs postgres
```

### Error: "ModuleNotFoundError: No module named 'app'"
```bash
# Asegúrate de estar en el directorio backend/ al ejecutar
cd backend
uvicorn app.main:app --reload

# O desde root:
python -m uvicorn backend.app.main:app --reload --port 8000
```

### Error: "Token inválido" en requests
- El JWT tiene expiración (30 min por defecto)
- Registrate y obtén nuevo token
- Incluye en headers: `Authorization: Bearer YOUR_TOKEN`

### PostgreSQL conecta pero BD no existe
```bash
# Ejecutar migraciones manualmente
cd backend
alembic upgrade head
```

### Port 8000 ya está en uso
```bash
# Usar otro puerto
uvicorn app.main:app --reload --port 8001
```

---

## Workflow típico

### Crear nuevo feature
```bash
# 1. Crear rama desde develop
git checkout develop
git pull origin develop
git checkout -b feature/mi-feature

# 2. Hacer cambios
# ... editar archivos ...

# 3. Commit y push
git add .
git commit -m "feat: descripción clara del cambio"
git push origin feature/mi-feature

# 4. Crear PR en GitHub (develop como base)
```

### Agregar dependencia Python
```bash
cd backend
pip install nueva-libreria
pip freeze > requirements.txt
git add requirements.txt
git commit -m "chore: add nueva-libreria"
```

### Generar migración Alembic
```bash
cd backend
alembic revision --autogenerate -m "descriptive message"
alembic upgrade head
```

---

## Verificar que todo funciona

```bash
# Health check
curl http://localhost:8000/health
# Expected: {"status": "ok", "version": "0.1.0"}

# Registrar usuario
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "test123", "full_name": "Test"}'

# Crear artículo (usa el token del registro)
curl -X POST http://localhost:8000/api/v1/articles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Article", "body": "Content"}'
```

---

## Archivos importantes

| Archivo | Descripción |
|---------|-------------|
| [backend/README.md](backend/README.md) | Cómo desarrollar el backend |
| [backend/EXAMPLES.md](backend/EXAMPLES.md) | Ejemplos de API |
| [DESIGN.md](DESIGN.md) | Especificación técnica |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Vista general del proyecto |
| [docker-compose.yml](docker-compose.yml) | Configuración Docker |

---

## Tips

- **Tests**: Aún no hay, pero puedes usar curl o Postman para testear endpoints
- **Logs**: `docker compose logs -f [servicio]` para ver logs en tiempo real
- **DB**: Acceder a PgAdmin en http://localhost:5050 (usuario/pass: admin@admin.com / admin)
- **MinIO**: Consola en http://localhost:9001 (minioadmin / minioadmin)
- **Redis**: `docker exec ap_redis redis-cli` para comandos Redis

---

## IMPORTANTE

- **NO commitear `.env`** — Usar `.env.example`
- **NO commitear `__pycache__` o `node_modules`** — Están en `.gitignore`
- **Cambiar SECRET_KEY en producción** — Aleatorio y fuerte
- **Cambiar passwords de POSTGRES, REDIS, MINIO** — En docker-compose.yml
- **Crear usuario admin** — Después de primer login, promover a admin en BD

---

*Última actualización: 1 de mayo de 2026*
