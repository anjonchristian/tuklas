# syntax=docker/dockerfile:1

# ── Build stage: compile TypeScript ─────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage: only production deps + compiled JS ───────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

ENV PORT=8080
EXPOSE 8080

# Render/most platforms set PORT; the app reads it in src/env.ts.
CMD ["node", "dist/index.js"]
