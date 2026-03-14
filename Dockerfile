FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build the frontend (Vite)
RUN npm run build

# ─── Runtime stage ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install only production deps + tsx for running TS server
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy server source (tsx compiles on the fly)
COPY server ./server
COPY tsconfig.json ./

# Create data directory for SQLite & artifacts
RUN mkdir -p data/artifacts

# Expose port
EXPOSE 8787

# Health check (uses existing /api/health/live endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8787/api/health/live || exit 1

# Start the server (tsx runs TypeScript directly, no separate compile step)
CMD ["npx", "tsx", "server/index.ts"]
