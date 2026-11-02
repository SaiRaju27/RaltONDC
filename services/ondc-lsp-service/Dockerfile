# ==============================================================================
# RALT ONDC Logistics Provider (BPP) — Multi-Stage Production Dockerfile
# Security: Non-root user, dumb-init signal handling, minimal attack surface
# ==============================================================================

# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies if needed for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build
RUN npm prune --production

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

# Add dumb-init for proper process and signal forwarding (SIGINT/SIGTERM)
RUN apk add --no-cache dumb-init curl wget

ENV NODE_ENV=production
ENV PORT=5000

# Run container as unprivileged 'node' user for security compliance
USER node

# Copy production artifacts from builder
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 5000

# Health check instruction using curl
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
