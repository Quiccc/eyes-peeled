# Eyes Peeled API. Build from the repo root (the admin panel imports types from mobile/):
#   docker build -f server/Dockerfile .
# deploy/docker-compose.yml does this for you.

# --- Admin panel (Vite + React) -> static files served at /admin-panel ---
FROM node:26-slim AS admin
WORKDIR /repo/server/admin
COPY server/admin/package.json server/admin/package-lock.json ./
RUN npm ci
COPY mobile/src/api/types.ts /repo/mobile/src/api/types.ts
COPY server/admin/ ./
RUN npm run build

# --- API ---
FROM node:26-slim AS runtime
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=4000
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/tsconfig.json ./
COPY server/drizzle ./drizzle
COPY server/src ./src
COPY --from=admin /repo/server/admin/dist ./admin/dist

# Uploaded photos live here; mount a volume on it.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "src/index.ts"]
