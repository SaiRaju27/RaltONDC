# ==============================================================================
# RALT ONDC Logistics Provider (BPP) — Production Dockerfile
# Base: Ubuntu 24.04 LTS (Noble) with Node.js 22 LTS for binary compatibility
# ==============================================================================
FROM ubuntu:24.04 AS runner

# Install Node.js 22 and essential runtime tools
RUN apt-get update -qq && \
    apt-get install -y -qq curl ca-certificates dumb-init && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y -qq nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production dependencies only (avoids OOM on low-memory servers)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy compiled JavaScript artifacts
COPY dist ./dist

# Copy public static web assets (Admin portal, Customer tracking, etc.)
COPY public ./public

# Create runtime data directory for SQLite fallback
RUN mkdir -p data

# Copy environment file if present
COPY .env* ./

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001

# Health check instruction
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5001}/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
