# ---- builder ----
FROM node:20-alpine AS builder

# No build tools needed: better-sqlite3 ships prebuilts for linux-x64-musl (Alpine x64).
# prebuild-install pulls the .node binary; node-gyp rebuild is never invoked.
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /repo

# Layer 1: workspace manifests — cached until any package.json or lockfile changes.
# web/package.json is included so pnpm can resolve the workspace declaration,
# but its deps are NOT installed (--filter excludes it).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY api/package.json    ./api/
COPY web/package.json    ./web/
RUN pnpm install --frozen-lockfile --filter @octane11/api...

# Layer 2: source — cached until code changes, not dep changes.
COPY tsconfig.base.json ./
COPY shared ./shared
COPY api    ./api
RUN pnpm --filter @octane11/shared build \
 && pnpm --filter @octane11/api    build

# Extract a self-contained production deployment (resolves workspace:* refs)
RUN pnpm --filter @octane11/api deploy --prod /out

# ---- runtime ----
FROM node:20-alpine AS runtime

WORKDIR /app
COPY --from=builder /out/dist         ./dist
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json

# DB baked into the image; override via DB_PATH env var at runtime if needed
COPY data/events.db /data/events.db

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/events.db

USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
