# ── Qareeb — single-container production image ────────────────────────────────
# Builds the React client + TypeScript API, then runs the API which also serves
# the built client (same origin → no CORS / proxy setup needed).
#
#   docker build -t qareeb .
#   docker run -p 4000:4000 -e JWT_SECRET=$(openssl rand -hex 32) -v qareeb-data:/app/server/data -v qareeb-uploads:/app/server/uploads qareeb
#
# Works out of the box on Railway, Fly.io, Render (Docker runtime), Koyeb, a VPS, …

# 1. Build stage ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# install deps first (better layer caching)
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --include=dev

# build client (Vite) + server (tsc), then drop dev dependencies
COPY . .
RUN npm run build && npm prune --omit=dev

# 2. Runtime stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server/package.json ./server/
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/server/drizzle ./server/drizzle
COPY --from=build --chown=node:node /app/client/dist ./client/dist

# runtime data (SQLite db, uploaded photos, cached VAPID keys) – mount volumes here to persist
RUN mkdir -p server/data server/uploads && chown -R node:node server
USER node
VOLUME ["/app/server/data", "/app/server/uploads"]

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
