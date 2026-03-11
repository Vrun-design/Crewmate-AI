### Stage 1 — Build frontend assets
FROM node:20-slim AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./
RUN npm ci --include=dev

# Copy all source
COPY . .

# Build frontend
RUN npm run build

### Stage 2 — Runtime image
FROM node:20-slim AS runner

# Install chromium deps for Playwright browser skills
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Runtime keeps tsx available because the server is executed directly from TypeScript.
COPY package*.json ./
RUN npm ci --include=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig*.json ./

# Install playwright chromium browsers
RUN npx playwright install chromium --with-deps || true

# Data directory for SQLite (will be mounted as volume on Cloud Run)
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8787/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENV NODE_ENV=production
ENV PORT=8787

CMD ["node", "--import", "tsx", "server/index.ts"]
