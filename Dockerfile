# ==========================================
# ETAPA 1: Construcción del Frontend
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY Frontend/package*.json ./
RUN npm install
COPY Frontend/ ./
RUN npm run build


# ==========================================
# ETAPA 2: Construcción del Backend (NestJS)
# ==========================================
FROM node:22-bookworm-slim AS backend-builder
WORKDIR /app/backend

# Prisma necesita OpenSSL para seleccionar y ejecutar su motor nativo.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json y la carpeta prisma antes de instalar (para que prisma generate funcione)
COPY Backend/package*.json ./
COPY Backend/prisma ./prisma
RUN npm install

# Copiar el resto del código del backend y compilar
COPY Backend/ ./
RUN npm run build


# ==========================================
# ETAPA 3: Imagen Final de Producción
# ==========================================
FROM node:22-bookworm-slim
WORKDIR /app/backend

# El motor de Prisma también necesita OpenSSL en tiempo de ejecución.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias de producción y la carpeta prisma
COPY Backend/package*.json ./
COPY Backend/prisma ./prisma
RUN npm install --omit=dev

# Copiar el código compilado del backend desde la etapa 2
COPY --from=backend-builder /app/backend/dist ./dist

# Copiar el cliente compilado del frontend hacia la carpeta pública
COPY --from=frontend-builder /app/frontend/dist /app/public

# Exponer el puerto en el que corre NestJS
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "dist/main"]