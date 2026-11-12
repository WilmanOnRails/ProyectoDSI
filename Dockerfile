FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY Backend/package*.json ./backend/
COPY Backend/prisma ./backend/prisma
RUN cd backend && npm ci
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && cd backend \
    && npx prisma generate

COPY Backend ./backend

COPY Frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY Frontend ./frontend

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN cd frontend && npm run build
RUN cd backend && npm run build


FROM node:22-bookworm-slim AS runtime

WORKDIR /app/backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/frontend/dist /app/frontend/dist

EXPOSE 3000

CMD ["npm", "run", "start:prod"]