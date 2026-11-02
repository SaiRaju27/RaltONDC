# ==============================================================================
# RALT ONDC Logistics Provider (BPP) — Production Dockerfile
# Base: Ubuntu 24.04 LTS (Noble) with Node.js 22 LTS for binary compatibility
# ==============================================================================
FROM ubuntu:24.04 AS base

# Install Node.js 22 and essential runtime tools
RUN apt-get update -qq && \
    apt-get install -y -qq curl ca-certificates dumb-init && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y -qq nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ==============================================================================
# Builder stage: compile TypeScript
# ==============================================================================
FROM base AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
RUN npm run build

# ==============================================================================
# Production runtime container
# ==============================================================================
FROM base AS runner
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy public static web assets (Admin portal, Customer tracking, etc.)
COPY public ./public

# Create runtime data directory for SQLite fallback
RUN mkdir -p data

# Copy environment file if present
COPY .env* ./

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Health check instruction
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
