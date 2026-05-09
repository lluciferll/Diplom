# Сборка с контекстом КОРНЯ репозитория: docker compose / Render задают context = .
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm install

COPY backend/ .
RUN npx prisma generate

EXPOSE 4000

# Render: только DATABASE_URL из облака. Локально: depends_on db + healthcheck в docker-compose.yml
CMD ["sh", "-c", "npx prisma db push && (npm run seed || true) && npm start"]
