# One image serving both halves: the API on top, the built app underneath it at
# the same origin, so the session cookie works and no CORS is involved.
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── runtime ──────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    SERVE_STATIC=true \
    DB_FILE=/data/autonode.db

# tsx is a runtime dependency here: it runs the TypeScript server directly, so
# there is no separate server build step.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts

# The database is the only writable state; mount a volume here to keep it.
VOLUME /data
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
