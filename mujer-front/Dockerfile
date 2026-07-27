# syntax=docker/dockerfile:1.7

# ============================================================
# Dependencias
# ============================================================
FROM node:24-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ============================================================
# Compilación
# ============================================================
FROM node:24-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_INSTITUCION_SLUG=""

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_INSTITUCION_SLUG=${NEXT_PUBLIC_INSTITUCION_SLUG}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ============================================================
# Ejecución en Cloud Run
# ============================================================
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 8080

CMD ["node", "server.js"]
