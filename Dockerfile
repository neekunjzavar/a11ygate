# syntax=docker/dockerfile:1
# ---------------------------------------------------------------
# Production image for Campus Events (multi-stage, production deps only, non-root)
# ---------------------------------------------------------------

# Stage 1: install production dependencies only
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Stage 2: small runtime image
FROM node:22-alpine AS runtime

ARG GIT_SHA=dev
LABEL org.opencontainers.image.title="a11ygate-campus-events" \
      org.opencontainers.image.description="Campus Events app gated by accessibility and performance checks" \
      org.opencontainers.image.revision="${GIT_SHA}"

ENV NODE_ENV=production \
    PORT=3000 \
    GIT_SHA=${GIT_SHA}

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY public ./public

# Never run as root inside the container
USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-qO-", "http://127.0.0.1:3000/healthz"]

CMD ["node", "src/server.js"]
