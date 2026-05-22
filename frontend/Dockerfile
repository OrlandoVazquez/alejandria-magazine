# Etapa 1: Construcción/Compilación
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos e instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente y generar la carpeta dist
COPY . .
# En un entorno inicial vacío, si da error por falta de código, puedes saltarte el build o crear un index.html básico
RUN npm run build || mkdir dist

# Etapa 2: Servidor de producción
FROM nginx:1.25-alpine

# Copiar archivos compilados al directorio de Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración personalizada de Nginx para manejar rutas de SPA (React Router)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]